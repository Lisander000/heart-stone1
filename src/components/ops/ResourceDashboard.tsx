// Generic resource dashboard — the embedded "Dashboard" tab for ResourcePage-based
// pages (orders, shipments, unfulfilled, tickets), mirroring the returns dashboard:
// period filter, KPIs vs the previous period, a volume-over-time area chart, a status
// donut and per-dimension breakdowns. Config-driven so one component serves them all.
import { useEffect, useMemo, useState, type ElementType } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import { RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle2, BadgeEuro, Hash, CalendarDays } from "lucide-react";
import { PERIODS, rangeFor, within, pctDelta, prevLabelFor, toMs, type Period } from "@/lib/period";

const PALETTE = ["hsl(var(--info))", "hsl(var(--ember))", "hsl(var(--grape))", "hsl(var(--sun))", "hsl(var(--ok))", "hsl(var(--warn))", "hsl(var(--bad))", "hsl(var(--muted-foreground))"];
const eurC = (v: number) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1000) return s + "€" + (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",") + "k"; return s + "€" + Math.round(a); };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-md)" } as const;
const dayOf = (v: any) => { const t = String(v); return t.length <= 10 ? t : new Date(t).toISOString().slice(0, 10); };
// human-readable duration (aanmaak → afhandeling)
const fmtDur = (ms: number) => {
  if (!isFinite(ms) || ms <= 0) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return rm ? `${h}u ${rm}m` : `${h}u`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh ? `${d}d ${rh}u` : `${d}d`;
};
const RES_BUCKETS = [
  { name: "< 1 u", max: 3600e3, color: "hsl(var(--ok))" },
  { name: "1–4 u", max: 4 * 3600e3, color: "hsl(var(--ok))" },
  { name: "4–24 u", max: 24 * 3600e3, color: "hsl(var(--warn))" },
  { name: "1–3 d", max: 3 * 24 * 3600e3, color: "hsl(var(--warn))" },
  { name: "> 3 d", max: Infinity, color: "hsl(var(--bad))" },
];

export type DashConfig = {
  table: string;
  label: string;                                  // plural noun, e.g. "orders"
  dateField?: string;                             // default "created_at"
  statusField: string;
  statusColors?: Record<string, string>;
  moneyField?: string;                            // e.g. "total" → revenue KPIs
  openStatuses?: string[];                        // count as "open / actief"
  openLabel?: string;                             // KPI label for the open count
  dimensions?: { key: string; label: string }[]; // breakdown donuts
  extraFilter?: Record<string, any>;              // e.g. { fulfillment_status: "unfulfilled" }
  accent?: string;                                // trend chart tone
  resolvedAtFor?: (row: any) => string | null | undefined; // resolution timestamp → adds an "afhandeltijd" section
};

