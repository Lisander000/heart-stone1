import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users2, ClipboardCheck, Layers, Plus, X, SlidersHorizontal, BarChart3, Clapperboard, ArrowLeft, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrackerBoard, { BoardConfig } from "./TrackerBoard";
import UgcDashboard from "./UgcDashboard";

/* ─── board configs ──────────────────────────────────────────────────────── */
const tracker: BoardConfig = {
  table: "ugc_tracker",
  title: "UGC Tracker",
  description: "Creator database · outreach en collab-status per creator.",
  autoId: { key: "nr", prefix: "" },
  fields: [
    { key: "nr",            label: "NR",              type: "readonly", w: "60px" },
    { key: "name",          label: "Name",            type: "text",     w: "140px" },
    { key: "instagram",     label: "Instagram",       type: "text",     w: "130px" },
    { key: "tiktok",        label: "TikTok",          type: "text",     w: "130px" },
    { key: "size",          label: "Size",            type: "select",   w: "110px",
      options: ["0-5K", "5-10K", "10-25K", "25-50K", "50K+"] },
    { key: "dog_breed",     label: "Dog breed",       type: "select",   w: "110px",
      options: ["small", "medium", "large"] },
    { key: "content_style", label: "Content style",   type: "select",   w: "140px",
      options: ["lifestyle", "how to", "humor", "documentary", "talking head", "UGC", "Mix"] },
    { key: "pricing",       label: "Pricing",         type: "text",     w: "110px" },
    { key: "portfolio",     label: "Portfolio",       type: "url",      w: "100px" },
    { key: "contact",       label: "Contact",         type: "text",     w: "140px" },
    { key: "location",      label: "Location",        type: "select",   w: "130px",
      options: ["BE", "NL", "FR", "DE", "IT", "ES", "UK", "US", "Rest of EU", "Rest of the world"] },
    { key: "address",       label: "Address",         type: "text",     w: "minmax(160px,1.2fr)" },
    { key: "contacted",     label: "Contacted?",      type: "check",    w: "100px" },
    { key: "response",      label: "Response?",       type: "check",    w: "100px" },
    { key: "collab_ok",     label: "Collab approved?", type: "check",   w: "130px" },
    { key: "notes",         label: "Notes",           type: "textarea", w: "minmax(200px,1.6fr)" },
  ],
};

const approval: BoardConfig = {
  table: "ugc_approval",
  title: "UGC Approval",
  description: "Approved collabs · product, deliverables, betaling en status.",
  statusKey: "status",
  fields: [
    { key: "name",             label: "Name",            type: "text",     w: "130px" },
    { key: "number",           label: "Number",          type: "text",     w: "120px" },
    { key: "email",            label: "Email",           type: "text",     w: "160px" },
    { key: "instagram",        label: "Instagram",       type: "text",     w: "130px" },
    { key: "product_sent",     label: "Product sent",    type: "select",   w: "150px", optionsKey: "products" },
    { key: "tier",             label: "Tier",            type: "select",   w: "120px", optionsKey: "tiers" },
    { key: "ship_date",        label: "Ship date",       type: "date",     w: "110px" },
    { key: "delivered",        label: "Delivered?",      type: "check",    w: "100px" },
    { key: "icp_target",       label: "ICP target",      type: "select",   w: "150px", optionsKey: "icp" },
    { key: "angle_hook",       label: "Angle / Hook",    type: "text",     w: "minmax(160px,1.2fr)" },
    { key: "deliverable_type", label: "Deliverable",     type: "select",   w: "120px",
      options: ["reel", "tiktok", "static", "story"], tones: { reel: "info", tiktok: "info", static: "idle", story: "info" } },
    { key: "video_link",       label: "Video link",      type: "url",      w: "100px" },
    { key: "affiliate_code",   label: "Affiliate code",  type: "text",     w: "130px" },
    { key: "post_date",        label: "Post date",       type: "date",     w: "110px" },
    { key: "reuse",            label: "Reuse permission", type: "select",  w: "140px",
      options: ["yes", "no"], tones: { yes: "ok", no: "bad" } },
    { key: "paid",             label: "Paid",            type: "select",   w: "160px",
      options: ["pending content", "in review", "pending payment", "payment sent"],
      tones: { "pending content": "idle", "in review": "info", "pending payment": "warn", "payment sent": "ok" } },
    { key: "status",           label: "Status",          type: "select",   w: "140px",
      options: ["inactive", "pending", "active", "top performer"],
      tones: { inactive: "idle", pending: "warn", active: "ok", "top performer": "info" } },
    { key: "contract_link",    label: "Contract link",   type: "url",      w: "100px" },
    { key: "notes",            label: "Notes",           type: "textarea", w: "minmax(200px,1.6fr)" },
  ],
};

