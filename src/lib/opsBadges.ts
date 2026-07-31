// Sidebar badge counts — how many open cases / items need attention per ops page.
// Each page gets a small count bubble in the sidebar, tinted with that page's own
// icon colour (see BADGE_ACCENT). Reads supabase, falls back to localStorage, and
// refreshes on focus / the relevant change events so the numbers stay current.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const readLocal = (t: string): any[] => { try { return JSON.parse(localStorage.getItem(`gb_${t}`) || "[]"); } catch { return []; } };

async function loadLite(table: string, cols: string): Promise<any[]> {
  try {
    const { data, error } = await (supabase as any).from(table).select(cols);
    if (error) return readLocal(table);
    if (data && data.length) return data;
    const local = readLocal(table);
    return local.length ? local : (data ?? []);
  } catch { return readLocal(table); }
}

const RET_OPEN = new Set(["requested", "approved", "received"]);      // returns still in flight
const SHIP_DONE = new Set(["delivered", "resolved"]);                  // shipments that are settled
const TICKET_OPEN = new Set(["open", "pending"]);                      // tickets still to handle

export type BadgeMap = Record<string, number>;

/** Count of open cases / items per ops page, keyed by nav url. */
export function useOpsBadges(): BadgeMap {
  const [m, setM] = useState<BadgeMap>({});
  useEffect(() => {
    let alive = true;
    const recount = async () => {
      const [returns, shipments, tickets, orders, ph] = await Promise.all([
        loadLite("returns", "id,status"),
        loadLite("shipments", "id,status"),
        loadLite("tickets", "id,status"),
        loadLite("orders", "id,fulfillment_status"),
        loadLite("product_health", "id,status"),
      ]);
      if (!alive) return;
      setM({
        "/returns": returns.filter((r) => RET_OPEN.has(r.status)).length,
        "/shipments": shipments.filter((s) => s.status && !SHIP_DONE.has(s.status)).length,
        "/tickets": tickets.filter((t) => TICKET_OPEN.has(t.status)).length,
        "/unfulfilled": orders.filter((o) => o.fulfillment_status === "unfulfilled").length,
        "/product-health": ph.filter((p) => p.status && p.status !== "healthy").length,
      });
    };
    recount();
    const on = () => recount();
    const evs = ["gb:returns", "gb:returnsteps", "gb:ticketcase", "focus"];
    evs.forEach((e) => window.addEventListener(e, on));
    document.addEventListener("visibilitychange", on);
    const iv = window.setInterval(recount, 60000); // gentle periodic refresh
    return () => {
      alive = false;
      evs.forEach((e) => window.removeEventListener(e, on));
      document.removeEventListener("visibilitychange", on);
      window.clearInterval(iv);
    };
  }, []);
  return m;
}

/** Badge tint per page — matches the colour of that page's on-page icon. */
export const BADGE_ACCENT: Record<string, string> = {
  "/returns": "hsl(var(--bad))",
  "/shipments": "hsl(var(--ember))",
  "/tickets": "hsl(var(--grape))",
  "/unfulfilled": "hsl(var(--warn))",
  "/product-health": "hsl(var(--ok))",
};
