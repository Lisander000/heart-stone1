// Edge Function: manage-access
// Super users manage per-user category access, stored in each user's auth app_metadata
// (only the service role can write app_metadata, so users can't lift their own restriction).
//   { action: "list" }                          -> { users: [{ email, categories }] }
//   { action: "set", email, categories: [...] } -> { ok: true }
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

// Server-side allowlist of who may change access. Add more @gooodboys.com super admins here.
const SUPER_ADMINS = ["lisander@gooodboys.com"];

async function findByEmail(admin: any, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = (data.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if ((data.users ?? []).length < 200) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Authorize the caller — must be signed in.
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(jwt);
    if (!caller) return json({ error: "Niet ingelogd." }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Roster: ANY signed-in user may read the whole team (name/role/status). The service role
    // bypasses team_members' per-owner RLS so everyone sees every member, not just their own.
    if (action === "roster") {
      const { data: rows, error } = await admin
        .from("team_members")
        .select("id, name, email, role, status, invited_at")
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      const signed = new Set<string>();
      for (let page = 1; page <= 20; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        for (const u of (data.users ?? [])) if ((u as any).last_sign_in_at && u.email) signed.add(u.email.toLowerCase());
        if ((data.users ?? []).length < 200) break;
      }
      const members = (rows ?? []).map((r: any) => ({
        ...r,
        status: (r.status === "invited" && signed.has((r.email ?? "").toLowerCase())) ? "active" : r.status,
      }));
      return json({ members });
    }

    // Everything below requires a super admin.
    if (!SUPER_ADMINS.includes((caller.email ?? "").toLowerCase()))
      return json({ error: "Alleen super users kunnen toegang beheren." }, 403);

    if (action === "list") {
      const users: { email: string; categories: string[] | null; active: boolean }[] = [];
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return json({ error: error.message }, 400);
        for (const u of (data.users ?? [])) {
          const cats = (u.app_metadata as any)?.categories;
          // active = has actually signed in at least once (accepted the invite)
          users.push({ email: u.email ?? "", categories: Array.isArray(cats) ? cats : null, active: !!(u as any).last_sign_in_at });
        }
        if ((data.users ?? []).length < 200) break;
      }
      return json({ users });
    }

    if (action === "set") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const categories = Array.isArray(body.categories) ? body.categories.map(String) : [];
      if (!email || !email.includes("@")) return json({ error: "Geef een geldig e-mailadres." }, 400);
      const target = await findByEmail(admin, email);
      if (!target) return json({ error: `Geen account gevonden voor ${email}.` }, 404);
      const { error } = await admin.auth.admin.updateUserById(target.id, { app_metadata: { categories } });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Onbekende actie." }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
