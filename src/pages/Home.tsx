import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { CostTreemap } from "@/components/finance/CostTreemap";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import {
  Wallet, Activity, RefreshCw, ArrowUpRight, TrendingUp, TrendingDown,
  ShoppingCart, PackageOpen, RotateCcw, LifeBuoy, ClipboardList, CalendarDays,
} from "lucide-react";
import { rollupDaily, salesByChannel, costBreakdown } from "@/lib/finance";
import { PERIODS, rangeFor, within, pctDelta, prevLabelFor, type Period } from "@/lib/period";
import { SEED_AC, FORECAST_LS, type Scenario } from "./finance/ForecastActual";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const GREET = () => { const h = new Date().getHours(); return h < 12 ? "Goedemorgen" : h < 18 ? "Goedemiddag" : "Goedenavond"; };
const PALETTE = ["hsl(var(--ember))", "hsl(var(--sun))", "hsl(var(--grape))", "hsl(var(--info))", "hsl(var(--ok))", "hsl(var(--warn))", "hsl(var(--bad))", "hsl(var(--muted-foreground))"];
const eurC = (v: number) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1000) return s + "€" + (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",") + "k"; return s + "€" + Math.round(a); };
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s;

const loadArr = async (table: string, lsKey = `gb_${table}`): Promise<any[]> => {
  try { const { data, error } = await (supabase as any).from(table).select("*"); if (!error && data && data.length) return data; } catch { /* table may not exist */ }
  try { const raw = localStorage.getItem(lsKey); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
};
/* the "actual" P&L scenario (Forecast vs Actual page) — for the cost breakdown */
const loadActual = async (): Promise<Scenario> => {
  try { const { data } = await (supabase as any).from("forecast_pl").select("actual").maybeSingle(); if (data?.actual) return data.actual; } catch { /* ignore */ }
  try { const raw = localStorage.getItem(FORECAST_LS); if (raw) return JSON.parse(raw).actual ?? SEED_AC; } catch { /* ignore */ }
  return SEED_AC;
};
/* group an array by a key, with a fallback label */
const groupBy = (arr: any[], key: string, fallback = "Onbekend") => {
  const m = new Map<string, number>();
  arr.forEach((r) => { const v = (r[key] ?? "").toString().trim() || fallback; m.set(v, (m.get(v) ?? 0) + 1); });
  return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};


/* ─── main ────────────────────────────────────────────────────────────────── */
export default function Home() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<any[]>([]);
  const [actual, setActual] = useState<Scenario>(SEED_AC);
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>("30d");
  const [customDate, setCustomDate] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setName((user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "").split(" ")[0]);
    const [d, ac, o, r, s, t] = await Promise.all([
      loadArr("daily_metrics", "gb_daily_metrics"),
      loadActual(),
      loadArr("orders"), loadArr("returns"), loadArr("shipments"), loadArr("tickets"),
    ]);
    setDaily(d); setActual(ac); setOrders(o); setReturns(r); setShipments(s); setTickets(t);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  /* ── period-filtered data + deltas vs the previous equal period ── */
  const rng = useMemo(() => rangeFor(period, customDate), [period, customDate]);
  const prevLabel = prevLabelFor(period);

  const dailyCur = useMemo(() => daily.filter((d) => within(d.date, rng.s, rng.e)), [daily, rng]);
  const dailyPrev = useMemo(() => daily.filter((d) => within(d.date, rng.ps, rng.pe)), [daily, rng]);
  const ordersCur = useMemo(() => orders.filter((o) => within(o.created_at, rng.s, rng.e)), [orders, rng]);
  const ordersPrev = useMemo(() => orders.filter((o) => within(o.created_at, rng.ps, rng.pe)), [orders, rng]);
  const returnsCur = useMemo(() => returns.filter((r) => within(r.created_at, rng.s, rng.e)), [returns, rng]);
  const returnsPrev = useMemo(() => returns.filter((r) => within(r.created_at, rng.ps, rng.pe)), [returns, rng]);
  const shipmentsCur = useMemo(() => shipments.filter((s) => within(s.created_at, rng.s, rng.e)), [shipments, rng]);
  const ticketsCur = useMemo(() => tickets.filter((t) => within(t.created_at, rng.s, rng.e)), [tickets, rng]);
  const ticketsPrev = useMemo(() => tickets.filter((t) => within(t.created_at, rng.ps, rng.pe)), [tickets, rng]);

  /* finance = Daily Tracker roll-up (period-filtered) */
  const fin = useMemo(() => rollupDaily(dailyCur), [dailyCur]);
  const finPrev = useMemo(() => rollupDaily(dailyPrev), [dailyPrev]);
  const salesDonut = salesByChannel(fin).map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }));
  const costData = useMemo(() => costBreakdown(actual), [actual]);

  const revTrend = useMemo(() => {
    const n = (v: any) => Number(v) || 0;
    return [...dailyCur]
      .filter((d) => d.date)
      .sort((x, y) => String(x.date).localeCompare(String(y.date)))
      .map((d) => ({
        date: d.date,
        net: n(d.net_sales),
        spend: n(d.meta_spend) + n(d.google_spend) + n(d.creator_sales) + n(d.bol_sales) + n(d.email_sales) + n(d.organic_sales),
      }));
  }, [dailyCur]);

  /* operations (period-filtered) + deltas */
  const isUnfulfilled = (o: any) => o.fulfillment_status && o.fulfillment_status !== "fulfilled";
  const isOpenReturn = (r: any) => !["refunded", "resolved", "rejected"].includes(r.status);
  const isOpenTicket = (t: any) => ["open", "pending"].includes(t.status);
  const unfulfilled = ordersCur.filter(isUnfulfilled).length;
  const openReturns = returnsCur.filter(isOpenReturn).length;
  const openTickets = ticketsCur.filter(isOpenTicket).length;
  const dOrders = pctDelta(ordersCur.length, ordersPrev.length);
  const dUnfulfilled = pctDelta(unfulfilled, ordersPrev.filter(isUnfulfilled).length);
  const dReturns = pctDelta(openReturns, returnsPrev.filter(isOpenReturn).length);
  const dTickets = pctDelta(openTickets, ticketsPrev.filter(isOpenTicket).length);

  const returnsByReason = groupBy(returnsCur, "reason", "Geen reden").slice(0, 7).map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }));
  const fulfillMap: Record<string, string> = { unfulfilled: "hsl(var(--bad))", partial: "hsl(var(--warn))", fulfilled: "hsl(var(--ok))" };
  const fulfillDonut = groupBy(ordersCur, "fulfillment_status", "onbekend").map((x) => ({ ...x, color: fulfillMap[x.name] ?? "hsl(var(--muted-foreground))" }));
  const statusMap: Record<string, string> = { paid: "hsl(var(--ok))", open: "hsl(var(--warn))", cancelled: "hsl(var(--bad))", refunded: "hsl(var(--grape))" };
  const orderStatusBars = groupBy(ordersCur, "status", "onbekend").map((x) => ({ ...x, color: statusMap[x.name] ?? "hsl(var(--info))" }));
  const shipmentDonut = groupBy(shipmentsCur, "status", "onbekend").map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }));

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {GREET()}{name ? `, ${name}` : ""} <span className="align-middle">👋</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Je finance- en operations-cockpit in één oogopslag.</p>
          </motion.div>
          <button onClick={load}
            className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Ververs
          </button>
        </div>

        {/* ── Period filter ── */}
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
            <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setPeriod(e.target.value ? "custom" : "30d"); }}
              className="bg-transparent outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]" style={{ colorScheme: "inherit" }} />
          </label>
          <span className="text-[11px] text-muted-foreground ml-1">vs {prevLabel}</span>
        </div>

        {/* ══════════════ FINANCE ══════════════ */}
        <section className="space-y-4">
          <SectionHead icon={Wallet} accent="hsl(var(--ok))" title="Finance" subtitle={`Roll-up van de Daily Tracker · vs ${prevLabel}`} to="/daily-tracker" />

          <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Netto omzet" value={eurC(fin.net)} delta={pctDelta(fin.net, finPrev.net)} good accent="hsl(var(--ok))" to="/daily-tracker" />
            <Kpi label="Orders" value={String(fin.orders)} sub={`AOV ${eurC(fin.aov)}`} delta={pctDelta(fin.orders, finPrev.orders)} good accent="hsl(var(--info))" to="/daily-tracker" />
            <Kpi label="Ad spend" value={eurC(fin.spend)} sub={`ROAS paid ${fin.roasPaid.toFixed(2)}`} accent="hsl(var(--grape))" to="/daily-tracker" />
            <Kpi label="Blended MER" value={fin.mer.toFixed(2)} delta={pctDelta(fin.mer, finPrev.mer)} good accent="hsl(var(--ember))" to="/daily-tracker" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue & ad spend trend (from the Daily Tracker) */}
            <ChartCard className="lg:col-span-2" title="Omzet & ad spend" subtitle={revTrend.length ? `Daily Tracker — laatste ${revTrend.length} ${revTrend.length === 1 ? "dag" : "dagen"}` : "Uit de Daily Tracker"}>
              {revTrend.length === 0 ? <Empty /> : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revTrend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gnet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--ok))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--ok))" stopOpacity={0} /></linearGradient>
                          <linearGradient id="gspend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--grape))" stopOpacity={0.28} /><stop offset="100%" stopColor="hsl(var(--grape))" stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                          tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} minTickGap={24} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => eurC(v)} width={48} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [eurC(v), n === "net" ? "Omzet" : "Ad spend"]} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} />
                        <Area type="monotone" dataKey="net" stroke="hsl(var(--ok))" strokeWidth={2.5} fill="url(#gnet)" />
                        <Area type="monotone" dataKey="spend" stroke="hsl(var(--grape))" strokeWidth={2} fill="url(#gspend)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <Legend2 items={[{ name: "Omzet", color: "hsl(var(--ok))" }, { name: "Ad spend", color: "hsl(var(--grape))" }]} />
                </>
              )}
            </ChartCard>

            {/* Where the net sales come from (Daily Tracker channels) */}
            <DonutCard title="Omzet per kanaal" subtitle="Waar komt de omzet vandaan" data={salesDonut} centerValue={eurC(fin.net)} centerLabel="omzet" to="/daily-tracker" />
          </div>

          {/* Cost composition — bigger block = bigger cost (from the P&L actual) */}
          <ChartCard title="Kostenverdeling" subtitle="Waaruit onze kosten bestaan · groter blok = grotere kost" icon={Wallet}>
            {costData.length === 0 ? <Empty /> : <CostTreemap data={costData} />}
          </ChartCard>
        </section>

        {/* ══════════════ OPERATIONS ══════════════ */}
        <section className="space-y-4">
          <SectionHead icon={Activity} accent="hsl(var(--ember))" title="Operations" subtitle={`Orders, fulfilment, returns & support · vs ${prevLabel}`} to="/ops" />

          <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi split label="Orders" value={String(ordersCur.length)} delta={dOrders} good icon={ShoppingCart} accent="hsl(var(--info))" to="/orders" />
            <Kpi split label="Onvervuld" value={String(unfulfilled)} delta={dUnfulfilled} icon={PackageOpen} accent="hsl(var(--warn))" to="/unfulfilled" tone={unfulfilled > 0 ? "warn" : undefined} />
            <Kpi split label="Open returns" value={String(openReturns)} delta={dReturns} icon={RotateCcw} accent="hsl(var(--bad))" to="/returns" tone={openReturns > 0 ? "bad" : undefined} />
            <Kpi split label="Open tickets" value={String(openTickets)} delta={dTickets} icon={LifeBuoy} accent="hsl(var(--grape))" to="/tickets" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DonutCard title="Returns per reden" subtitle="Meest voorkomende retourredenen" data={returnsByReason} centerValue={String(returns.length)} centerLabel="returns" to="/returns" />
            <DonutCard title="Orders — fulfilment" subtitle="Hoeveel orders (on)vervuld zijn" data={fulfillDonut} centerValue={String(orders.length)} centerLabel="orders" to="/unfulfilled" />
            <DonutCard title="Shipments — status" subtitle="Verzendingen in beweging" data={shipmentDonut} centerValue={String(shipments.length)} centerLabel="shipments" to="/shipments" />
          </div>

          <ChartCard title="Orders per status" subtitle="Betaalstatus over alle orders" icon={ClipboardList}>
            {orderStatusBars.length === 0 ? <Empty /> : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderStatusBars} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} width={90} tickFormatter={cap} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={tooltipStyle} formatter={(v: any) => [v, "orders"]} />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={22}>
                      {orderStatusBars.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </section>
      </div>
    </div>
  );
}

