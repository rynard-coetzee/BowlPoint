import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
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
            return json({ error: "Supabase server configuration is missing." }, 500);
        }

        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

        if (!token) {
            return json({ error: "Authentication required." }, 401);
        }

        // This client uses the caller's JWT so getUser() verifies the
        // request against Supabase Auth rather than trusting a user ID
        // supplied by the browser.
        const callerClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: { user: caller }, error: callerError } =
            await callerClient.auth.getUser(token);

        if (callerError || !caller) {
            return json({ error: "Your login session is invalid or has expired." }, 401);
        }

        const { data: callerProfile, error: profileError } = await callerClient
            .from("profiles")
            .select("id, role, active")
            .eq("id", caller.id)
            .maybeSingle();

        if (profileError) {
            console.error("Unable to load caller profile:", profileError);
            return json({ error: "Unable to verify your BowlPoint permissions." }, 500);
        }

        if (!callerProfile?.active || !["admin", "comp_secretary"].includes(callerProfile.role)) {
            return json({ error: "You do not have permission to create users." }, 403);
        }

        const body = await req.json();
        const email = String(body?.email || "").trim().toLowerCase();
        const fullName = String(body?.full_name || "").trim();
        const role = String(body?.role || "user").trim();
        const password = String(body?.password || "");

        if (!email || !fullName || !password) {
            return json({ error: "Full name, email and password are required." }, 400);
        }

        if (password.length < 8) {
            return json({ error: "Password must be at least 8 characters long." }, 400);
        }

        if (!["user", "comp_secretary", "admin"].includes(role)) {
            return json({ error: "Invalid user role." }, 400);
        }

        if (callerProfile.role !== "admin" && role === "admin") {
            return json({ error: "Comp Secretaries cannot create Admin users." }, 403);
        }

        // Create the Auth account directly. email_confirm=true means the
        // user does not need an email relay or an email confirmation link.
        const { data: created, error: createError } = await callerClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName
            }
        });

        if (createError) {
            console.error("Unable to create Auth user:", createError);
            return json({ error: createError.message }, 400);
        }

        if (!created.user?.id) {
            return json({ error: "Supabase did not return the new user ID." }, 500);
        }

        // The service-role client bypasses RLS for this server-side write.
        const { error: insertProfileError } = await callerClient
            .from("profiles")
            .upsert({
                id: created.user.id,
                full_name: fullName,
                role,
                active: true,
                updated_at: new Date().toISOString()
            }, { onConflict: "id" });

        if (insertProfileError) {
            console.error("Unable to create BowlPoint profile:", insertProfileError);

            // Avoid leaving an Auth account behind if the BowlPoint profile
            // cannot be created. This also makes retries predictable.
            await callerClient.auth.admin.deleteUser(created.user.id);

            return json({ error: "Auth account was created, but the BowlPoint profile could not be created." }, 500);
        }

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
        return json({ error: error instanceof Error ? error.message : "Unable to create user." }, 500);
    }
});
