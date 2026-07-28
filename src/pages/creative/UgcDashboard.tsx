// UGC/creators dashboard — aggregates the Tracker (creator database) and Approval
// (collabs) boards into insight: who we work with, which content performs, the
// outreach funnel and the top creators. Reads the same gb_<table> source as the
// boards (supabase when online, localStorage otherwise), so it works offline.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import { Users2, Star, Repeat2, BadgeEuro, Handshake, Send, MessageCircle, Trophy, Loader2, Instagram } from "lucide-react";

type Row = Record<string, any>;

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
const tone = (t: string) => `hsl(var(--${t}))`;

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
    return [...m.entries()].map(([k, e]) => ({ k, total: e.total, top: e.top, rate: e.total ? e.score / (e.total * 2) : 0 })).sort((a, b) => b.rate - a.rate);
  }, [approval]);

  // which creator TYPE performs best — size + style of active/top collabs (joined to tracker)
  const winning = useMemo(() => {
    const rows = approval.filter((r) => r.status === "top performer" || r.status === "active").map((r) => trackerByName.get(norm(r.name).toLowerCase())).filter(Boolean) as Row[];
    return { size: dist(rows, "size"), style: dist(rows, "content_style") };
  }, [approval, trackerByName]);

  const topCreators = useMemo(() => approval
    .filter((r) => r.status === "top performer" || r.status === "active")
    .sort((a, b) => perfScore(b.status) - perfScore(a.status))
    .slice(0, 8)
    .map((r) => ({ r, t: trackerByName.get(norm(r.name).toLowerCase()) })), [approval, trackerByName]);

  const mix = useMemo(() => ({ size: dist(tracker, "size"), style: dist(tracker, "content_style"), breed: dist(tracker, "dog_breed"), location: dist(tracker, "location") }), [tracker]);

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const empty = tracker.length === 0 && approval.length === 0;
  if (empty) return (
    <div className="pt-10 flex flex-col items-center text-center">
      <div className="h-11 w-11 rounded-2xl bg-muted grid place-items-center mb-3"><Trophy className="h-5 w-5 text-muted-foreground" /></div>
      <p className="text-sm font-medium text-foreground">Nog geen data om te tonen</p>
      <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">Voeg creators toe in de Tracker en collabs in de Approval — dit dashboard vult zich automatisch.</p>
    </div>
  );

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Users2 className="h-4 w-4" />} label="Creators" value={kpi.creators} accent="ember" />
        <Kpi icon={<Handshake className="h-4 w-4" />} label="Actieve collabs" value={kpi.active} accent="ok" />
        <Kpi icon={<Trophy className="h-4 w-4" />} label="Top performers" value={kpi.top} accent="info" />
        <Kpi icon={<Repeat2 className="h-4 w-4" />} label="Reuse-rechten" value={kpi.reuse} accent="grape" />
        <Kpi icon={<BadgeEuro className="h-4 w-4" />} label="Betaling open" value={kpi.pendingPay} accent="warn" />
      </div>

      {/* Outreach funnel */}
      <motion.div variants={fadeUp} className="card-soft p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Outreach-funnel</h3>
        <div className="grid grid-cols-4 gap-2">
          <Funnel icon={<Users2 className="h-3.5 w-3.5" />} label="In database" value={kpi.creators} base={kpi.creators} accent="ember" />
          <Funnel icon={<Send className="h-3.5 w-3.5" />} label="Gecontacteerd" value={kpi.contacted} base={kpi.creators} accent="sun" />
          <Funnel icon={<MessageCircle className="h-3.5 w-3.5" />} label="Reactie" value={kpi.responded} base={kpi.creators} accent="info" />
          <Funnel icon={<Handshake className="h-3.5 w-3.5" />} label="Collab goedgekeurd" value={kpi.collabOk} base={kpi.creators} accent="ok" />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Creator mix — met welk type mensen werken we */}
        <motion.div variants={fadeUp} className="card-soft p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Met welk type creators werken we</h3>
          <BarList title="Grootte" data={mix.size} accent="ember" />
          <BarList title="Content-stijl" data={mix.style} accent="grape" />
          <BarList title="Hondenras" data={mix.breed} accent="info" />
          <BarList title="Locatie" data={mix.location} accent="sun" max={5} />
        </motion.div>

        {/* Content performance — welke content verkoopt beter */}
        <motion.div variants={fadeUp} className="card-soft p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Welke content presteert best</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Aandeel top-performers &amp; actieve collabs per formaat.</p>
          </div>
          {contentPerf.length === 0 ? <p className="text-xs text-muted-foreground">Nog geen collabs met een formaat.</p> : (
            <div className="space-y-2.5">
              {contentPerf.map((c) => (
                <div key={c.k}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground capitalize">{c.k}</span>
                    <span className="text-muted-foreground tabular-nums">{Math.round(c.rate * 100)}% · {c.total} collab{c.total === 1 ? "" : "s"}{c.top ? ` · ${c.top}★` : ""}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(4, c.rate * 100)}%`, background: tone("ok") }} /></div>
                </div>
              ))}
            </div>
          )}
          <div className="pt-1 border-t border-border/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Best presterende creator-type</p>
            <BarList title="Grootte (van top/actieve collabs)" data={winning.size} accent="info" />
            <BarList title="Stijl (van top/actieve collabs)" data={winning.style} accent="grape" />
          </div>
        </motion.div>
      </div>

      {/* Top creators */}
      <motion.div variants={fadeUp} className="card-soft p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Top creators</h3>
        {topCreators.length === 0 ? <p className="text-xs text-muted-foreground">Nog geen actieve of top-performing creators — markeer een collab als “active” of “top performer” in de Approval.</p> : (
          <div className="space-y-1.5">
            {topCreators.map(({ r, t }, i) => (
              <div key={(r.id ?? r.name ?? i) + ""} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <span className="h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0" style={{ background: r.status === "top performer" ? "hsl(var(--info)/0.14)" : "hsl(var(--ok)/0.12)", color: r.status === "top performer" ? tone("info") : tone("ok") }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate">{norm(r.name) || "—"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{[t && norm(t.size), t && norm(t.content_style), norm(r.tier)].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {norm(r.instagram) && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0"><Instagram className="h-3 w-3" />{norm(r.instagram)}</span>}
                {norm(r.deliverable_type) && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0" style={{ background: "hsl(var(--info)/0.1)", color: tone("info"), borderColor: "hsl(var(--info)/0.35)" }}>{norm(r.deliverable_type)}</span>}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={r.status === "top performer" ? { background: "hsl(var(--info)/0.14)", color: tone("info") } : { background: "hsl(var(--ok)/0.12)", color: tone("ok") }}>{r.status === "top performer" ? "top" : "actief"}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <motion.div variants={fadeUp} className="card-soft p-3.5">
      <div className="flex items-center gap-1.5" style={{ color: tone(accent) }}>{icon}<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span></div>
      <p className="font-num text-2xl font-bold tabular-nums mt-1 text-foreground">{value}</p>
    </motion.div>
  );
}

function Funnel({ icon, label, value, base, accent }: { icon: React.ReactNode; label: string; value: number; base: number; accent: string }) {
  const pct = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{icon}<span className="text-[10px] font-semibold uppercase tracking-wider truncate">{label}</span></div>
      <p className="font-num text-xl font-bold tabular-nums leading-none" style={{ color: tone(accent) }}>{value}</p>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: tone(accent) }} /></div>
      <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{pct}% van database</p>
    </div>
  );
}

function BarList({ title, data, accent, max = 6 }: { title: string; data: [string, number][]; accent: string; max?: number }) {
  const top = data.slice(0, max);
  const peak = Math.max(1, ...top.map(([, n]) => n));
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</p>
      {top.length === 0 ? <p className="text-xs text-muted-foreground/70">geen data</p> : (
        <div className="space-y-1">
          {top.map(([label, n]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[12px] text-foreground w-28 shrink-0 truncate capitalize">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(5, (n / peak) * 100)}%`, background: tone(accent) }} /></div>
              <span className="text-[11px] text-muted-foreground tabular-nums w-6 text-right shrink-0">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