/* ─── small pieces ───────────────────────────────────────────────────────── */
const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-md)" } as const;

function SectionHead({ icon: Icon, title, subtitle, accent, to }: { icon: any; title: string; subtitle: string; accent: string; to?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: `${accent}1a` }}><Icon className="h-5 w-5" style={{ color: accent }} /></div>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold text-foreground leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {to && <Link to={to} className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0">Bekijken <ArrowUpRight className="h-3 w-3" /></Link>}
    </div>
  );
}

function Kpi({ label, value, sub, delta, good, accent, icon: Icon, to, tone, split }: {
  label: string; value: string; sub?: string; delta?: number; good?: boolean; accent: string; icon?: any; to?: string; tone?: "warn" | "bad"; split?: boolean;
}) {
  const valueColor = tone === "bad" ? "hsl(var(--bad))" : tone === "warn" ? "hsl(var(--warn))" : "hsl(var(--foreground))";

  // split → icon + label on the left, a big number filling the right of the card
  if (split) {
    const inner = (
      <motion.div variants={fadeUp} className="card-soft card-lift p-4 h-full flex items-center gap-3">
        <div className="min-w-0">
          <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: `${accent}1a` }}>
            {Icon ? <Icon className="h-4 w-4" style={{ color: accent }} /> : <span className="dot" style={{ background: accent, width: 8, height: 8 }} />}
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-2.5 whitespace-nowrap">{label}</p>
          {delta != null && delta !== 0 && (
            <span className={`chip mt-1.5 ${(good ? delta > 0 : delta < 0) ? "chip-up" : "chip-down"}`}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{delta > 0 ? "+" : ""}{delta}%
            </span>
          )}
        </div>
        <p className="ml-auto pr-1 font-num font-bold tabular-nums leading-none text-[2.75rem] self-start" style={{ color: valueColor }}>{value}</p>
      </motion.div>
    );
    return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
  }

  const body = (
    <motion.div variants={fadeUp} className="card-soft card-lift p-4 h-full">
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: `${accent}1a` }}>
          {Icon ? <Icon className="h-4 w-4" style={{ color: accent }} /> : <span className="dot" style={{ background: accent, width: 8, height: 8 }} />}
        </div>
        {delta != null && delta !== 0 && (
          <span className={`chip ${(good ? delta > 0 : delta < 0) ? "chip-up" : "chip-down"}`}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{delta > 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="font-num text-2xl font-bold leading-none tabular-nums" style={{ color: tone === "bad" ? "hsl(var(--bad))" : tone === "warn" ? "hsl(var(--warn))" : "hsl(var(--foreground))" }}>{value}</p>
        {sub && <span className="text-xs text-muted-foreground mb-0.5">{sub}</span>}
      </div>
    </motion.div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

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

function Legend2({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-3">
      {items.map((i) => (
        <div key={i.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-sm" style={{ background: i.color, width: 10, height: 10 }} /> {i.name}
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="h-40 grid place-items-center text-center"><div><p className="text-sm font-medium text-foreground">Nog geen data</p><p className="text-xs text-muted-foreground mt-0.5">Voeg records toe om de grafiek te vullen.</p></div></div>;
}

function DonutCard({ title, subtitle, data, centerValue, centerLabel, to }: {
  title: string; subtitle?: string; data: { name: string; value: number; color: string }[]; centerValue: string; centerLabel: string; to?: string;
}) {
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
              <div className="text-center">
                <p className="font-num text-2xl font-bold text-foreground leading-none tabular-nums">{centerValue}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{centerLabel}</p>
              </div>
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
      {to && <Link to={to} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">Details <ArrowUpRight className="h-3 w-3" /></Link>}
    </ChartCard>
  );
}

