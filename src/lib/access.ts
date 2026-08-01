// Category access — super users decide which sidebar categories each user may see.
// Enforcement is SECURE and SHARED via Supabase auth app_metadata: only the service role can
// write it, so a user can't lift their own restriction, and every device reads the same value.
// A super user sets it through the `manage-access` edge function; each user reads their own
// categories from their session. No custom table needed (Lovable Cloud won't create one from
// here, but it does deploy edge functions).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperUser } from "./superuser";

export const CATEGORIES = ["Finance", "Creative", "Research", "Strategy", "Operations", "Development"] as const;
export type Category = (typeof CATEGORIES)[number];
// what a user sees when a super user hasn't set anything yet (everything except Development)
export const DEFAULT_CATEGORIES: string[] = ["Finance", "Creative", "Research", "Strategy", "Operations"];

type AccessMap = Record<string, string[]>;
const EV = "gb:useraccess";

// Cache of ALL users' access — populated on the Team page via the admin `list` action; used
// only for the super user's Team display. A user's OWN enforcement reads their app_metadata.
let cache: AccessMap = {};
let inFlight = false;

async function pullAll(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const { data, error } = await supabase.functions.invoke("manage-access", { body: { action: "list" } });
    if (error || (data as any)?.error) return; // not a super user / not deployed → keep cache
    const m: AccessMap = {};
    for (const u of ((data as any)?.users ?? [])) {
      const e = String(u.email || "").toLowerCase();
      if (e) m[e] = Array.isArray(u.categories) ? u.categories : DEFAULT_CATEGORIES;
    }
    cache = m;
    try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
  } finally {
    inFlight = false;
  }
}

export function getUserAccess(email?: string | null): string[] {
  if (!email) return DEFAULT_CATEGORIES;
  const v = cache[email.toLowerCase()];
  return Array.isArray(v) ? v : DEFAULT_CATEGORIES;
}
export function hasExplicitAccess(email?: string | null): boolean {
  return !!email && email.toLowerCase() in cache;
}

/** Super user sets a user's allowed categories (persisted to their auth app_metadata). */
export async function setUserAccess(email: string, cats: string[]): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const next = [...new Set(cats)];
  cache = { ...cache, [e]: next };
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
  const { data, error } = await supabase.functions.invoke("manage-access", { body: { action: "set", email: e, categories: next } });
  if (error || (data as any)?.error) throw new Error((error as any)?.message || (data as any)?.error || "Kon toegang niet opslaan.");
}

/** Team page: map of every user's access (super-admin only; empty otherwise). */
export function useAllAccess(): AccessMap {
  const [m, setM] = useState<AccessMap>(cache);
  useEffect(() => {
    const on = () => setM({ ...cache });
    window.addEventListener(EV, on);
    void pullAll();
    return () => window.removeEventListener(EV, on);
  }, []);
  return m;
}

/** Categories the current signed-in user may see (super users see all). Reads the user's own
 *  app_metadata so the restriction is enforced securely on every device. */
export function useMyAllowedCategories(): string[] {
  const iAmSuper = useIsSuperUser();
  const [cats, setCats] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const c = (data.user?.app_metadata as any)?.categories;
      if (alive) setCats(Array.isArray(c) ? c : null);
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  if (iAmSuper) return [...CATEGORIES];
  return cats ?? DEFAULT_CATEGORIES;
}

// url → category, for guarding direct navigation to a hidden category
const CATEGORY_PREFIXES: Record<string, string[]> = {
  Finance: ["/daily-tracker", "/finance"],
  Creative: ["/creative"],
  Research: ["/bank", "/collections", "/synthesis", "/entries"],
  Strategy: ["/icp", "/competitors", "/offers"],
  Operations: ["/orders", "/unfulfilled", "/shipments", "/returns", "/tickets", "/product-health", "/team", "/ops", "/notifications"],
  Development: ["/developer", "/agents"],
};
export function categoryForPath(pathname: string): string | null {
  for (const [cat, prefixes] of Object.entries(CATEGORY_PREFIXES)) {
    if (prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return cat;
  }
  return null; // "/", "/profile", unknown → always allowed
}
