import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import { RefreshCw, ArrowUpRight, TrendingUp, TrendingDown, RotateCcw, Clock, CheckCircle2, Percent, CalendarDays } from "lucide-react";
import { PERIODS, rangeFor, within, pctDelta, prevLabelFor, type Period } from "@/lib/period";
import { useSteps, useAllOutcomes } from "@/lib/returnsSteps";

const PALETTE = ["hsl(var(--ember))", "hsl(var(--sun))", "hsl(var(--grape))", "hsl(var(--info))", "hsl(var(--ok))", "hsl(var(--warn))", "hsl(var(--bad))", "hsl(var(--muted-foreground))"];
const eurC = (v: number) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1000) return s + "€" + (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",") + "k"; return s + "€" + Math.round(a); };
const eur2 = (v: number) => "€" + v.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s;
const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-md)" } as const;
const dayOf = (v: any) => { const t = String(v); return t.length <= 10 ? t : new Date(t).toISOString().slice(0, 10); };
const STATUS_COLOR: Record<string, string> = { requested: "hsl(var(--warn))", pending: "hsl(var(--warn))", approved: "hsl(var(--info))", received: "hsl(var(--info))", refunded: "hsl(var(--ok))", resolved: "hsl(var(--ok))", rejected: "hsl(var(--bad))" };
const isPending = (r: any) => !["refunded", "resolved", "rejected"].includes(r.status);

