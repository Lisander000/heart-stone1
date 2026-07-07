import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Layers, Quote, Users, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrackerBoard, { BoardConfig } from "./TrackerBoard";

/* ─── shared option sets ─────────────────────────────────────────────────── */
const STATUS = {
  key: "status", label: "Status", type: "select" as const, w: "150px",
  options: ["waiting_for_feedback", "revision", "approved"],
  tones: { waiting_for_feedback: "warn", revision: "info", approved: "ok" } as any,
};
const PERF = {
  key: "performance", label: "Performance", type: "select" as const, w: "130px",
  options: ["untested", "killed", "tested", "worked", "winner"],
  tones: { untested: "idle", killed: "bad", tested: "info", worked: "ok", winner: "ok" } as any,
};

/* ─── board configs ──────────────────────────────────────────────────────── */
const angles: BoardConfig = {
  table: "creative_angles", title: "angles", description: "Marketing angles per ICP · funnel + awareness stage.",
  statusKey: "performance", autoId: { key: "code", prefix: "AN" },
  fields: [
    { key: "code",        label: "ID",             type: "readonly", w: "80px" },
    { key: "angle",       label: "Angle",          type: "text",     w: "minmax(160px,1.3fr)" },
    { key: "core",        label: "Core message",   type: "textarea", w: "minmax(200px,1.6fr)" },
    { key: "icp",         label: "ICP",            type: "select",   w: "150px", optionsKey: "icp" },
    { key: "funnel",      label: "Funnel",         type: "select",   w: "90px", options: ["TOF", "MOF", "BOF"] },
    { key: "awareness",   label: "Awareness",      type: "select",   w: "150px", options: ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] },
    { key: "pain_desire", label: "Pain / Desire",  type: "text",     w: "minmax(150px,1fr)" },
    STATUS, PERF,
  ],
};

const concepts: BoardConfig = {
  table: "creative_concepts", title: "creative concepts", description: "Concepts per angle · video of static.",
  statusKey: "performance", autoId: { key: "code", prefix: "CC" },
  fields: [
    { key: "code",     label: "ID",        type: "readonly", w: "80px" },
    { key: "format",   label: "Format",    type: "select",   w: "110px", options: ["video", "static"], tones: { video: "info", static: "idle" } as any },
    { key: "creator",  label: "Creator",   type: "text",     w: "130px" },
    { key: "inspo",    label: "Inspo link",type: "url",      w: "110px" },
    { key: "angle_id", label: "Angle ID",  type: "select",   w: "130px", optionsKey: "angle_ids" },
    STATUS, PERF,
  ],
};

const hooks: BoardConfig = {
  table: "creative_hooks", title: "hooks", description: "Hook lines per concept & angle.",
  statusKey: "performance", autoId: { key: "code", prefix: "H" },
  fields: [
    { key: "code",       label: "ID",         type: "readonly", w: "70px" },
    { key: "text",       label: "Hook",       type: "textarea", w: "minmax(240px,2fr)" },
    { key: "category",   label: "Category",   type: "text",     w: "130px" },
    { key: "concept_id", label: "Concept ID", type: "select",   w: "130px", optionsKey: "concept_ids" },
    { key: "angle_id",   label: "Angle ID",   type: "select",   w: "130px", optionsKey: "angle_ids" },
    STATUS, PERF,
  ],
};

const TABS = [
  { id: "angles",   cfg: angles,   icon: Lightbulb, label: "Angles",           blurb: "De strategische invalshoeken" },
  { id: "concepts", cfg: concepts, icon: Layers,    label: "Creative Concepts", blurb: "Uitwerkingen per angle" },
  { id: "hooks",    cfg: hooks,    icon: Quote,     label: "Hooks",            blurb: "De openingslijnen" },
] as const;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const ICP_KEY = "gb_creative_icps";
const readCodes = (table: string, key: string): string[] => {
  try { const raw = localStorage.getItem(`gb_${table}`); if (!raw) return []; return (JSON.parse(raw) as any[]).map((r) => r[key]).filter(Boolean); }
  catch { return []; }
};
const readCount = (table: string): number => {
  try { const raw = localStorage.getItem(`gb_${table}`); return raw ? JSON.parse(raw).length : 0; } catch { return 0; }
};

