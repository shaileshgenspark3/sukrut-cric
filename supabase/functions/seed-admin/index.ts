import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

serve(async (req) => {
    try {
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: "admin@sukrut.com",
            password: "Admin123!",
            email_confirm: true,
        });

        if (authError && !authError.message.includes("already exists") && !authError.message.includes("User already registered") && !authError.message.includes("already registered")) {
            console.error("Auth error:", authError.message);
            throw authError;
        }

        console.log("Auth step completed. User exists or was created.");

        let userId = authData?.user?.id;

        if (!userId) {
            const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
            const existing = usersData?.users?.find(u => u.email === "admin@sukrut.com");
            if (existing) userId = existing.id;
        }

        if (userId) {
            const { error: roleError } = await supabaseAdmin
                .from("user_roles")
                .upsert({ user_id: userId, role: "core_admin" }, { onConflict: "user_id, role" });

            if (roleError) throw roleError;
        }

        return new Response(JSON.stringify({ success: true, message: "Admin seeded successfully" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        });
    }
});