async function loadRows(table: string): Promise<any[]> {
  try { const { data, error } = await (supabase as any).from(table).select("*"); if (!error && data && data.length) return data; } catch { /* offline / no table */ }
  try { const raw = localStorage.getItem(`gb_${table}`); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}

export function ResourceDashboard(cfg: DashConfig) {
  const dateField = cfg.dateField ?? "created_at";
  const accent = cfg.accent ?? "hsl(var(--info))";
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [customDate, setCustomDate] = useState("");

  const load = async () => { setLoading(true); setAll(await loadRows(cfg.table)); setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cfg.table]);

  const rows = useMemo(() => {
    if (!cfg.extraFilter) return all;
    const ent = Object.entries(cfg.extraFilter);
    return all.filter((r) => ent.every(([k, v]) => String(r[k] ?? "") === String(v)));
  }, [all, cfg.extraFilter]);

  const rng = useMemo(() => rangeFor(period, customDate), [period, customDate]);
  const prevLabel = prevLabelFor(period);
  const cur = useMemo(() => rows.filter((r) => within(r[dateField], rng.s, rng.e)), [rows, rng, dateField]);
  const prev = useMemo(() => rows.filter((r) => within(r[dateField], rng.ps, rng.pe)), [rows, rng, dateField]);

  const isOpen = (r: any) => !!cfg.openStatuses && cfg.openStatuses.includes(String(r[cfg.statusField] ?? ""));
  const money = (arr: any[]) => arr.reduce((s, r) => s + Number(r[cfg.moneyField!] || 0), 0);

  const kpis = useMemo(() => {
    const k: { label: string; value: string; icon: ElementType; accent: string; delta: number }[] = [];
    k.push({ label: `Totaal ${cfg.label}`, value: String(cur.length), icon: Hash, accent, delta: pctDelta(cur.length, prev.length) });
    if (cfg.openStatuses) {
      const oc = cur.filter(isOpen).length, op = prev.filter(isOpen).length;
      k.push({ label: cfg.openLabel ?? "Open", value: String(oc), icon: Clock, accent: "hsl(var(--warn))", delta: pctDelta(oc, op) });
    }
    if (cfg.moneyField) {
      k.push({ label: "Omzet", value: eurC(money(cur)), icon: BadgeEuro, accent: "hsl(var(--ok))", delta: pctDelta(money(cur), money(prev)) });
      const aov = (a: any[]) => (a.length ? money(a) / a.length : 0);
      k.push({ label: "Gem. waarde", value: eurC(aov(cur)), icon: TrendingUp, accent: "hsl(var(--grape))", delta: pctDelta(aov(cur), aov(prev)) });
    } else {
      const doneC = cur.length - cur.filter(isOpen).length, doneP = prev.length - prev.filter(isOpen).length;
      k.push({ label: "Afgehandeld", value: String(doneC), icon: CheckCircle2, accent: "hsl(var(--ok))", delta: pctDelta(doneC, doneP) });
      const rate = (a: any[]) => (a.length ? Math.round(((a.length - a.filter(isOpen).length) / a.length) * 100) : 0);
      k.push({ label: "Afhandelingsgraad", value: `${rate(cur)}%`, icon: TrendingUp, accent: "hsl(var(--grape))", delta: pctDelta(rate(cur), rate(prev)) });
    }
    return k;
  }, [cur, prev]);

  const trend = useMemo(() => {
    const m = new Map<string, number>();
    cur.forEach((r) => { const d = dayOf(r[dateField]); m.set(d, (m.get(d) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  }, [cur, dateField]);

  const distFor = (key: string, colors?: Record<string, string>) => {
    const m = new Map<string, number>();
    cur.forEach((r) => { const v = String(r[key] ?? "").trim() || "onbekend"; m.set(v, (m.get(v) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value], i) => ({ name: cap(name), value, color: colors?.[name] ?? PALETTE[i % PALETTE.length] }));
  };
  const statusDonut = useMemo(() => distFor(cfg.statusField, cfg.statusColors), [cur]);
  const dims = useMemo(() => (cfg.dimensions ?? []).map((d) => ({ ...d, data: distFor(d.key) })), [cur]);

  // afhandeltijd — created → resolved duration for the rows resolved in this period
  const resolution = useMemo(() => {
    if (!cfg.resolvedAtFor) return null;
    const durs = cur
      .map((r) => { const rz = cfg.resolvedAtFor!(r); if (!rz) return null; const d = toMs(rz) - toMs(r[dateField]); return d > 0 ? d : null; })
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b);
    const sum = durs.reduce((s, d) => s + d, 0);
    let lo = 0;
    const buckets = RES_BUCKETS.map((b) => { const v = durs.filter((d) => d > lo && d <= b.max).length; lo = b.max; return { name: b.name, value: v, color: b.color }; });
    return {
      count: durs.length,
      avg: durs.length ? sum / durs.length : 0,
      median: durs.length ? durs[Math.floor(durs.length / 2)] : 0,
      min: durs[0] ?? 0,
      max: durs[durs.length - 1] ?? 0,
      buckets,
    };
  }, [cur, dateField]);

  if (loading) return <div className="py-16 grid place-items-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      {/* period filter + refresh */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Periode</span>
        {PERIODS.map((p) => (
          <button key={p.id} onClick={() => { setPeriod(p.id); setCustomDate(""); }}
            className={`h-8 px-3 rounded-full text-xs font-medium transition-all ${period === p.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs"}`}>
            {p.label}
          </button>
        ))}
        <label className={`h-8 px-2.5 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${period === "custom" ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs"}`}>
          <CalendarDays className="h-3.5 w-3.5" />
          <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setPeriod(e.target.value ? "custom" : "30d"); }} className="bg-transparent outline-none cursor-pointer" />
        </label>
        <button onClick={load} className="ml-auto h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Ververs</button>
      </div>

      {/* KPIs */}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={fadeUp} className="card-soft card-lift p-4">
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: `${k.accent}1a` }}><k.icon className="h-4 w-4" style={{ color: k.accent }} /></div>
              {k.delta !== 0 && <span className={`chip ${k.delta < 0 ? "chip-up" : "chip-down"}`}>{k.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{k.delta > 0 ? "+" : ""}{k.delta}%</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{k.label} <span className="text-muted-foreground/60">· vs {prevLabel}</span></p>
            <p className="font-num text-2xl font-bold tabular-nums text-foreground leading-none mt-1">{k.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* trend + status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard className="lg:col-span-2" title={`${cap(cfg.label)} over tijd`} subtitle={`Aantal per dag · ${cur.length} in periode`}>
          {trend.length === 0 ? <Empty label={cfg.label} /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <defs><linearGradient id="rdcount" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity={0.32} /><stop offset="100%" stopColor={accent} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, "Aantal"]} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} />
                  <Area type="monotone" dataKey="count" stroke={accent} strokeWidth={2.5} fill="url(#rdcount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
        <DonutCard title="Status" subtitle="Verdeling" data={statusDonut} centerValue={String(cur.length)} centerLabel={cfg.label} label={cfg.label} />
      </div>

      {/* dimension breakdowns */}
      {dims.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${dims.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
          {dims.map((d) => <DonutCard key={d.key} title={d.label} subtitle="Verdeling" data={d.data} centerValue={String(cur.length)} centerLabel={cfg.label} label={cfg.label} />)}
        </div>
      )}

      {/* afhandeltijd — only when a resolvedAt source is configured (e.g. tickets) */}
      {resolution && (
        <ChartCard title="Afhandeltijd" subtitle={resolution.count > 0 ? `Tijd van aanmaak tot afhandeling · ${resolution.count} afgehandeld in periode` : "Tijd van aanmaak tot afhandeling"}>
          {resolution.count === 0 ? <Empty label="afgehandelde items met tijdregistratie" /> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatTile label="Gemiddeld" value={fmtDur(resolution.avg)} tone="info" />
                <StatTile label="Mediaan" value={fmtDur(resolution.median)} tone="grape" />
                <StatTile label="Snelst" value={fmtDur(resolution.min)} tone="ok" />
                <StatTile label="Traagst" value={fmtDur(resolution.max)} tone="bad" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Verdeling van de afhandeltijd</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resolution.buckets} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={tooltipStyle} formatter={(v: any) => [v, "Afgehandeld"]} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]} barSize={46} isAnimationActive={false}>
                      {resolution.buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className={`card-soft p-5 ${className}`}>
      <div className="mb-4"><h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>{subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}</div>
      {children}
    </motion.div>
  );
}
function Empty({ label }: { label: string }) {
  return <div className="h-40 grid place-items-center text-center"><div><p className="text-sm font-medium text-foreground">Nog geen {label}</p><p className="text-xs text-muted-foreground mt-0.5">In deze periode is er niks te tonen.</p></div></div>;
}
function StatTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5"><span className="rounded-full shrink-0" style={{ background: `hsl(var(--${tone}))`, width: 7, height: 7 }} /><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p></div>
      <p className="font-num text-xl font-bold tabular-nums text-foreground leading-none mt-1.5">{value}</p>
    </div>
  );
}
function DonutCard({ title, subtitle, data, centerValue, centerLabel, label }: { title: string; subtitle?: string; data: { name: string; value: number; color: string }[]; centerValue: string; centerLabel: string; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {total === 0 ? <Empty label={label} /> : (
        <>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="text-center"><p className="font-num text-xl font-bold tabular-nums text-foreground leading-none">{centerValue}</p><p className="text-[10px] text-muted-foreground">{centerLabel}</p></div></div>
          </div>
          <div className="mt-3 space-y-1.5">
            {data.slice(0, 5).map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="text-foreground truncate flex-1">{d.name}</span>
                <span className="text-muted-foreground tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
