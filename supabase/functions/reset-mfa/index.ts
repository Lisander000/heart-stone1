// Edge Function: reset-mfa
// A super user provides { email }; this removes that user's MFA (TOTP) factors using the
// service-role key, so the person can enroll a fresh authenticator on their next login
// (Supabase requires AAL2 to enroll while a factor exists — a lost-authenticator user can't
// reach that, so recovery must be an admin action).
//
// Lovable Cloud injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Server-side allowlist of who may reset MFA. Add more @gooodboys.com super admins here.
const SUPER_ADMINS = ["lisander@gooodboys.com"];

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
    if (!SUPER_ADMINS.includes((caller.email ?? "").toLowerCase()))
      return json({ error: "Alleen super users kunnen MFA resetten." }, 403);

    // 2) Validate input.
    const { email } = await req.json().catch(() => ({}));
    const clean = String(email ?? "").trim().toLowerCase();
    if (!clean || !clean.includes("@")) return json({ error: "Geef een geldig e-mailadres." }, 400);

    // 3) Find the target user by email (paginate; the team is small).
    let target: any = null;
    for (let page = 1; page <= 20 && !target; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: error.message }, 400);
      target = (data.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === clean) ?? null;
      if ((data.users ?? []).length < 200) break;
    }
    if (!target) return json({ error: `Geen account gevonden voor ${clean}.` }, 404);

    // 4) Remove every MFA factor so the next login starts a fresh enrollment.
    let factors: any[] = target.factors ?? [];
    if (factors.length === 0) {
      const { data: lf } = await admin.auth.admin.mfa.listFactors({ userId: target.id });
      factors = (lf as any)?.factors ?? [];
    }
    let removed = 0;
    for (const f of factors) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: target.id, id: f.id });
      if (!error) removed++;
    }

    return json({ ok: true, email: clean, removed });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