async function loadReturns(): Promise<any[]> {
  try { const { data, error } = await (supabase as any).from("returns").select("*"); if (!error && data && data.length) return data; } catch { /* ignore */ }
  try { const raw = localStorage.getItem("gb_returns"); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}

export default function ReturnsDashboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [customDate, setCustomDate] = useState("");

  const steps = useSteps("other"); // representative ladder for phase labels (both have 4 phases by default)
  const allOutcomes = useAllOutcomes();

  const load = async () => { setLoading(true); setRows(await loadReturns()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const rng = useMemo(() => rangeFor(period, customDate), [period, customDate]);
  const prevLabel = prevLabelFor(period);
  const cur = useMemo(() => rows.filter((r) => within(r.created_at, rng.s, rng.e)), [rows, rng]);
  const prev = useMemo(() => rows.filter((r) => within(r.created_at, rng.ps, rng.pe)), [rows, rng]);

  const refundSum = (arr: any[]) => arr.filter((r) => r.status === "refunded").reduce((s, r) => s + Number(r.refund_amount || 0), 0);
  const rate = (arr: any[]) => arr.length ? arr.filter((r) => r.status === "refunded").length / arr.length : 0;

  const kpis = [
    { label: "Totaal retouren", value: String(cur.length), icon: RotateCcw, accent: "hsl(var(--ember))", delta: pctDelta(cur.length, prev.length) },
    { label: "In behandeling", value: String(cur.filter(isPending).length), icon: Clock, accent: "hsl(var(--warn))", delta: pctDelta(cur.filter(isPending).length, prev.filter(isPending).length) },
    { label: "Terugbetaald", value: eurC(refundSum(cur)), icon: CheckCircle2, accent: "hsl(var(--ok))", delta: pctDelta(refundSum(cur), refundSum(prev)) },
    { label: "Refund rate", value: `${Math.round(rate(cur) * 100)}%`, icon: Percent, accent: "hsl(var(--grape))", delta: pctDelta(Math.round(rate(cur) * 100), Math.round(rate(prev) * 100)) },
  ];

  const trend = useMemo(() => {
    const m = new Map<string, { count: number; refund: number }>();
    cur.forEach((r) => { const d = dayOf(r.created_at); const c = m.get(d) ?? { count: 0, refund: 0 }; c.count++; if (r.status === "refunded") c.refund += Number(r.refund_amount || 0); m.set(d, c); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, count: v.count, refund: v.refund }));
  }, [cur]);

  const statusDonut = useMemo(() => {
    const m = new Map<string, number>();
    cur.forEach((r) => { const s = (r.status || "onbekend").toString(); m.set(s, (m.get(s) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, color: STATUS_COLOR[name] ?? "hsl(var(--muted-foreground))" }));
  }, [cur]);

  const reasonDonut = useMemo(() => {
    const m = new Map<string, number>();
    cur.forEach((r) => { const k = (r.reason || "Geen reden").toString().trim() || "Geen reden"; m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  }, [cur]);

  const refundByReason = useMemo(() => {
    const m = new Map<string, number>();
    cur.filter((r) => r.status === "refunded").forEach((r) => { const k = (r.reason || "Geen reden").toString().trim() || "Geen reden"; m.set(k, (m.get(k) ?? 0) + Number(r.refund_amount || 0)); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value], i) => ({ name: cap(name), value, color: PALETTE[i % PALETTE.length] }));
  }, [cur]);

  // acceptance per CS step — how many customers accept / reject which phase
  const stepStats = useMemo(() => steps.map((s, i) => {
    let accepted = 0, rejected = 0;
    cur.forEach((r) => { const o = allOutcomes[r.id]?.[i]; if (o === "accepted") accepted++; else if (o === "rejected") rejected++; });
    const total = accepted + rejected;
    return { name: `Stap ${i + 1}`, label: s.label, accepted, rejected, rate: total ? Math.round((accepted / total) * 100) : 0 };
  }), [steps, cur, allOutcomes]);
  const anyOutcomes = stepStats.some((s) => s.accepted + s.rejected > 0);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <div className="flex items-center gap-2.5">
              <span className="h-10 w-10 rounded-2xl grid place-items-center" style={{ background: "hsl(var(--bad)/0.12)" }}><RotateCcw className="h-5 w-5" style={{ color: "hsl(var(--bad))" }} /></span>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Returns dashboard</h1>
                <p className="text-sm text-muted-foreground">Retourvolume, uitkomsten & topredenen · vs {prevLabel}</p>
              </div>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Ververs
            </button>
            <Link to="/returns" className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all">Naar lijst <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </div>

        {/* period filter */}
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
        </div>

        {/* KPIs */}
        <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <motion.div key={k.label} variants={fadeUp} className="card-soft card-lift p-4">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: `${k.accent}1a` }}><k.icon className="h-4 w-4" style={{ color: k.accent }} /></div>
                {k.delta !== 0 && (
                  <span className={`chip ${k.delta < 0 ? "chip-up" : "chip-down"}`}>
                    {k.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{k.delta > 0 ? "+" : ""}{k.delta}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">{k.label}</p>
              <p className="font-num text-2xl font-bold tabular-nums text-foreground leading-none mt-1">{k.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard className="lg:col-span-2" title="Retouren over tijd" subtitle={`Aantal & terugbetaald per dag · ${cur.length} retouren`}>
            {trend.length === 0 ? <Empty /> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rcount" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--ember))" stopOpacity={0.32} /><stop offset="100%" stopColor="hsl(var(--ember))" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                      tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [n === "count" ? `${v} retouren` : eur2(v), n === "count" ? "Aantal" : "Terugbetaald"]} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--ember))" strokeWidth={2.5} fill="url(#rcount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <DonutCard title="Status" subtitle="Verdeling van de uitkomsten" data={statusDonut} centerValue={String(cur.length)} centerLabel="retouren" />
        </div>

        {/* charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DonutCard title="Top retourredenen" subtitle="Waarom klanten retourneren" data={reasonDonut} centerValue={String(cur.length)} centerLabel="retouren" />

          <ChartCard className="lg:col-span-2" title="Terugbetaald per reden" subtitle="Waar gaat het refundbedrag naartoe" icon={CheckCircle2}>
            {refundByReason.length === 0 ? <Empty /> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={refundByReason} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => eurC(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} width={120} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={tooltipStyle} formatter={(v: any) => [eur2(v), "Terugbetaald"]} />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={20}>
                      {refundByReason.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        {/* acceptance per CS step */}
        <ChartCard title="Acceptatie per fase" subtitle="Hoeveel klanten accepteren welke stap van het CS-stappenplan" icon={CheckCircle2}>
          {!anyOutcomes ? (
            <div className="h-40 grid place-items-center text-center"><div><p className="text-sm font-medium text-foreground">Nog geen fase-uitkomsten</p><p className="text-xs text-muted-foreground mt-0.5">Leg per retour vast of de klant een stap accepteert — dit vult zich dan.</p></div></div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stepStats} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={tooltipStyle} formatter={(v: any, n: any) => [v, n === "accepted" ? "Geaccepteerd" : "Afgewezen"]}
                      labelFormatter={(l) => { const s = stepStats.find((x) => x.name === l); return s ? `${l} · ${s.label}` : l; }} />
                    <Bar dataKey="accepted" name="accepted" fill="hsl(var(--ok))" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="rejected" name="rejected" fill="hsl(var(--bad))" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="rounded-sm" style={{ background: "hsl(var(--ok))", width: 10, height: 10 }} /> Geaccepteerd</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="rounded-sm" style={{ background: "hsl(var(--bad))", width: 10, height: 10 }} /> Afgewezen</span>
              </div>
              {/* per-step acceptance rate — this is an ACCEPTANCE rate, not a payout */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {stepStats.map((s, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-3">
                    <p className="text-[11px] text-muted-foreground truncate" title={s.label}>{s.name} · {s.label}</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <p className="font-num text-xl font-bold text-foreground tabular-nums leading-none">{s.rate}%</p>
                      <p className="text-[11px] text-muted-foreground">geaccepteerd</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{s.accepted} van {s.accepted + s.rejected} aangeboden</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/* ─── shared pieces (mirror the home dashboard) ──────────────────────────── */
function ChartCard({ title, subtitle, children, className = "", icon: Icon }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; icon?: any }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className={`card-soft p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function Empty() {
  return <div className="h-40 grid place-items-center text-center"><div><p className="text-sm font-medium text-foreground">Nog geen retouren</p><p className="text-xs text-muted-foreground mt-0.5">In deze periode is er niks te tonen.</p></div></div>;
}

function DonutCard({ title, subtitle, data, centerValue, centerLabel }: { title: string; subtitle?: string; data: { name: string; value: number; color: string }[]; centerValue: string; centerLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {total === 0 ? <Empty /> : (
        <>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={2} stroke="none">
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${v} (${Math.round((v / total) * 100)}%)`, cap(n)]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center"><p className="font-num text-2xl font-bold text-foreground leading-none tabular-nums">{centerValue}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">{centerLabel}</p></div>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {data.slice(0, 6).map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="dot" style={{ background: d.color }} />
                <span className="text-muted-foreground flex-1 truncate capitalize">{cap(d.name)}</span>
                <span className="font-medium text-foreground tabular-nums">{d.value}</span>
                <span className="text-muted-foreground tabular-nums w-9 text-right">{Math.round((d.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
