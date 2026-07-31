// Category access — super users decide which sidebar categories each user may see.
// Client-side model, mirroring the super-user store: kept per email in localStorage,
// broadcasts a change event so the sidebar / guard update live. Super users always
// see every category; a user without an explicit setting gets the default set.
import { useEffect, useState } from "react";
import { useCurrentUserEmail, useIsSuperUser } from "./superuser";

export const CATEGORIES = ["Finance", "Creative", "Research", "Strategy", "Operations", "Development"] as const;
export type Category = (typeof CATEGORIES)[number];
// what a user sees when a super user hasn't set anything yet (everything except Development)
export const DEFAULT_CATEGORIES: string[] = ["Finance", "Creative", "Research", "Strategy", "Operations"];

const LS = "gb_user_access";
const EV = "gb:useraccess";
type AccessMap = Record<string, string[]>;

function read(): AccessMap { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } }
function write(m: AccessMap) {
  try { localStorage.setItem(LS, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}

export function getUserAccess(email?: string | null): string[] {
  if (!email) return DEFAULT_CATEGORIES;
  const v = read()[email.toLowerCase()];
  return Array.isArray(v) ? v : DEFAULT_CATEGORIES;
}
export function hasExplicitAccess(email?: string | null): boolean {
  return !!email && email.toLowerCase() in read();
}
export function setUserAccess(email: string, cats: string[]) {
  const e = email.trim().toLowerCase(); if (!e) return;
  const m = read(); m[e] = [...new Set(cats)]; write(m);
}

export function useAllAccess(): AccessMap {
  const [m, setM] = useState<AccessMap>(read);
  useEffect(() => {
    const on = () => setM(read());
    window.addEventListener(EV, on); window.addEventListener("storage", on);
    return () => { window.removeEventListener(EV, on); window.removeEventListener("storage", on); };
  }, []);
  return m;
}

/** Categories the current signed-in user may see (super users see all). */
export function useMyAllowedCategories(): string[] {
  const email = useCurrentUserEmail();
  const iAmSuper = useIsSuperUser();
  const all = useAllAccess(); // re-render when any access changes
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
