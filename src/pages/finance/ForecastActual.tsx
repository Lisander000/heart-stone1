import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Cloud, HardDriveDownload } from "lucide-react";

/* ─── model ──────────────────────────────────────────────────────────────── */
export type Scenario = Record<string, number>;
const n = (v: any) => Number(v) || 0;

/* Derived P&L figures — same formulas as the GB Forecast vs Actual sheet. */
export function derive(d: Scenario) {
  const netRevenue = n(d.gross) - n(d.vat);
  const totalNetRevenue = netRevenue - n(d.returns);
  const totalVariable = n(d.cogs) + n(d.shipping) + n(d.payment) + n(d.creator) + n(d.bol);
  const cm = totalNetRevenue - totalVariable;
  const cmPct = totalNetRevenue ? cm / totalNetRevenue : 0;
  const totalMarketing = n(d.meta) + n(d.google);
  const totalFixed = n(d.tools) + n(d.team) + n(d.office) + n(d.other);
  const netProfit = cm - totalMarketing;
  const netMargin = totalNetRevenue ? netProfit / totalNetRevenue : 0;
  return { netRevenue, totalNetRevenue, totalVariable, cm, cmPct, totalMarketing, totalFixed, netProfit, netMargin };
}
type Derived = ReturnType<typeof derive>;

/* ─── row spec ───────────────────────────────────────────────────────────── */
type Row =
  | { kind: "section"; label: string; inputKey?: string }                                  // cream header (optionally with editable %)
  | { kind: "input"; label: string; key: string; fmt: "eur" | "pct"; role?: "orange" }
  | { kind: "calc"; label: string; get: (c: Derived) => number; fmt: "eur" | "pct"; role?: "total" | "orange" | "green" | "sub" }
  | { kind: "spacer" };

const ROWS: Row[] = [
  { kind: "input", label: "Revenue (Gross)", key: "gross", fmt: "eur" },
  { kind: "input", label: "VAT", key: "vat", fmt: "eur" },
  { kind: "calc",  label: "Net Revenue", get: (c) => c.netRevenue, fmt: "eur", role: "sub" },
  { kind: "input", label: "Returns €", key: "returns", fmt: "eur" },
  { kind: "calc",  label: "Total Net Revenue", get: (c) => c.totalNetRevenue, fmt: "eur", role: "total" },

  { kind: "section", label: "Variable Costs" },
  { kind: "input", label: "Total COGS", key: "cogs", fmt: "eur" },
  { kind: "input", label: "Total Shipping", key: "shipping", fmt: "eur" },
  { kind: "input", label: "Total Payment processing", key: "payment", fmt: "eur" },
  { kind: "input", label: "Total Creator commission", key: "creator", fmt: "eur" },
  { kind: "input", label: "Total Bol fees", key: "bol", fmt: "eur" },
  { kind: "input", label: "COGS % per order", key: "cogs_pct", fmt: "pct", role: "orange" },
  { kind: "input", label: "Shipping % per order", key: "shipping_pct", fmt: "pct", role: "orange" },
  { kind: "input", label: "Payment processing % per order", key: "payment_pct", fmt: "pct", role: "orange" },
  { kind: "input", label: "Avg. creator commission %", key: "creator_pct", fmt: "pct", role: "orange" },
  { kind: "calc",  label: "Total Variable Costs", get: (c) => c.totalVariable, fmt: "eur", role: "total" },

  { kind: "section", label: "Contribution Margin" },
  { kind: "calc",  label: "Contribution Margin", get: (c) => c.cm, fmt: "eur", role: "total" },
  { kind: "calc",  label: "Contribution Margin %", get: (c) => c.cmPct, fmt: "pct", role: "orange" },

  { kind: "section", label: "Marketing Spend", inputKey: "marketing_pct" },
  { kind: "input", label: "Meta ad spend", key: "meta", fmt: "eur" },
  { kind: "input", label: "Google ad spend", key: "google", fmt: "eur" },
  { kind: "calc",  label: "Total Marketing Spend", get: (c) => c.totalMarketing, fmt: "eur", role: "total" },

  { kind: "section", label: "Fixed Costs of Business" },
  { kind: "input", label: "Tools", key: "tools", fmt: "eur" },
  { kind: "input", label: "Team", key: "team", fmt: "eur" },
  { kind: "input", label: "Office/Warehouse", key: "office", fmt: "eur" },
  { kind: "input", label: "Other", key: "other", fmt: "eur" },
  { kind: "calc",  label: "Total Fixed Costs", get: (c) => c.totalFixed, fmt: "eur", role: "total" },

  { kind: "spacer" },
  { kind: "calc", label: "Net Profit €", get: (c) => c.netProfit, fmt: "eur", role: "green" },
  { kind: "calc", label: "Net Margin %", get: (c) => c.netMargin, fmt: "pct", role: "green" },
];

