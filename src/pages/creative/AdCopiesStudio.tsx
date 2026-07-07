import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Package, Lightbulb, AlertCircle, HelpCircle, Layers } from "lucide-react";
import TrackerBoard, { BoardConfig, Field } from "./TrackerBoard";

/* ─── shared status + performance ────────────────────────────────────────── */
const STATUS: Field = {
  key: "status", label: "Status", type: "select", w: "150px",
  options: ["waiting_for_feedback", "revision", "approved"],
  tones: { waiting_for_feedback: "warn", revision: "info", approved: "ok" },
};
const PERF: Field = {
  key: "performance", label: "Performance", type: "select", w: "130px",
  options: ["untested", "killed", "tested", "worked", "winner"],
  tones: { untested: "idle", killed: "bad", tested: "info", worked: "ok", winner: "ok" },
};

/* ─── one config per awareness stage ─────────────────────────────────────── */
const makeConfig = (table: string, title: string, prefix: string): BoardConfig => ({
  table, title, description: `Ad copies · ${title.toLowerCase()} · EN + NL, gekoppeld aan angle / concept / hook.`,
  statusKey: "performance", autoId: { key: "code", prefix },
  fields: [
    { key: "code",       label: "ID",         type: "readonly", w: "110px" },
    { key: "english",    label: "English",    type: "textarea", w: "minmax(220px,1.6fr)" },
    { key: "dutch",      label: "Dutch",      type: "textarea", w: "minmax(220px,1.6fr)" },
    { key: "angle_id",   label: "Angle ID",   type: "select",   w: "120px", optionsKey: "angle_ids" },
    { key: "concept_id", label: "Concept ID", type: "select",   w: "120px", optionsKey: "concept_ids" },
    { key: "hook_id",    label: "Hook ID",    type: "select",   w: "110px", optionsKey: "hook_ids" },
    STATUS, PERF,
  ],
});

const TABS = [
  { id: "most",     table: "ad_copies_most_aware",     label: "Most aware",     prefix: "AC-MSA", icon: Flame,       accent: "hsl(var(--ok))",    blurb: "Klaar om te kopen" },
  { id: "product",  table: "ad_copies_product_aware",  label: "Product aware",  prefix: "AC-PDA", icon: Package,     accent: "hsl(var(--ember))", blurb: "Kent het product" },
  { id: "solution", table: "ad_copies_solution_aware", label: "Solution aware", prefix: "AC-SOA", icon: Lightbulb,   accent: "hsl(var(--sun))",   blurb: "Kent de oplossing" },
  { id: "problem",  table: "ad_copies_problem_aware",  label: "Problem aware",  prefix: "AC-PRA", icon: AlertCircle, accent: "hsl(var(--info))",  blurb: "Voelt het probleem" },
  { id: "unaware",  table: "ad_copies_unaware",        label: "Unaware",        prefix: "AC-UNA", icon: HelpCircle,  accent: "hsl(var(--grape))", blurb: "Nog geen besef" },
].map((t) => ({ ...t, cfg: makeConfig(t.table, t.label, t.prefix) }));

/* ─── cross-reference codes from the creative studio ─────────────────────── */
const readCodes = (table: string): string[] => {
  try { const raw = localStorage.getItem(`gb_${table}`); if (!raw) return []; return (JSON.parse(raw) as any[]).map((r) => r.code).filter(Boolean); }
  catch { return []; }
};
const readCount = (table: string): number => {
  try { const raw = localStorage.getItem(`gb_${table}`); return raw ? JSON.parse(raw).length : 0; } catch { return 0; }
};

/* ─── page ────────────────────────────────────────────────────────────────── */
export default function AdCopiesStudio() {
  const [active, setActive] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const c: Record<string, number> = {};
    TABS.forEach((t) => { c[t.id] = readCount(t.table); });
    setCounts(c);
  }, [active, refresh]);

  const optionSets = useMemo(() => ({
    angle_ids: readCodes("creative_angles"),
    concept_ids: readCodes("creative_concepts"),
    hook_ids: readCodes("creative_hooks"),
  }), [active, refresh]);

  const activeTab = TABS.find((t) => t.id === active);

  return (
    <div className="min-h-screen">
      <div className="max-w-full px-6 py-7 space-y-5">
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Ad Copies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Per awareness-stage. Kies een board om de copies te bewerken.</p>
        </motion.div>

        {/* 5 selector blocks — 3 per row (2 rows) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TABS.map((t) => {
            const on = active === t.id;
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`card-soft p-6 text-left transition-all duration-200 ${on ? "ring-2 shadow-md" : "card-lift hover:shadow-md"}`}
                style={on ? { boxShadow: "var(--shadow-md)", ["--tw-ring-color" as any]: t.accent } : undefined}>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl grid place-items-center" style={{ background: `${t.accent}1a` }}>
                    <t.icon className="h-6 w-6" style={{ color: t.accent }} />
                  </div>
                  <span className="font-num text-3xl font-bold tabular-nums" style={{ color: on ? t.accent : "hsl(var(--muted-foreground))" }}>
                    {counts[t.id] ?? 0}
                  </span>
                </div>
                <p className="font-semibold text-foreground text-base leading-tight">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.blurb}</p>
              </button>
            );
          })}
        </div>

        {/* active board */}
        {activeTab ? (
          <motion.div key={active} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }} className="pt-1">
            <TrackerBoard
              config={activeTab.cfg}
              embedded
              optionSets={optionSets}
              onRows={() => setRefresh((r) => r + 1)}
            />
          </motion.div>
        ) : (
          <div className="pt-6 flex flex-col items-center justify-center text-center">
            <div className="h-11 w-11 rounded-2xl bg-muted grid place-items-center mb-3">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Kies een awareness-stage hierboven</p>
            <p className="text-xs text-muted-foreground mt-0.5">Selecteer een stage om de ad copies te openen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
