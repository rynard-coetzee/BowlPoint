
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
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
            return json(
                { error: "Supabase server configuration is missing." },
                500
            );
        }

        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

        if (!token) {
            return json({ error: "Authentication required." }, 401);
        }

        // Create the server-side Supabase client.
        const callerClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        // Verify the caller's JWT.
        const {
            data: { user: caller },
            error: callerError
        } = await callerClient.auth.getUser(token);

        if (callerError || !caller) {
            return json(
                { error: "Your login session is invalid or has expired." },
                401
            );
        }

        // Load the caller's BowlPoint profile.
        const { data: callerProfile, error: profileError } =
            await callerClient
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
                { error: "Unable to verify your BowlPoint permissions." },
                500
            );
        }

        // Only active Admins and Comp Secretaries may create users.
        if (
            !callerProfile?.active ||
            !["admin", "comp_secretary"].includes(callerProfile.role)
        ) {
            return json(
                { error: "You do not have permission to create users." },
                403
            );
        }

        const body = await req.json();

        const email = String(body?.email || "").trim().toLowerCase();
        const fullName = String(body?.full_name || "").trim();
        const role = String(body?.role || "user").trim();
        const password = String(body?.password || "");

        if (!email || !fullName || !password) {
            return json(
                { error: "Full name, email and password are required." },
                400
            );
        }

        if (password.length < 8) {
            return json(
                { error: "Password must be at least 8 characters long." },
                400
            );
        }

        if (!["user", "comp_secretary", "admin"].includes(role)) {
            return json({ error: "Invalid user role." }, 400);
        }

        if (callerProfile.role !== "admin" && role === "admin") {
            return json(
                { error: "Comp Secretaries cannot create Admin users." },
                403
            );
        }

        // Create the Supabase Auth account.
        const { data: created, error: createError } =
            await callerClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name: fullName
                }
            });

        if (createError) {
            console.error(
                "Unable to create Auth user:",
                createError
            );

            return json({ error: createError.message }, 400);
        }

        if (!created.user?.id) {
            return json(
                { error: "Supabase did not return the new user ID." },
                500
            );
        }

        // Create the BowlPoint profile.
        const { error: insertProfileError } = await callerClient
            .from("profiles")
            .upsert(
                {
                    id: created.user.id,
                    full_name: fullName,
                    role,
                    active: true,
                    updated_at: new Date().toISOString()
                },
                { onConflict: "id" }
            );

        if (insertProfileError) {
            console.error(
                "Unable to create BowlPoint profile:",
                insertProfileError
            );

            // Remove the Auth account if the profile could not be created.
            await callerClient.auth.admin.deleteUser(created.user.id);

            return json(
                {
                    error: "Auth account was created, but the BowlPoint profile could not be created."
                },
                500
            );
        }

        // Record the user creation event without storing the new user's
        // email address, ID or password in the audit metadata.
        const { error: auditError } = await callerClient
            .from("audit_logs")
            .insert({
                actor_id: caller.id,
                actor_email: caller.email || null,
                actor_name: callerProfile.full_name || null,
                event_source: "edge_function",
                action: "WORKFLOW_ACTION",
                summary: `Created a BowlPoint user with role ${role}.`,
                metadata: {
                    operation: "create_user",
                    assigned_role: role
                }
            });

        if (auditError) {
            console.error(
                "Unable to write create-user audit event:",
                auditError
            );
        }

        // Return successful result.
        return json({
            success: true,
            user: {
                id: created.user.id,
                email: created.user.email,
                full_name: fullName,
                role
            }
        });

    } catch (error) {
        console.error("create-user function error:", error);

        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to create user."
            },
            500
        );
    }
});
