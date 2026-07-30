// UGC/creators dashboard — aggregates the Tracker (creator database) and Approval
// (collabs) boards into insight: who we work with, which content performs, the
// outreach funnel and the top creators. Reads the same gb_<table> source as the
// boards (supabase when online, localStorage otherwise), so it works offline.
// Uses recharts (funnel, donuts, bars) to match the ops-side dashboards.
import { useEffect, useMemo, useState, type ElementType } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import { Users2, Repeat2, BadgeEuro, Handshake, Trophy, Loader2, Instagram } from "lucide-react";

type Row = Record<string, any>;

const PALETTE = ["hsl(var(--info))", "hsl(var(--ember))", "hsl(var(--grape))", "hsl(var(--sun))", "hsl(var(--ok))", "hsl(var(--warn))", "hsl(var(--bad))", "hsl(var(--muted-foreground))"];
const tone = (t: string) => `hsl(var(--${t}))`;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-md)" } as const;

async function loadRows(table: string): Promise<Row[]> {
  try {
    const { error } = await (supabase as any).from(table).select("id").limit(1);
    if (!error) { const { data } = await (supabase as any).from(table).select("*"); if (data && data.length) return data as Row[]; }
  } catch { /* offline / no table → fall back */ }
  try { return JSON.parse(localStorage.getItem(`gb_${table}`) || "[]"); } catch { return []; }
}

