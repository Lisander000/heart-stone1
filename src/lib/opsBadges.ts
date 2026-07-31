// Sidebar badge counts — how many open cases / items need attention per ops page.
// Each page gets a small count bubble in the sidebar, tinted with that page's own
// icon colour (see BADGE_ACCENT). Reads supabase, falls back to localStorage, and
// stays interactive: it recounts on route changes, on data-change events (returns,
// tickets, shipments, generic ops) and on focus, so resolving/deleting something
// updates or clears the bubble right away.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
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

const OPS_EV = "gb:ops";
/** Tell the sidebar badges to refresh now — call after any create/resolve/delete. */
export function pingOps() { try { window.dispatchEvent(new CustomEvent(OPS_EV)); } catch { /* ignore */ } }

export type BadgeMap = Record<string, number>;

/** Count of open cases / items per ops page, keyed by nav url. Interactive. */
export function useOpsBadges(): BadgeMap {
  const [m, setM] = useState<BadgeMap>({});
  const { pathname } = useLocation();
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const recount = useCallback(async () => {
    const [returns, shipments, tickets, orders, ph, daily] = await Promise.all([
      loadLite("returns", "id,status"),
      loadLite("shipments", "id,status"),
      loadLite("tickets", "id,status"),
      loadLite("orders", "id,fulfillment_status"),
      loadLite("product_health", "id,status"),
      loadLite("daily_metrics", "date"),
    ]);
    if (!mounted.current) return;
    const today = new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, local — matches the tracker
    const dailyFilled = daily.some((d) => d.date === today);
    setM({
      "/returns": returns.filter((r) => RET_OPEN.has(r.status)).length,
      "/shipments": shipments.filter((s) => s.status && !SHIP_DONE.has(s.status)).length,
      "/tickets": tickets.filter((t) => TICKET_OPEN.has(t.status)).length,
      "/unfulfilled": orders.filter((o) => o.fulfillment_status === "unfulfilled").length,
      "/product-health": ph.filter((p) => p.status && p.status !== "healthy").length,
      "/daily-tracker": dailyFilled ? 0 : 1, // needs today's numbers
    });
  }, []);

  // recount on mount + whenever the route changes (e.g. after resolving & navigating back)
  useEffect(() => { recount(); }, [recount, pathname]);

  // recount on data-change events / focus, plus a gentle periodic refresh
  useEffect(() => {
    // a second pass catches writes that resolve just after the event fires (async supabase)
    const on = () => { recount(); window.setTimeout(recount, 600); };
    const evs = ["gb:returns", "gb:returnsteps", "gb:ticketcase", "gb:shipmentcase", OPS_EV, "focus"];
    evs.forEach((e) => window.addEventListener(e, on));
    document.addEventListener("visibilitychange", on);
    const iv = window.setInterval(recount, 30000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, on));
      document.removeEventListener("visibilitychange", on);
      window.clearInterval(iv);
    };
  }, [recount]);

  return m;
}

/** Badge tint per page — matches the colour of that page's on-page icon. */
export const BADGE_ACCENT: Record<string, string> = {
  "/returns": "hsl(var(--bad))",
  "/shipments": "hsl(var(--ember))",
  "/tickets": "hsl(var(--grape))",
  "/unfulfilled": "hsl(var(--warn))",
  "/product-health": "hsl(var(--ok))",
  "/daily-tracker": "hsl(var(--ember))",
};
