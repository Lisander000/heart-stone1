import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import { RefreshCw, ArrowUpRight, Activity } from "lucide-react";
import { rollupDaily, salesByChannel, costBreakdown } from "@/lib/finance";
import { CostTreemap } from "@/components/finance/CostTreemap";
import { SEED_AC, FORECAST_LS, type Scenario } from "@/pages/finance/ForecastActual";

/* Financial Overview = the Daily Tracker rolled up. Same source, same numbers as
   the home dashboard and the Daily Tracker itself. */
const PALETTE = ["hsl(var(--ember))", "hsl(var(--sun))", "hsl(var(--grape))", "hsl(var(--info))", "hsl(var(--ok))", "hsl(var(--warn))"];
const eurC = (v: number) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1000) return s + "€" + (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",") + "k"; return s + "€" + Math.round(a); };
const eur2 = (v: number) => "€" + v.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-md)" } as const;

async function loadDaily(): Promise<any[]> {
  try { const { data, error } = await (supabase as any).from("daily_metrics").select("*"); if (!error && data && data.length) return data; } catch { /* ignore */ }
  try { const raw = localStorage.getItem("gb_daily_metrics"); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}
async function loadActual(): Promise<Scenario> {
  try { const { data } = await (supabase as any).from("forecast_pl").select("actual").maybeSingle(); if (data?.actual) return data.actual; } catch { /* ignore */ }
  try { const raw = localStorage.getItem(FORECAST_LS); if (raw) return JSON.parse(raw).actual ?? SEED_AC; } catch { /* ignore */ }
  return SEED_AC;
}

export default function Finance() {
  const [daily, setDaily] = useState<any[]>([]);
  const [actual, setActual] = useState<Scenario>(SEED_AC);
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); const [d, ac] = await Promise.all([loadDaily(), loadActual()]); setDaily(d); setActual(ac); setLoading(false); };
  useEffect(() => { load(); }, []);

  const fin = useMemo(() => rollupDaily(daily), [daily]);
  const salesDonut = salesByChannel(fin).map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }));
  const total = salesDonut.reduce((s, d) => s + d.value, 0);
  const costData = useMemo(() => costBreakdown(actual), [actual]);
  const totalCost = costData.reduce((s, d) => s + d.value, 0);
  const trend = useMemo(() => {
    const n = (v: any) => Number(v) || 0;
    return [...daily].filter((d) => d.date).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-30)
      .map((d) => ({ date: d.date, net: n(d.net_sales), spend: n(d.meta_spend) + n(d.google_spend) + n(d.creator_sales) + n(d.bol_sales) + n(d.email_sales) + n(d.organic_sales) }));
  }, [daily]);

  const kpis = [
    { label: "Netto omzet", value: eurC(fin.net), accent: "hsl(var(--ok))" },
    { label: "Ad spend", value: eurC(fin.spend), accent: "hsl(var(--grape))" },
    { label: "Orders", value: String(fin.orders), accent: "hsl(var(--info))" },
    { label: "Avg AOV", value: eur2(fin.aov), accent: "hsl(var(--sun))" },
    { label: "Blended MER", value: fin.mer.toFixed(2), accent: "hsl(var(--ember))" },
    { label: "ROAS paid", value: fin.roasPaid.toFixed(2), accent: "hsl(var(--ok))" },
    { label: "Blended CAC", value: eur2(fin.cac), accent: "hsl(var(--bad))" },
    { label: "Dagen", value: String(fin.days), accent: "hsl(var(--muted-foreground))" },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Financial Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Roll-up van de <Link to="/daily-tracker" className="text-primary hover:underline">Daily Tracker</Link> — dezelfde cijfers als op het dashboard.
            </p>
          </motion.div>
          <button onClick={load}
            className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Ververs
          </button>
        </div>

        {fin.days === 0 && !loading ? (
          <div className="card-soft py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3"><Activity className="h-5 w-5 text-muted-foreground" /></div>
            <p className="text-sm font-semibold text-foreground mb-1">Nog geen cijfers</p>
            <p className="text-xs text-muted-foreground mb-4">Vul de <Link to="/daily-tracker" className="text-primary hover:underline">Daily Tracker</Link> in — dit overzicht rekent er automatisch mee.</p>
            <Link to="/daily-tracker" className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5">Naar Daily Tracker <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <motion.div variants={stagger(0.04)} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.map((k) => (
                <motion.div key={k.label} variants={fadeUp}>
                  <Link to="/daily-tracker" className="card-soft card-lift p-4 block">
                    <div className="flex items-center gap-1.5"><span className="dot" style={{ background: k.accent, width: 6, height: 6 }} /><p className="text-xs text-muted-foreground">{k.label}</p></div>
                    <p className="font-num text-2xl font-bold tabular-nums text-foreground leading-none mt-2">{k.value}</p>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* trend */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-foreground">Omzet & ad spend</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">Daily Tracker — laatste {trend.length} {trend.length === 1 ? "dag" : "dagen"}</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fnet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--ok))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--ok))" stopOpacity={0} /></linearGradient>
                        <linearGradient id="fspend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--grape))" stopOpacity={0.28} /><stop offset="100%" stopColor="hsl(var(--grape))" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                        tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => eurC(v)} width={48} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [eur2(v), n === "net" ? "Omzet" : "Ad spend"]} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} />
                      <Area type="monotone" dataKey="net" stroke="hsl(var(--ok))" strokeWidth={2.5} fill="url(#fnet)" />
                      <Area type="monotone" dataKey="spend" stroke="hsl(var(--grape))" strokeWidth={2} fill="url(#fspend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="rounded-sm" style={{ background: "hsl(var(--ok))", width: 10, height: 10 }} /> Omzet</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="rounded-sm" style={{ background: "hsl(var(--grape))", width: 10, height: 10 }} /> Ad spend</span>
                </div>
              </motion.div>

              {/* where the sales come from */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
                <h3 className="text-sm font-semibold text-foreground">Omzet per kanaal</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">Waar komt de omzet vandaan</p>
                <div className="relative h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={total ? salesDonut : [{ name: "—", value: 1, color: "hsl(var(--muted))" }]} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={2} stroke="none">
                        {(total ? salesDonut : [{ color: "hsl(var(--muted))" }]).map((d: any, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      {total > 0 && <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${eur2(v)} (${Math.round((v / total) * 100)}%)`, n]} />}
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <div className="text-center"><p className="font-num text-xl font-bold text-foreground leading-none tabular-nums">{eurC(fin.net)}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">omzet</p></div>
                  </div>
                </div>
                <div className="space-y-1.5 mt-3">
                  {salesDonut.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="dot" style={{ background: d.color }} />
                      <span className="text-muted-foreground flex-1">{d.name}</span>
                      <span className="font-medium text-foreground tabular-nums">{eurC(d.value)}</span>
                      <span className="text-muted-foreground tabular-nums w-9 text-right">{total ? Math.round((d.value / total) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* cost composition treemap — bigger block = bigger cost */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <h3 className="text-sm font-semibold text-foreground">Kostenverdeling</h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">Waaruit onze kosten bestaan · groter blok = grotere kost</p>
              {totalCost === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Nog geen kosten. Vul de <Link to="/finance/forecast" className="text-primary hover:underline">Forecast vs Actual</Link> in.</p>
              ) : (
                <CostTreemap data={costData} />
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