/* ─── formatting ─────────────────────────────────────────────────────────── */
const eur = (v: number) => "€" + v.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => (v * 100).toFixed(2) + "%";
const fmtVal = (v: number, f: "eur" | "pct") => (f === "eur" ? eur(v) : pct(v));

/* ─── seed (matches the sheet so the page reads like the template out of the box) ── */
export const SEED_FC: Scenario = { gross: 200000, vat: 42000, returns: 5000, cogs: 100000, shipping: 20, payment: 700, creator: 300, bol: 12000, cogs_pct: 0.30, shipping_pct: 0.02, payment_pct: 0.02, creator_pct: 0.30, marketing_pct: 0.03, meta: 10000, google: 10000, tools: 7000, team: 10, office: 10, other: 10 };
export const SEED_AC: Scenario = { gross: 200000, vat: 42000, returns: 42000, cogs: 60000, shipping: 20, payment: 8000, creator: 30000, bol: 1200, cogs_pct: 0.30, shipping_pct: 0.025, payment_pct: 0.02, creator_pct: 0.30, marketing_pct: 0.03, meta: 1000, google: 1000, tools: 7000, team: 10, office: 10, other: 10 };
export const FORECAST_LS = "gb_forecast_pl";

const LS = FORECAST_LS;
async function detectBackend(): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from("forecast_pl").select("id").limit(1);
  return error ? "local" : "supabase";
}

