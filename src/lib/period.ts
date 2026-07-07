// Shared period filter used by the dashboards (home + returns).
export type Period = "today" | "7d" | "30d" | "90d" | "year" | "custom";

export const PERIODS: { id: Period; label: string; prev: string }[] = [
  { id: "today", label: "Vandaag",  prev: "gisteren" },
  { id: "7d",    label: "7 dagen",  prev: "vorige 7 dagen" },
  { id: "30d",   label: "30 dagen", prev: "vorige 30 dagen" },
  { id: "90d",   label: "90 dagen", prev: "vorige 90 dagen" },
  { id: "year",  label: "Dit jaar", prev: "vorig jaar" },
];

const DAY = 86400000;

export function rangeFor(period: Period, custom: string) {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  let days = 1;
  if (period === "7d") { start.setDate(start.getDate() - 6); days = 7; }
  else if (period === "30d") { start.setDate(start.getDate() - 29); days = 30; }
  else if (period === "90d") { start.setDate(start.getDate() - 89); days = 90; }
  else if (period === "year") { start.setMonth(0, 1); days = Math.round((end.getTime() - start.getTime()) / DAY) + 1; }
  else if (period === "custom" && custom) { start.setTime(new Date(custom + "T00:00:00").getTime()); end.setTime(new Date(custom + "T23:59:59").getTime()); days = 1; }
  const s = start.getTime(), e = end.getTime();
  return { s, e, ps: s - days * DAY, pe: s - 1, days };
}

/* comparable ms for either a yyyy-mm-dd date or an ISO timestamp */
export const toMs = (v: any) => { if (!v) return NaN; const str = String(v); return (str.length <= 10 ? new Date(str + "T12:00:00") : new Date(str)).getTime(); };
export const within = (v: any, a: number, b: number) => { const t = toMs(v); return t >= a && t <= b; };
export const pctDelta = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : (cur ? 100 : 0));

export const prevLabelFor = (period: Period) => (period === "custom" ? "vorige dag" : (PERIODS.find((p) => p.id === period)?.prev ?? "vorige periode"));
