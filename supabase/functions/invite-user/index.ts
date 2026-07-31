// Edge Function: invite-user
// A super user provides { name, email }; this creates the account (server-side, with
// the service-role key) and sends Supabase's built-in invite email. The invited person
// clicks the link, lands on /auth and sets their own password (must_change_password),
// then goes through MFA setup like everyone else.
//
// Deploy:  supabase functions deploy invite-user
// Secrets: supabase secrets set SITE_URL=https://your-app-url  SUPER_ADMINS=lisander@gooodboys.com,other@gooodboys.com
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Authorize the caller — must be signed in AND on the super-admin allowlist.
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(jwt);
    if (!caller) return json({ error: "Niet ingelogd." }, 401);
    const admins = (Deno.env.get("SUPER_ADMINS") ?? "lisander@gooodboys.com")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes((caller.email ?? "").toLowerCase()))
      return json({ error: "Alleen super users kunnen mensen uitnodigen." }, 403);

    // 2) Validate input.
    const { name, email } = await req.json().catch(() => ({}));
    const clean = String(email ?? "").trim().toLowerCase();
    if (!clean || !clean.includes("@")) return json({ error: "Geef een geldig e-mailadres." }, 400);

    // 3) Send the invite. `data` becomes the new user's user_metadata; must_change_password
    //    makes the app show the "kies je wachtwoord" step on first login.
    const siteUrl = (Deno.env.get("SITE_URL") ?? supabaseUrl).replace(/\/$/, "");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(clean, {
      data: { full_name: String(name ?? "").trim(), must_change_password: true },
      redirectTo: `${siteUrl}/auth`,
    });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true, userId: data.user?.id, email: clean });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
