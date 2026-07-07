// Super users — accounts allowed to change protected settings (e.g. the returns
// step plan). Stored by email; the owner is a super user by default.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LS = "gb_super_users";
const SEED = ["lisander@gooodboys.com"];
const EV = "gb:superusers";
export const SUPERUSER_BLOCK = "Alleen super users kunnen dit aanpassen. Contacteer je leidinggevende als je een probleem hebt opgemerkt.";

export function getSuperUsers(): string[] {
  try { const raw = localStorage.getItem(LS); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return SEED;
}
function save(list: string[]) {
  try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export const isSuperUser = (email?: string | null) =>
  !!email && getSuperUsers().some((e) => e.toLowerCase() === email.toLowerCase());

export function setSuperUser(email: string, on: boolean) {
  const e = email.trim().toLowerCase();
  if (!e) return;
  let list = getSuperUsers().filter((x) => x.toLowerCase() !== e);
  if (on) list = [...list, e];
  save(list);
}

export function useSuperUsers(): string[] {
  const [list, setList] = useState<string[]>(getSuperUsers);
  useEffect(() => {
    const on = () => setList(getSuperUsers());
    window.addEventListener(EV, on);
    return () => window.removeEventListener(EV, on);
  }, []);
  return list;
}

export function useCurrentUserEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return email;
}

export function useIsSuperUser(): boolean {
  const email = useCurrentUserEmail();
  const list = useSuperUsers();
  return !!email && list.some((e) => e.toLowerCase() === email.toLowerCase());
}

const nameFromEmail = (email: string) => {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return local.split(" ").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || email;
};

/** Current signed-in user with a friendly display name (for authoring notes/logs). */
export function useCurrentUser(): { email: string | null; name: string } {
  const [u, setU] = useState<{ email: string | null; name: string }>({ email: null, name: "" });
  useEffect(() => {
    const map = (user: any) => {
      const email = user?.email ?? null;
      const meta = user?.user_metadata ?? {};
      const name = meta.full_name || meta.name || meta.display_name || (email ? nameFromEmail(email) : "");
      setU({ email, name });
    };
    supabase.auth.getUser().then(({ data }) => map(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => map(s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);
  return u;
}
