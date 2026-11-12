
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
        }
    });

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return json({ error: "Method not allowed." }, 405);
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get(
            "SUPABASE_SERVICE_ROLE_KEY"
        );

        if (!supabaseUrl || !serviceRoleKey) {
            return json(
                { error: "Supabase server configuration is missing." },
                500
            );
        }

        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

        if (!token) {
            return json(
                { error: "Authentication required." },
                401
            );
        }

        const adminClient = createClient(
            supabaseUrl,
            serviceRoleKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );

        // Verify the logged-in caller.
        const {
            data: { user: caller },
            error: callerError
        } = await adminClient.auth.getUser(token);

        if (callerError || !caller) {
            return json(
                {
                    error:
                        "Your login session is invalid or has expired."
                },
                401
            );
        }

        // Load caller's BowlPoint profile.
        const {
            data: callerProfile,
            error: profileError
        } = await adminClient
            .from("profiles")
            .select("id, role, active, full_name")
            .eq("id", caller.id)
            .maybeSingle();

        if (profileError) {
            console.error(
                "Unable to load caller profile:",
                profileError
            );

            return json(
                {
                    error:
                        "Unable to verify your BowlPoint permissions."
                },
                500
            );
        }

        if (
            !callerProfile?.active ||
            !["admin", "comp_secretary"].includes(
                callerProfile.role
            )
        ) {
            return json(
                {
                    error:
                        "You do not have permission to manage users."
                },
                403
            );
        }

        const body = await req.json();

        const action = String(body?.action || "").trim();
        const targetUserId = String(body?.user_id || "").trim();

        if (!targetUserId) {
            return json(
                { error: "User ID is required." },
                400
            );
        }

        if (
            !["reset_password", "delete_user"].includes(action)
        ) {
            return json(
                { error: "Invalid user management action." },
                400
            );
        }

        // Prevent a user from deleting their own account.
        if (
            action === "delete_user" &&
            targetUserId === caller.id
        ) {
            return json(
                {
                    error: "You cannot delete your own account."
                },
                403
            );
        }

        // Load target profile before performing any action.
        const {
            data: targetProfile,
            error: targetProfileError
        } = await adminClient
            .from("profiles")
            .select("id, full_name, role, active")
            .eq("id", targetUserId)
            .maybeSingle();

        if (targetProfileError) {
            console.error(
                "Unable to load target profile:",
                targetProfileError
            );

            return json(
                { error: "Unable to load the selected user." },
                500
            );
        }

        if (!targetProfile) {
            return json(
                { error: "User profile not found." },
                404
            );
        }

        // Comp Secretaries cannot manage Admin accounts.
        if (
            callerProfile.role !== "admin" &&
            targetProfile.role === "admin"
        ) {
            return json(
                {
                    error:
                        "Comp Secretaries cannot manage Admin accounts."
                },
                403
            );
        }

        const targetName =
            targetProfile.full_name || "Unnamed user";

        const targetRole = targetProfile.role;

        // ---------------------------------------------------------
        // RESET PASSWORD
        // ---------------------------------------------------------

        if (action === "reset_password") {
            const password = String(body?.password || "");

            if (password.length < 8) {
                return json(
                    {
                        error:
                            "Password must be at least 8 characters long."
                    },
                    400
                );
            }

            const { error: passwordError } =
                await adminClient.auth.admin.updateUserById(
                    targetUserId,
                    { password }
                );

            if (passwordError) {
                console.error(
                    "Unable to reset password:",
                    passwordError
                );

                return json(
                    { error: passwordError.message },
                    400
                );
            }

            // Record password reset without recording the password.
            const { error: auditError } = await adminClient
                .from("audit_logs")
                .insert({
                    actor_id: caller.id,
                    actor_email: caller.email || null,
                    actor_name: callerProfile.full_name || null,
                    event_source: "edge_function",
                    action: "WORKFLOW_ACTION",
                    summary: `Reset password for ${targetName} (${targetRole}).`,
                    metadata: {
                        operation: "reset_password",
                        target_name: targetName,
                        target_role: targetRole
                    }
                });

            if (auditError) {
                console.error(
                    "Unable to write password reset audit event:",
                    auditError
                );
            }

            return json({
                success: true,
                message: "Password reset successfully."
            });
        }

        // ---------------------------------------------------------
        // DELETE USER
        // ---------------------------------------------------------

        if (action === "delete_user") {

            // Remove competition assignments first.
            const { error: accessDeleteError } =
                await adminClient
                    .from("competition_user_access")
                    .delete()
                    .eq("user_id", targetUserId);

            if (accessDeleteError) {
                console.error(
                    "Unable to remove competition access:",
                    accessDeleteError
                );

                return json(
                    {
                        error:
                            "Unable to remove the user's competition access."
                    },
                    500
                );
            }

            // Remove BowlPoint profile.
            const { error: profileDeleteError } =
                await adminClient
                    .from("profiles")
                    .delete()
                    .eq("id", targetUserId);

            if (profileDeleteError) {
                console.error(
                    "Unable to delete BowlPoint profile:",
                    profileDeleteError
                );

                return json(
                    {
                        error:
                            "Unable to delete the BowlPoint profile."
                    },
                    500
                );
            }

            // Finally remove the Supabase Auth account.
            const { error: authDeleteError } =
                await adminClient.auth.admin.deleteUser(
                    targetUserId
                );

            if (authDeleteError) {
                console.error(
                    "Unable to delete Auth user:",
                    authDeleteError
                );

                return json(
                    {
                        error:
                            "The BowlPoint profile was removed, but the login account could not be deleted. Please contact an administrator."
                    },
                    500
                );
            }

            // Record the successful deletion.
            // The target details were captured before deletion.
            const { error: auditError } = await adminClient
                .from("audit_logs")
                .insert({
                    actor_id: caller.id,
                    actor_email: caller.email || null,
                    actor_name: callerProfile.full_name || null,
                    event_source: "edge_function",
                    action: "WORKFLOW_ACTION",
                    summary: `Deleted user ${targetName} (${targetRole}).`,
                    metadata: {
                        operation: "delete_user",
                        target_name: targetName,
                        target_role: targetRole
                    }
                });

            if (auditError) {
                console.error(
                    "Unable to write user deletion audit event:",
                    auditError
                );
            }

            return json({
                success: true,
                message: "User deleted successfully."
            });
        }

        return json(
            { error: "Unsupported action." },
            400
        );

    } catch (error) {
        console.error(
            "manage-user function error:",
            error
        );

        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to manage user."
            },
            500
        );
    }
});