const TABS = [
  { id: "tracker",  cfg: tracker,  icon: Users2,          accent: "hsl(var(--ember))", label: "Tracker",  blurb: "Creator database & outreach" },
  { id: "approval", cfg: approval, icon: ClipboardCheck,  accent: "hsl(var(--ok))",    label: "Approval", blurb: "Approved collabs & deliverables" },
] as const;

/* ─── option-list stores ─────────────────────────────────────────────────── */
const ICP_KEY = "gb_creative_icps";
const PRODUCTS_KEY = "gb_ugc_products";
const TIERS_KEY = "gb_ugc_tiers";
const readList = (key: string, fallback: string[]): string[] => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const readCount = (table: string): number => {
  try { const raw = localStorage.getItem(`gb_${table}`); return raw ? JSON.parse(raw).length : 0; } catch { return 0; }
};

/* ─── manage-list dialog (products / tiers) ──────────────────────────────── */
function ListManager({ open, onOpenChange, title, hint, items, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; hint: string;
  items: string[]; onSave: (next: string[]) => void;
}) {
  const [val, setVal] = useState("");
  const add = () => { const v = val.trim(); if (v && !items.includes(v)) { onSave([...items, v]); setVal(""); } };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-display text-lg">{title}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-2">{hint}</p>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {items.map((it) => (
            <div key={it} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-sm text-foreground">{it}</span>
              <button onClick={() => onSave(items.filter((x) => x !== it))} className="text-muted-foreground hover:text-bad"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nog niets ingesteld.</p>}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Nieuwe optie…" className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-ring/40" />
          <button onClick={add} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> Voeg toe</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */
function CreatorsStudio({ onBack }: { onBack?: () => void }) {
  const [active, setActive] = useState<"tracker" | "approval" | "dashboard" | null>(null);
  const [icps, setIcps] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [tiers, setTiers] = useState<string[]>([]);
  const [manage, setManage] = useState<null | "products" | "tiers">(null);
  const [refresh, setRefresh] = useState(0);
  const [counts, setCounts] = useState({ tracker: 0, approval: 0 });

  useEffect(() => {
    setIcps(readList(ICP_KEY, ["The Aesthetic", "The Lover"]));
    setProducts(readList(PRODUCTS_KEY, []));
    setTiers(readList(TIERS_KEY, ["Nano", "Micro", "Mid", "Macro"]));
  }, []);
  useEffect(() => {
    setCounts({ tracker: readCount("ugc_tracker"), approval: readCount("ugc_approval") });
  }, [active, refresh]);

  const saveProducts = (n: string[]) => { setProducts(n); localStorage.setItem(PRODUCTS_KEY, JSON.stringify(n)); };
  const saveTiers = (n: string[]) => { setTiers(n); localStorage.setItem(TIERS_KEY, JSON.stringify(n)); };

  const optionSets = useMemo(() => ({ icp: icps, products, tiers }), [icps, products, tiers]);

  const activeTab = TABS.find((t) => t.id === active);

  const approvalExtra = active === "approval" ? (
    <>
      <button onClick={() => setManage("products")}
        className="h-9 px-3 rounded-full border border-border bg-card shadow-xs text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5">
        <SlidersHorizontal className="h-3.5 w-3.5" /> Producten ({products.length})
      </button>
      <button onClick={() => setManage("tiers")}
        className="h-9 px-3 rounded-full border border-border bg-card shadow-xs text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5">
        <SlidersHorizontal className="h-3.5 w-3.5" /> Tiers ({tiers.length})
      </button>
    </>
  ) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-full px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }} className="flex items-center gap-2.5">
          {onBack && (
            <button onClick={onBack} title="Terug naar keuze" className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-xs transition-colors shrink-0"><ArrowLeft className="h-4 w-4" /></button>
          )}
          <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--grape)/0.12)" }}><Users2 className="h-5 w-5" style={{ color: "hsl(var(--grape))" }} /></span>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Creative · Creators</p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Creators</h1>
          </div>
        </motion.div>

        {/* selector cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TABS.map((t) => {
            const on = active === t.id;
            return (
              <button key={t.id} onClick={() => setActive(active === t.id ? null : t.id)}
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
          {/* dashboard card */}
          <button onClick={() => setActive(active === "dashboard" ? null : "dashboard")}
            className={`card-soft p-6 text-left transition-all duration-200 ${active === "dashboard" ? "ring-2 shadow-md" : "card-lift hover:shadow-md"}`}
            style={active === "dashboard" ? { boxShadow: "var(--shadow-md)", ["--tw-ring-color" as any]: "hsl(var(--grape))" } : undefined}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl grid place-items-center" style={{ background: "hsl(var(--grape)/0.1)" }}>
                <BarChart3 className="h-6 w-6" style={{ color: "hsl(var(--grape))" }} />
              </div>
            </div>
            <p className="font-semibold text-foreground text-base leading-tight">Dashboard</p>
            <p className="text-xs text-muted-foreground mt-1">Wie werkt, wat verkoopt, top creators</p>
          </button>
        </div>

        {/* active board */}
        {active === "dashboard" ? (
          <motion.div key="dashboard" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }} className="pt-1">
            <UgcDashboard />
          </motion.div>
        ) : activeTab ? (
          <motion.div key={active} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }} className="pt-1">
            <TrackerBoard
              config={activeTab.cfg}
              embedded
              optionSets={optionSets}
              headerExtra={approvalExtra}
              onRows={() => setRefresh((r) => r + 1)}
            />
          </motion.div>
        ) : (
          <div className="pt-6 flex flex-col items-center justify-center text-center">
            <div className="h-11 w-11 rounded-2xl bg-muted grid place-items-center mb-3">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Kies een view hierboven</p>
            <p className="text-xs text-muted-foreground mt-0.5">Selecteer Tracker, Approval of Dashboard. Klik nogmaals op een actieve kaart om ze te sluiten.</p>
          </div>
        )}
      </div>

      <ListManager open={manage === "products"} onOpenChange={(o) => !o && setManage(null)}
        title="Producten beheren" hint="Deze verschijnen als opties bij 'Product sent'."
        items={products} onSave={saveProducts} />
      <ListManager open={manage === "tiers"} onOpenChange={(o) => !o && setManage(null)}
        title="Tiers beheren" hint="Deze verschijnen als opties bij 'Tier'."
        items={tiers} onSave={saveTiers} />
    </div>
  );
}

