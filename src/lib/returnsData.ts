// Lightweight returns access for the sidebar badge — counts how many refund cases
// are still open (not refunded / rejected) and refreshes on returns changes.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ReturnLite = { id: string; status: string };

const OPEN = new Set(["requested", "approved", "received"]); // everything not terminal
export const isOpenReturn = (status: string) => OPEN.has(status);

function readLocal(): ReturnLite[] {
  try { return JSON.parse(localStorage.getItem("gb_returns") || "[]"); } catch { return []; }
}

export async function loadReturnsLite(): Promise<ReturnLite[]> {
  try {
    const { data, error } = await (supabase as any).from("returns").select("id,status");
    if (error) return readLocal();
    if (data && data.length) return data as ReturnLite[];
    const local = readLocal();
    return local.length ? local : (data ?? []);
  } catch { return readLocal(); }
}

const RET_EV = "gb:returns";
/** notify listeners (e.g. the sidebar badge) that returns changed */
export function pingReturns() { try { window.dispatchEvent(new CustomEvent(RET_EV)); } catch { /* ignore */ } }

export function useOpenReturnsCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const recount = async () => { const rows = await loadReturnsLite(); if (alive) setN(rows.filter((r) => isOpenReturn(r.status)).length); };
    recount();
    const on = () => recount();
    window.addEventListener(RET_EV, on);
    window.addEventListener("gb:returnsteps", on);
    window.addEventListener("focus", on);
    document.addEventListener("visibilitychange", on);
    return () => {
      alive = false;
      window.removeEventListener(RET_EV, on);
      window.removeEventListener("gb:returnsteps", on);
      window.removeEventListener("focus", on);
      document.removeEventListener("visibilitychange", on);
    };
  }, []);
  return n;
}