/* ─── page ────────────────────────────────────────────────────────────────── */
export default function CreativeStudio() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"] | null>(null);
  const [icps, setIcps] = useState<string[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [newIcp, setNewIcp] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [counts, setCounts] = useState({ angles: 0, concepts: 0, hooks: 0 });

  useEffect(() => {
    const raw = localStorage.getItem(ICP_KEY);
    setIcps(raw ? JSON.parse(raw) : ["The Aesthetic", "The Lover"]);
  }, []);
  useEffect(() => {
    setCounts({ angles: readCount("creative_angles"), concepts: readCount("creative_concepts"), hooks: readCount("creative_hooks") });
  }, [active, refresh]);

  const saveIcps = (next: string[]) => { setIcps(next); localStorage.setItem(ICP_KEY, JSON.stringify(next)); };

  const optionSets = useMemo(() => ({
    icp: icps,
    angle_ids: readCodes("creative_angles", "code"),
    concept_ids: readCodes("creative_concepts", "code"),
  }), [icps, active, refresh]);

  const activeTab = TABS.find((t) => t.id === active);

  const manageBtn = active === "angles" ? (
    <button onClick={() => setManageOpen(true)}
      className="h-9 px-3 rounded-full border border-border bg-card shadow-xs text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5">
      <Users className="h-3.5 w-3.5" /> ICP's ({icps.length})
    </button>
  ) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-full px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Creative Concepts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Angles → concepts → hooks. Kies een board om te bewerken.</p>
        </motion.div>

        {/* selector cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TABS.map((t) => {
            const on = active === t.id;
            const accent = t.id === "angles" ? "hsl(var(--ember))" : t.id === "concepts" ? "hsl(var(--info))" : "hsl(var(--sun))";
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`card-soft p-5 text-left transition-all duration-200 ${on ? "ring-2 shadow-md" : "card-lift hover:shadow-md"}`}
                style={on ? { boxShadow: "var(--shadow-md)", ["--tw-ring-color" as any]: accent } : undefined}>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: `${accent}1a` }}>
                    <t.icon className="h-5 w-5" style={{ color: accent }} />
                  </div>
                  <span className="font-num text-2xl font-bold tabular-nums" style={{ color: on ? accent : "hsl(var(--muted-foreground))" }}>
                    {counts[t.id] ?? 0}
                  </span>
                </div>
                <p className="font-semibold text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.blurb}</p>
              </button>
            );
          })}
        </div>

        {/* active board (embedded) — only once a card is chosen */}
        {activeTab ? (
          <motion.div key={active} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }} className="pt-1">
            <TrackerBoard
              config={activeTab.cfg}
              embedded
              optionSets={optionSets}
              headerExtra={manageBtn}
              onRows={() => setRefresh((r) => r + 1)}
            />
          </motion.div>
        ) : (
          <div className="pt-6 flex flex-col items-center justify-center text-center">
            <div className="h-11 w-11 rounded-2xl bg-muted grid place-items-center mb-3">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Kies een board hierboven</p>
            <p className="text-xs text-muted-foreground mt-0.5">Selecteer Angles, Creative Concepts of Hooks om de tabel te openen.</p>
          </div>
        )}
      </div>

      {/* ICP manager */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display text-lg">ICP's beheren</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">Deze verschijnen als opties in de ICP-dropdown bij Angles.</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {icps.map((ic) => (
              <div key={ic} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <span className="text-sm text-foreground">{ic}</span>
                <button onClick={() => saveIcps(icps.filter((x) => x !== ic))} className="text-muted-foreground hover:text-bad"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {icps.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nog geen ICP's.</p>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input value={newIcp} onChange={(e) => setNewIcp(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newIcp.trim()) { saveIcps([...icps, newIcp.trim()]); setNewIcp(""); } }}
              placeholder="Nieuwe ICP…" className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-ring/40" />
            <button onClick={() => { if (newIcp.trim()) { saveIcps([...icps, newIcp.trim()]); setNewIcp(""); } }}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> Voeg toe</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
