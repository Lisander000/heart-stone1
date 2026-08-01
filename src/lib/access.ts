// Category access — super users decide which sidebar categories each user may see.
// Backed by a SHARED Supabase table (`user_access`) so a restriction set by a super
// user actually reaches that user on their own device. localStorage is only an
// instant-paint cache + offline fallback: if the table doesn't exist yet the behaviour
// gracefully falls back to the previous per-browser model. Super users see everything.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserEmail, useIsSuperUser } from "./superuser";

export const CATEGORIES = ["Finance", "Creative", "Research", "Strategy", "Operations", "Development"] as const;
export type Category = (typeof CATEGORIES)[number];
// what a user sees when a super user hasn't set anything yet (everything except Development)
export const DEFAULT_CATEGORIES: string[] = ["Finance", "Creative", "Research", "Strategy", "Operations"];

const LS = "gb_user_access";
const EV = "gb:useraccess";
type AccessMap = Record<string, string[]>;

function readLS(): AccessMap { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } }
function writeLS(m: AccessMap) { try { localStorage.setItem(LS, JSON.stringify(m)); } catch { /* ignore */ } }
function emit() { try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ } }

// Shared source of truth = Supabase; localStorage seeds the cache for instant paint.
let cache: AccessMap = readLS();
let inFlight = false;

async function pull(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const { data, error } = await (supabase as any).from("user_access").select("email, categories");
    if (error) return; // table missing (404) / offline → keep the localStorage cache
    const m: AccessMap = {};
    for (const r of ((data as any[]) ?? [])) {
      const e = String(r.email || "").toLowerCase();
      if (e) m[e] = Array.isArray(r.categories) ? r.categories : [];
    }
    cache = m; writeLS(m); emit();
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
export function setUserAccess(email: string, cats: string[]) {
  const e = email.trim().toLowerCase(); if (!e) return;
  const next = [...new Set(cats)];
  cache = { ...cache, [e]: next }; writeLS(cache); emit(); // optimistic, instant UI
  // shared persistence (best-effort; if the table is missing it stays local-only)
  (supabase as any)
    .from("user_access")
    .upsert({ email: e, categories: next, updated_at: new Date().toISOString() }, { onConflict: "email" })
    .then(({ error }: any) => { if (error) console.warn("user_access upsert failed:", error.message); });
}

export function useAllAccess(): AccessMap {
  const [m, setM] = useState<AccessMap>(cache);
  useEffect(() => {
    const onEv = () => setM({ ...cache });
    const onStorage = (e: StorageEvent) => { if (e.key === LS) { cache = readLS(); setM({ ...cache }); } };
    window.addEventListener(EV, onEv);
    window.addEventListener("storage", onStorage);
    void pull(); // refresh from the shared table on mount
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_IN" || ev === "INITIAL_SESSION" || ev === "USER_UPDATED") void pull();
    });
    return () => {
      window.removeEventListener(EV, onEv);
      window.removeEventListener("storage", onStorage);
      sub.subscription.unsubscribe();
    };
  }, []);
  return m;
}

/** Categories the current signed-in user may see (super users see all). */
export function useMyAllowedCategories(): string[] {
  const email = useCurrentUserEmail();
  const iAmSuper = useIsSuperUser();
  const all = useAllAccess(); // re-render when any access changes / after the Supabase pull
  if (iAmSuper) return [...CATEGORIES];
  const v = all[(email ?? "").toLowerCase()];
  return Array.isArray(v) ? v : DEFAULT_CATEGORIES;
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
