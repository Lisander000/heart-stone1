// Single source of truth for financial roll-ups — derived from the Daily Tracker
// (daily_metrics). Home dashboard + Financial Overview both use this so their
// numbers always match the Daily Tracker exactly.
export type DailyRow = {
  date?: string;
  net_sales?: number; orders?: number;
  meta_spend?: number; google_spend?: number;
  creator_sales?: number; bol_sales?: number; email_sales?: number; organic_sales?: number;
};

const n = (v: any) => Number(v) || 0;

/** Period roll-up using the exact same formulas as the Daily Tracker.
 *  paid = meta + google · ad spend = paid + creator + bol + email + organic */
export function rollupDaily(days: DailyRow[]) {
  const t = days.reduce(
    (a, d) => {
      const paid = n(d.meta_spend) + n(d.google_spend);
      const spend = paid + n(d.creator_sales) + n(d.bol_sales) + n(d.email_sales) + n(d.organic_sales);
      a.net += n(d.net_sales); a.orders += n(d.orders); a.paid += paid; a.spend += spend;
      a.meta += n(d.meta_spend); a.google += n(d.google_spend); a.creator += n(d.creator_sales);
      a.bol += n(d.bol_sales); a.email += n(d.email_sales); a.organic += n(d.organic_sales);
      return a;
    },
    { net: 0, orders: 0, paid: 0, spend: 0, meta: 0, google: 0, creator: 0, bol: 0, email: 0, organic: 0 },
  );
  return {
    ...t,
    aov: t.orders ? t.net / t.orders : 0,
    mer: t.spend ? t.net / t.spend : 0,
    roasPaid: t.paid ? t.net / t.paid : 0,
    cac: t.orders ? t.spend / t.orders : 0,
    days: days.length,
  };
}
export type Rollup = ReturnType<typeof rollupDaily>;

/** Where the net sales come from — Daily Tracker channels are sales sources.
 *  "Paid / direct" is the remainder of net sales not attributed to a channel. */
export function salesByChannel(r: Rollup) {
  const attributed = r.creator + r.bol + r.email + r.organic;
  return [
    { name: "Paid / direct", value: Math.max(0, r.net - attributed) },
    { name: "Creator", value: r.creator },
    { name: "Bol", value: r.bol },
    { name: "Email", value: r.email },
    { name: "Organic", value: r.organic },
  ].filter((x) => x.value > 0);
}

/** Cost composition from the Forecast vs Actual P&L (actual column). */
export function costBreakdown(a: Record<string, number> = {}) {
  const n = (v: any) => Number(v) || 0;
  return [
    { name: "COGS", value: n(a.cogs) },
    { name: "Creator commissie", value: n(a.creator) },
    { name: "Payment", value: n(a.payment) },
    { name: "Bol fees", value: n(a.bol) },
    { name: "Shipping", value: n(a.shipping) },
    { name: "Marketing", value: n(a.meta) + n(a.google) },
    { name: "Vaste kosten", value: n(a.tools) + n(a.team) + n(a.office) + n(a.other) },
  ].filter((x) => x.value > 0).sort((x, y) => y.value - x.value);
}