/* ─── page ───────────────────────────────────────────────────────────────── */
export default function ForecastActual() {
  const [fc, setFc] = useState<Scenario>(SEED_FC);
  const [ac, setAc] = useState<Scenario>(SEED_AC);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [uid, setUid] = useState("");
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUid(user?.id ?? "");
      const be = await detectBackend();
      setBackend(be);
      if (be === "supabase") {
        const { data } = await (supabase as any).from("forecast_pl").select("*").maybeSingle();
        if (data) { setFc({ ...SEED_FC, ...(data.forecast ?? {}) }); setAc({ ...SEED_AC, ...(data.actual ?? {}) }); }
      } else {
        const raw = localStorage.getItem(LS);
        if (raw) { const j = JSON.parse(raw); setFc({ ...SEED_FC, ...(j.forecast ?? {}) }); setAc({ ...SEED_AC, ...(j.actual ?? {}) }); }
        else localStorage.setItem(LS, JSON.stringify({ forecast: SEED_FC, actual: SEED_AC }));
      }
      setLoading(false);
    })();
  }, []);

  const persist = (nextFc: Scenario, nextAc: Scenario) => {
    if (backend === "local") { localStorage.setItem(LS, JSON.stringify({ forecast: nextFc, actual: nextAc })); return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await (supabase as any).from("forecast_pl")
        .upsert({ user_id: uid, forecast: nextFc, actual: nextAc, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) toast.error(error.message);
    }, 500);
  };

  const setVal = (scenario: "f" | "a", key: string, value: number) => {
    if (scenario === "f") { const nx = { ...fc, [key]: value }; setFc(nx); persist(nx, ac); }
    else { const nx = { ...ac, [key]: value }; setAc(nx); persist(fc, nx); }
  };

  const cF = derive(fc), cA = derive(ac);

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-7 space-y-5">
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}
          className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Forecast vs Actual</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Begroot versus werkelijk · volledige P&amp;L. Vul Forecast en Actual in — de totalen rekenen mee.</p>
          </div>
          <span className="h-9 px-3 rounded-full border border-border bg-card shadow-xs text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            {backend === "supabase" ? <><Cloud className="h-3.5 w-3.5 text-ok" /> Synced</> : <><HardDriveDownload className="h-3.5 w-3.5 text-warn" /> Lokaal</>}
          </span>
        </motion.div>

        <div className="card-soft overflow-hidden">
          {/* header */}
          <div className="grid bg-primary text-primary-foreground" style={{ gridTemplateColumns: "minmax(240px,2fr) minmax(150px,1fr) minmax(150px,1fr)" }}>
            <div className="px-4 py-3 text-sm font-bold">Revenue Stream</div>
            <div className="px-4 py-3 text-sm font-bold text-right">Forecast 2026</div>
            <div className="px-4 py-3 text-sm font-bold text-right">Actual 2026</div>
          </div>

          {loading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="grid px-4 py-3.5 border-b border-border/50" style={{ gridTemplateColumns: "minmax(240px,2fr) minmax(150px,1fr) minmax(150px,1fr)" }}>
                {Array.from({ length: 3 }).map((__, j) => <div key={j} className="h-3.5 rounded-full shimmer mr-4" />)}
              </div>
            ))
          ) : (
            ROWS.map((r, i) => <PLRow key={i} row={r} fc={fc} ac={ac} cF={cF} cA={cA} onEdit={setVal} />)
          )}
        </div>

        {backend === "local" && !loading && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="dot" style={{ background: "hsl(var(--warn))" }} />
            Lokale modus — data in deze browser. Pas migratie <span className="font-medium text-foreground">forecast_pl</span> toe in Supabase voor teamsync.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── one P&L row ────────────────────────────────────────────────────────── */
const GRID = "minmax(240px,2fr) minmax(150px,1fr) minmax(150px,1fr)";

function PLRow({ row, fc, ac, cF, cA, onEdit }: {
  row: Row; fc: Scenario; ac: Scenario; cF: Derived; cA: Derived; onEdit: (s: "f" | "a", k: string, v: number) => void;
}) {
  if (row.kind === "spacer") return <div className="h-3 border-b border-border/40" />;

  if (row.kind === "section") {
    return (
      <div className="grid border-b border-border/60" style={{ gridTemplateColumns: GRID, background: "hsl(var(--ember) / 0.10)" }}>
        <div className="px-4 py-2.5 text-[13px] font-bold text-foreground">{row.label}</div>
        {row.inputKey ? (
          <>
            <EditCell value={fc[row.inputKey] ?? 0} fmt="pct" bold onCommit={(v) => onEdit("f", row.inputKey!, v)} />
            <EditCell value={ac[row.inputKey] ?? 0} fmt="pct" bold onCommit={(v) => onEdit("a", row.inputKey!, v)} />
          </>
        ) : (<><div /><div /></>)}
      </div>
    );
  }

  // styling role → bg + text
  const role = (row as any).role as string | undefined;
  const rowStyle =
    role === "orange" ? { background: "hsl(var(--ember))" } :
    role === "green"  ? { background: "hsl(var(--ok))" } :
    role === "total"  ? { background: "hsl(var(--muted))" } : undefined;
  const textCls =
    role === "orange" ? "text-white" :
    role === "green"  ? "text-white font-bold" :
    role === "total"  ? "text-foreground font-bold" :
    role === "sub"    ? "text-muted-foreground" : "text-foreground";
  const border = role === "total" || role === "green" ? "border-t border-border" : "border-b border-border/50";

  const fV = row.kind === "calc" ? row.get(cF) : 0;
  const aV = row.kind === "calc" ? row.get(cA) : 0;

  return (
    <div className={`grid ${border}`} style={{ gridTemplateColumns: GRID, ...rowStyle }}>
      <div className={`px-4 py-2.5 text-[13px] ${textCls}`}>{row.label}</div>
      {row.kind === "input" ? (
        <>
          <EditCell value={fc[row.key] ?? 0} fmt={row.fmt} orange={role === "orange"} onCommit={(v) => onEdit("f", row.key, v)} />
          <EditCell value={ac[row.key] ?? 0} fmt={row.fmt} orange={role === "orange"} onCommit={(v) => onEdit("a", row.key, v)} />
        </>
      ) : (
        <>
          <div className={`px-4 py-2.5 text-[13px] text-right tabular-nums ${textCls}`}>{fmtVal(fV, row.fmt)}</div>
          <div className={`px-4 py-2.5 text-[13px] text-right tabular-nums ${textCls}`}>{fmtVal(aV, row.fmt)}</div>
        </>
      )}
    </div>
  );
}

/* ─── editable value cell (always mounted → native Tab works) ────────────── */
function EditCell({ value, fmt, onCommit, orange, bold }: {
  value: number; fmt: "eur" | "pct"; onCommit: (v: number) => void; orange?: boolean; bold?: boolean;
}) {
  const [foc, setFoc] = useState(false);
  const [draft, setDraft] = useState("");
  const shown = value === 0 ? "" : fmtVal(value, fmt);
  const raw = value === 0 ? "" : fmt === "pct" ? String(+(value * 100).toFixed(4)) : String(value);
  const txt = orange ? "text-white placeholder:text-white/50" : "text-foreground placeholder:text-muted-foreground/30";

  return (
    <input
      inputMode="decimal"
      value={foc ? draft : shown}
      placeholder="—"
      onFocus={(e) => { setFoc(true); setDraft(raw); requestAnimationFrame(() => e.target.select()); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setFoc(false); let x = parseFloat(draft.replace(",", ".")) || 0; if (fmt === "pct") x = x / 100; onCommit(x); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
      className={`px-4 py-2.5 text-[13px] text-right w-full bg-transparent outline-none rounded-2xl tabular-nums transition-colors focus:bg-card focus:ring-2 focus:ring-inset focus:ring-primary/40 ${bold ? "font-bold" : ""} ${txt}`}
    />
  );
}