/* ─── choose UGC (Trybe) vs Creators (our system) ────────────────────────── */
const TRYBE_URL = "https://jointrybe.com/brand?b=deb6c7fd-2acd-48fa-bfa6-a9f98113b8f9";

export default function UgcStudio() {
  const [mode, setMode] = useState<"ugc" | "creators" | null>(null);

  if (mode === "creators") return <CreatorsStudio onBack={() => setMode(null)} />;

  if (mode === "ugc") {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-6 py-7 space-y-5">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setMode(null)} title="Terug naar keuze" className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-xs transition-colors shrink-0"><ArrowLeft className="h-4 w-4" /></button>
            <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--grape)/0.12)" }}><Clapperboard className="h-5 w-5" style={{ color: "hsl(var(--grape))" }} /></span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Creative · UGC</p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">UGC via Trybe</h1>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card-soft p-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center mb-4" style={{ background: "hsl(var(--grape)/0.12)" }}><Clapperboard className="h-7 w-7" style={{ color: "hsl(var(--grape))" }} /></div>
            <h2 className="font-display text-lg font-semibold text-foreground">UGC loopt via Trybe</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">Briefs uitsturen, creators betalen en je UGC-content ontvangen doe je in ons Trybe-account. Klik hieronder om Trybe te openen.</p>
            <a href={TRYBE_URL} target="_blank" rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
              Open Trybe <ExternalLink className="h-4 w-4" />
            </a>
          </motion.div>
        </div>
      </div>
    );
  }

  // first choice: UGC or Creators
  const choices = [
    { id: "ugc" as const, icon: Clapperboard, title: "UGC", blurb: "User-generated content — briefs, betalingen en levering via Trybe.", tag: "via Trybe" },
    { id: "creators" as const, icon: Users2, title: "Creators", blurb: "Onze eigen creator-database: outreach, approval & dashboard.", tag: "ons systeem" },
  ];
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-7 space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-2.5">
          <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--grape)/0.12)" }}><Clapperboard className="h-5 w-5" style={{ color: "hsl(var(--grape))" }} /></span>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Creative</p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">UGC / creators</h1>
          </div>
        </motion.div>
        <p className="text-sm text-muted-foreground">Waarmee wil je werken?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {choices.map((c) => (
            <button key={c.id} onClick={() => setMode(c.id)} className="card-soft card-lift p-7 text-left hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl grid place-items-center" style={{ background: "hsl(var(--grape)/0.1)" }}>
                  <c.icon className="h-6 w-6" style={{ color: "hsl(var(--grape))" }} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted rounded-full px-2.5 py-1">{c.tag}</span>
              </div>
              <p className="font-semibold text-foreground text-lg leading-tight">{c.title}</p>
              <p className="text-sm text-muted-foreground mt-1.5">{c.blurb}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