const truthy = (v: any) => v === true || v === "true" || v === "yes" || v === 1;
const norm = (v: any) => (v ?? "").toString().trim();
const perfScore = (status: string) => (status === "top performer" ? 2 : status === "active" ? 1 : 0);
const dist = (rows: Row[], key: string): [string, number][] => {
  const m = new Map<string, number>();
  for (const r of rows) { const v = norm(r[key]); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const toDonut = (pairs: [string, number][], colorMap?: Record<string, string>) =>
  pairs.slice(0, 8).map(([name, value], i) => ({ name: cap(name), value, color: (colorMap && colorMap[name]) ?? PALETTE[i % PALETTE.length] }));

const STATUS_COLOR: Record<string, string> = { "top performer": "hsl(var(--info))", active: "hsl(var(--ok))", pending: "hsl(var(--warn))", negotiating: "hsl(var(--sun))", rejected: "hsl(var(--bad))", declined: "hsl(var(--bad))", ghosted: "hsl(var(--muted-foreground))" };

export default function UgcDashboard() {
  const [tracker, setTracker] = useState<Row[]>([]);
  const [approval, setApproval] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { const [t, a] = await Promise.all([loadRows("ugc_tracker"), loadRows("ugc_approval")]); setTracker(t); setApproval(a); setLoading(false); })(); }, []);

  const kpi = useMemo(() => ({
    creators: tracker.length,
    contacted: tracker.filter((r) => truthy(r.contacted)).length,
    responded: tracker.filter((r) => truthy(r.response)).length,
    collabOk: tracker.filter((r) => truthy(r.collab_ok)).length,
    active: approval.filter((r) => r.status === "active" || r.status === "top performer").length,
    top: approval.filter((r) => r.status === "top performer").length,
    reuse: approval.filter((r) => r.reuse === "yes").length,
    pendingPay: approval.filter((r) => r.paid === "pending payment").length,
  }), [tracker, approval]);

  const trackerByName = useMemo(() => { const m = new Map<string, Row>(); for (const r of tracker) { const n = norm(r.name).toLowerCase(); if (n) m.set(n, r); } return m; }, [tracker]);

  // content performance per deliverable format — top-performer/active share as the proxy for "sells better"
  const contentPerf = useMemo(() => {
    const m = new Map<string, { total: number; score: number; top: number }>();
    for (const r of approval) { const k = norm(r.deliverable_type); if (!k) continue; const e = m.get(k) ?? { total: 0, score: 0, top: 0 }; e.total++; e.score += perfScore(r.status); if (r.status === "top performer") e.top++; m.set(k, e); }
    return [...m.entries()].map(([k, e], i) => ({ name: cap(k), rate: e.total ? Math.round((e.score / (e.total * 2)) * 100) : 0, total: e.total, top: e.top, color: PALETTE[i % PALETTE.length] })).sort((a, b) => b.rate - a.rate);
  }, [approval]);

  // which creator TYPE performs best — size + style of active/top collabs (joined to tracker)
  const winning = useMemo(() => {
    const rows = approval.filter((r) => r.status === "top performer" || r.status === "active").map((r) => trackerByName.get(norm(r.name).toLowerCase())).filter(Boolean) as Row[];
    const bar = (pairs: [string, number][]) => pairs.slice(0, 6).map(([name, value], i) => ({ name: cap(name), value, color: PALETTE[i % PALETTE.length] }));
    return { size: bar(dist(rows, "size")), style: bar(dist(rows, "content_style")) };
  }, [approval, trackerByName]);

  const topCreators = useMemo(() => approval
    .filter((r) => r.status === "top performer" || r.status === "active")
    .sort((a, b) => perfScore(b.status) - perfScore(a.status))
    .slice(0, 8)
    .map((r) => ({ r, t: trackerByName.get(norm(r.name).toLowerCase()) })), [approval, trackerByName]);

  const statusDonut = useMemo(() => toDonut(dist(approval, "status"), STATUS_COLOR), [approval]);
  const sizeDonut = useMemo(() => toDonut(dist(tracker, "size")), [tracker]);
  const styleDonut = useMemo(() => toDonut(dist(tracker, "content_style")), [tracker]);
  const breedDonut = useMemo(() => toDonut(dist(tracker, "dog_breed")), [tracker]);

  const funnelData = useMemo(() => [
    { name: "In database", value: kpi.creators, fill: tone("ember") },
    { name: "Gecontacteerd", value: kpi.contacted, fill: tone("sun") },
    { name: "Reactie", value: kpi.responded, fill: tone("info") },
    { name: "Collab goedgekeurd", value: kpi.collabOk, fill: tone("ok") },
  ], [kpi]);

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const empty = tracker.length === 0 && approval.length === 0;
  if (empty) return (
    <div className="pt-10 flex flex-col items-center text-center">
      <div className="h-11 w-11 rounded-2xl bg-muted grid place-items-center mb-3"><Trophy className="h-5 w-5 text-muted-foreground" /></div>
      <p className="text-sm font-medium text-foreground">Nog geen data om te tonen</p>
      <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">Voeg creators toe in de Tracker en collabs in de Approval — dit dashboard vult zich automatisch.</p>
    </div>
  );

  const kpis: { label: string; value: number; icon: ElementType; tok: string }[] = [
    { label: "Creators", value: kpi.creators, icon: Users2, tok: "ember" },
    { label: "Actieve collabs", value: kpi.active, icon: Handshake, tok: "ok" },
    { label: "Top performers", value: kpi.top, icon: Trophy, tok: "info" },
    { label: "Reuse-rechten", value: kpi.reuse, icon: Repeat2, tok: "grape" },
    { label: "Betaling open", value: kpi.pendingPay, icon: BadgeEuro, tok: "warn" },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={fadeUp} className="card-soft card-lift p-4">
            <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: `hsl(var(--${k.tok}) / 0.12)` }}><k.icon className="h-4 w-4" style={{ color: tone(k.tok) }} /></div>
            <p className="text-xs text-muted-foreground mt-3">{k.label}</p>
            <p className="font-num text-2xl font-bold tabular-nums text-foreground leading-none mt-1">{k.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* funnel + collab-status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard className="lg:col-span-2" title="Outreach-funnel" subtitle="Van database naar goedgekeurde collab">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 0 }} barCategoryGap={12}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} width={132} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={tooltipStyle} formatter={(v: any) => [v, "Creators"]} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26} isAnimationActive={false}>
                  {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  <LabelList dataKey="value" position="right" fill="hsl(var(--foreground))" fontSize={12} formatter={(v: any) => `${v}  ·  ${kpi.creators ? Math.round((v / kpi.creators) * 100) : 0}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/60">Elke balk toont het aantal creators in die stap · % van de volledige database.</p>
        </ChartCard>
        <DonutCard title="Collab-status" subtitle="Verdeling van de collabs" data={statusDonut} centerValue={String(approval.length)} centerLabel="collabs" empty="collabs" />
      </div>

      {/* content performance per format */}
      <ChartCard title="Welke content presteert best" subtitle="Aandeel top-performers & actieve collabs per formaat">
        {contentPerf.length === 0 ? <Empty label="collabs met een formaat" /> : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contentPerf} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} width={110} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={tooltipStyle} formatter={(v: any, _n: any, p: any) => [`${v}% · ${p.payload.total} collab${p.payload.total === 1 ? "" : "s"}`, "Performance"]} />
                <Bar dataKey="rate" radius={[0, 5, 5, 0]} barSize={20} isAnimationActive={false}>
                  {contentPerf.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* creator mix — donuts */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Met welk type creators werken we</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DonutCard title="Grootte" subtitle="Volgergrootte" data={sizeDonut} centerValue={String(tracker.length)} centerLabel="creators" empty="creators" />
          <DonutCard title="Content-stijl" subtitle="Type content" data={styleDonut} centerValue={String(tracker.length)} centerLabel="creators" empty="creators" />
          <DonutCard title="Hondenras" subtitle="Ras van de hond" data={breedDonut} centerValue={String(tracker.length)} centerLabel="creators" empty="creators" />
        </div>
      </div>

      {/* best performing creator type — bars */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Best presterende creator-type <span className="font-normal text-muted-foreground">· op basis van top &amp; actieve collabs</span></p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Grootte" subtitle="Van top/actieve collabs">
            {winning.size.length === 0 ? <Empty label="top/actieve collabs" /> : <VBar data={winning.size} valueLabel="collabs" />}
          </ChartCard>
          <ChartCard title="Stijl" subtitle="Van top/actieve collabs">
            {winning.style.length === 0 ? <Empty label="top/actieve collabs" /> : <VBar data={winning.style} valueLabel="collabs" />}
          </ChartCard>
        </div>
      </div>

      {/* top creators leaderboard */}
      <ChartCard title="Top creators" subtitle="Actieve & top-performing collabs">
        {topCreators.length === 0 ? <p className="text-xs text-muted-foreground">Nog geen actieve of top-performing creators — markeer een collab als “active” of “top performer” in de Approval.</p> : (
          <div className="space-y-1.5">
            {topCreators.map(({ r, t }, i) => (
              <div key={(r.id ?? r.name ?? i) + ""} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <span className="h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0" style={{ background: r.status === "top performer" ? "hsl(var(--info) / 0.14)" : "hsl(var(--ok) / 0.12)", color: r.status === "top performer" ? tone("info") : tone("ok") }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate">{norm(r.name) || "—"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{[t && norm(t.size), t && norm(t.content_style), norm(r.tier)].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {norm(r.instagram) && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0"><Instagram className="h-3 w-3" />{norm(r.instagram)}</span>}
                {norm(r.deliverable_type) && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0" style={{ background: "hsl(var(--info) / 0.1)", color: tone("info"), borderColor: "hsl(var(--info) / 0.35)" }}>{norm(r.deliverable_type)}</span>}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={r.status === "top performer" ? { background: "hsl(var(--info) / 0.14)", color: tone("info") } : { background: "hsl(var(--ok) / 0.12)", color: tone("ok") }}>{r.status === "top performer" ? "top" : "actief"}</span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/* ─── shared pieces (mirror the ops dashboards) ──────────────────────────── */
function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className={`card-soft p-5 ${className}`}>
      <div className="mb-4"><h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>{subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}</div>
      {children}
    </motion.div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="h-40 grid place-items-center text-center"><div><p className="text-sm font-medium text-foreground">Nog geen {label}</p><p className="text-xs text-muted-foreground mt-0.5">Er is hier nog niks te tonen.</p></div></div>;
}

function VBar({ data, valueLabel }: { data: { name: string; value: number; color: string }[]; valueLabel: string }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
          <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={tooltipStyle} formatter={(v: any) => [v, valueLabel]} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} barSize={30} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutCard({ title, subtitle, data, centerValue, centerLabel, empty }: { title: string; subtitle?: string; data: { name: string; value: number; color: string }[]; centerValue: string; centerLabel: string; empty: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {total === 0 ? <Empty label={empty} /> : (
        <>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center"><p className="font-num text-2xl font-bold text-foreground leading-none tabular-nums">{centerValue}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">{centerLabel}</p></div>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {data.slice(0, 6).map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="text-muted-foreground flex-1 truncate capitalize">{d.name}</span>
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
