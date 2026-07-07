import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, HardDriveDownload, Cloud } from "lucide-react";
import { fadeUp, stagger } from "@/lib/motion";
import { ConfirmDelete } from "@/components/ConfirmDelete";

/* ─── model ──────────────────────────────────────────────────────────────── */
type Day = {
  id: string;
  date: string;              // yyyy-mm-dd
  net_sales: number; orders: number; returning_rate: number;
  creator_sales: number; bol_sales: number; email_sales: number; organic_sales: number; paid_sales: number;
  meta_spend: number; google_spend: number;
  impressions: number; clicks: number; atc: number; checkouts: number;
  note?: string | null;
};

const LS_KEY = "gb_daily_metrics";
const NUM_KEYS: (keyof Day)[] = [
  "net_sales","orders","returning_rate","creator_sales","bol_sales","email_sales","organic_sales",
  "paid_sales","meta_spend","google_spend","impressions","clicks","atc","checkouts",
];

function blankDay(date: string): Day {
  return {
    id: crypto.randomUUID(), date,
    net_sales: 0, orders: 0, returning_rate: 0,
    creator_sales: 0, bol_sales: 0, email_sales: 0, organic_sales: 0, paid_sales: 0,
    meta_spend: 0, google_spend: 0, impressions: 0, clicks: 0, atc: 0, checkouts: 0,
  };
}

/* ─── derived formulas (from GB Command Center · Daily Report) ────────────── */
function derive(d: Day) {
  const paid     = d.meta_spend + d.google_spend;                                    // paid ads = meta + google
  const adSpend  = paid + d.creator_sales + d.bol_sales + d.email_sales + d.organic_sales; // total = paid + overige kanalen
  const firstRate = 1 - d.returning_rate;
  const newCust  = d.orders * firstRate;
  return {
    week:        isoWeek(d.date),
    aov:         d.orders ? d.net_sales / d.orders : 0,
    firstRate,
    paid,
    adSpend,
    netMER:      adSpend ? d.net_sales / adSpend : 0,
    blendedROAS: adSpend ? d.net_sales / adSpend : 0,
    roasPaid:    paid ? d.net_sales / paid : 0,                                       // return op paid ads
    blendedCAC:  newCust ? adSpend / newCust : 0,
    cpm:         d.impressions ? (adSpend / d.impressions) * 1000 : 0,
    cpc:         d.clicks ? adSpend / d.clicks : 0,
    ctr:         d.impressions ? d.clicks / d.impressions : 0,
    cpAtc:       d.atc ? adSpend / d.atc : 0,
    cpCheckout:  d.checkouts ? adSpend / d.checkouts : 0,
    cpa:         d.orders ? adSpend / d.orders : 0,
  };
}

function isoWeek(iso: string) {
  const dt = new Date(iso + "T00:00:00");
  const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/* date helpers — work on local y/m/d only, never toISOString (avoids UTC off-by-one) */
const pad2 = (n: number) => String(n).padStart(2, "0");
const toISO = (dt: Date) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const addDaysISO = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); return toISO(new Date(y, m - 1, d + n)); };
const todayISO = () => toISO(new Date());

const eur = (n: number) => "€" + n.toLocaleString("nl-BE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const eur2 = (n: number) => "€" + n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toFixed(0) + "%";
const x2 = (n: number) => n.toFixed(2);
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

/* ─── column spec: input (editable) + computed (derived) ──────────────────── */
type Col =
  | { kind: "input"; key: keyof Day; label: string; fmt: "int" | "eur" | "pct" }
  | { kind: "calc"; key: string; label: string; get: (d: Day, c: ReturnType<typeof derive>) => string; tone?: (d: Day, c: ReturnType<typeof derive>) => string };

const COLS: Col[] = [
  { kind: "input", key: "net_sales",      label: "NET SALES",   fmt: "eur" },
  { kind: "input", key: "orders",         label: "ORDERS",      fmt: "int" },
  { kind: "calc",  key: "aov",            label: "AOV",         get: (_, c) => eur2(c.aov) },
  { kind: "input", key: "returning_rate", label: "RET.RATE",    fmt: "pct" },
  { kind: "calc",  key: "first",          label: "1ST-BUY",     get: (_, c) => pct(c.firstRate) },
  { kind: "calc",  key: "mer",            label: "NET MER",     get: (_, c) => x2(c.netMER) },
  { kind: "calc",  key: "cac",            label: "CAC",         get: (_, c) => eur2(c.blendedCAC), tone: (_, c) => c.blendedCAC > 20 ? "text-bad" : c.blendedCAC > 12 ? "text-warn" : "text-ok" },
  { kind: "calc",  key: "roas",           label: "ROAS",        get: (_, c) => x2(c.blendedROAS), tone: (_, c) => c.blendedROAS >= 3 ? "text-ok" : c.blendedROAS >= 1.5 ? "text-warn" : "text-bad" },
  { kind: "input", key: "meta_spend",     label: "META €",      fmt: "eur" },
  { kind: "input", key: "google_spend",   label: "GOOGLE €",    fmt: "eur" },
  { kind: "calc",  key: "paid",           label: "PAID €",      get: (_, c) => eur2(c.paid) },
  { kind: "input", key: "creator_sales",  label: "CREATOR €",   fmt: "eur" },
  { kind: "input", key: "bol_sales",      label: "BOL €",       fmt: "eur" },
  { kind: "input", key: "email_sales",    label: "EMAIL €",     fmt: "eur" },
  { kind: "input", key: "organic_sales",  label: "ORGANIC €",   fmt: "eur" },
  { kind: "calc",  key: "adspend",        label: "AD SPEND",    get: (_, c) => eur2(c.adSpend) },
  { kind: "calc",  key: "roasp",          label: "ROAS PAID",   get: (_, c) => x2(c.roasPaid) },
  { kind: "input", key: "impressions",    label: "IMPR.",       fmt: "int" },
  { kind: "calc",  key: "cpm",            label: "CPM",         get: (_, c) => eur2(c.cpm) },
  { kind: "input", key: "clicks",         label: "CLICKS",      fmt: "int" },
  { kind: "calc",  key: "ctr",            label: "CTR",         get: (_, c) => pct(c.ctr) },
  { kind: "calc",  key: "cpc",            label: "CPC",         get: (_, c) => eur2(c.cpc) },
  { kind: "input", key: "atc",            label: "ATC",         fmt: "int" },
  { kind: "calc",  key: "cpatc",          label: "CP-ATC",      get: (_, c) => eur2(c.cpAtc) },
  { kind: "input", key: "checkouts",      label: "CHECKOUTS",   fmt: "int" },
  { kind: "calc",  key: "cpco",           label: "CP-CHECKOUT", get: (_, c) => eur2(c.cpCheckout) },
  { kind: "calc",  key: "cpa",            label: "CPA",         get: (_, c) => eur2(c.cpa) },
];

/* ─── persistence: Supabase primary, localStorage fallback ────────────────── */
async function detectBackend(): Promise<"supabase" | "local"> {
  // Real (non-head) select so a missing table surfaces PGRST205 instead of a silent null.
  const { error } = await (supabase as any).from("daily_metrics").select("id").limit(1);
  return error ? "local" : "supabase";
}

/* ─── component ──────────────────────────────────────────────────────────── */
export default function DailyTracker() {
  const [days, setDays]     = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [uid, setUid]       = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const saveTimer = useRef<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUid(user?.id ?? "");
      const be = await detectBackend();
      setBackend(be);
      if (be === "supabase") {
        const { data } = await (supabase as any).from("daily_metrics").select("*").order("date", { ascending: true });
        setDays((data ?? []) as Day[]);
      } else {
        const raw = localStorage.getItem(LS_KEY);
        setDays(raw ? JSON.parse(raw) : []);
      }
      setLoading(false);
    })();
  }, []);

  const persistLocal = (next: Day[]) => localStorage.setItem(LS_KEY, JSON.stringify(next));

  const commit = (row: Day) => {
    if (backend === "local") { persistLocal(days.map((d) => d.id === row.id ? row : d)); return; }
    clearTimeout(saveTimer.current[row.id]);
    saveTimer.current[row.id] = setTimeout(async () => {
      const payload: any = { ...row, user_id: uid };
      const { error } = await (supabase as any).from("daily_metrics").upsert(payload, { onConflict: "user_id,date" });
      if (error) toast.error(error.message);
    }, 500);
  };

  const setCell = (id: string, key: keyof Day, value: number) => {
    setDays((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, [key]: value } : d);
      const row = next.find((d) => d.id === id)!;
      commit(row);
      return next;
    });
  };

  const addDay = async () => {
    // Start from the day after the latest entry (or today), then land on the first free date
    // so adding a day never fails — you always get a fresh row.
    const existing = new Set(days.map((x) => x.date));
    const last = days.reduce((m, d) => (d.date > m ? d.date : m), "");
    let iso = last ? addDaysISO(last, 1) : todayISO();
    while (existing.has(iso)) iso = addDaysISO(iso, 1);
    const row = blankDay(iso);
    const next = [...days, row];
    setDays(next);
    if (backend === "local") persistLocal(next);
    else {
      const { error } = await (supabase as any).from("daily_metrics").insert({ ...row, user_id: uid });
      if (error) toast.error(error.message);
    }
  };

  const removeDay = async (id: string) => {
    const row = days.find((d) => d.id === id);
    const next = days.filter((d) => d.id !== id);
    setDays(next);
    if (backend === "local") persistLocal(next);
    else if (row) await (supabase as any).from("daily_metrics").delete().eq("id", id);
  };

  /* Period roll-up */
  const roll = useMemo(() => {
    const t = days.reduce((a, d) => {
      const paid = d.meta_spend + d.google_spend;
      a.net += d.net_sales; a.orders += d.orders;
      a.paid += paid;
      a.spend += paid + d.creator_sales + d.bol_sales + d.email_sales + d.organic_sales;
      return a;
    }, { net: 0, orders: 0, spend: 0, paid: 0 });
    return {
      ...t,
      aov: t.orders ? t.net / t.orders : 0,
      mer: t.spend ? t.net / t.spend : 0,
      roasPaid: t.paid ? t.net / t.paid : 0,
    };
  }, [days]);

  const kpis = [
    { label: "period net sales", value: eur(roll.net), tone: "" },
    { label: "orders", value: roll.orders, tone: "" },
    { label: "avg aov", value: eur2(roll.aov), tone: "" },
    { label: "ad spend", value: eur(roll.spend), tone: "" },
    { label: "blended mer", value: x2(roll.mer), tone: roll.mer >= 3 ? "text-ok" : roll.mer >= 1.5 ? "text-warn" : "text-bad" },
    { label: "roas paid", value: x2(roll.roasPaid), tone: roll.roasPaid >= 3 ? "text-ok" : "text-warn" },
  ];

  const gridCols = `92px 40px repeat(${COLS.length}, minmax(78px,1fr)) 40px`;

  return (
    <div className="min-h-screen">
      <div className="max-w-full px-6 py-7 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Daily Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Dagelijkse P&amp;L + acquisitie-metrics · formules uit GB Command Center</p>
          </motion.div>
          <div className="flex items-center gap-2">
            <span className="h-9 px-3 rounded-full border border-border bg-card shadow-xs text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {backend === "supabase" ? <><Cloud className="h-3.5 w-3.5 text-ok" /> Synced</> : <><HardDriveDownload className="h-3.5 w-3.5 text-warn" /> Lokaal</>}
            </span>
            <button onClick={addDay}
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
              <Plus className="h-4 w-4" /> Dag toevoegen
            </button>
          </div>
        </div>

        {/* KPI cards */}
        {!loading && (
          <motion.div variants={stagger(0.04)} initial="hidden" animate="visible" className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {kpis.map((k) => {
              const c = k.tone === "text-ok" ? "hsl(var(--ok))" : k.tone === "text-warn" ? "hsl(var(--warn))" : k.tone === "text-bad" ? "hsl(var(--bad))" : "hsl(var(--ember))";
              return (
                <motion.div key={k.label} variants={fadeUp} className="card-soft p-4">
                  <div className="flex items-center gap-1.5"><span className="dot" style={{ background: c, width: 6, height: 6 }} /><p className="text-xs text-muted-foreground capitalize">{k.label}</p></div>
                  <p className="font-num text-2xl font-bold tabular-nums leading-none mt-2" style={{ color: k.tone ? c : "hsl(var(--foreground))" }}>{k.value}</p>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Spreadsheet (soft card) */}
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-max min-w-full">
              <div className="grid bg-muted border-b border-border sticky top-0 z-20" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted z-10 border-r border-border">DATUM</div>
                <div className="px-1 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-center">WK</div>
                {COLS.map((c) => (
                  <div key={c.key as string}
                    className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right ${c.kind === "calc" ? "text-primary/80" : "text-muted-foreground"}`}>
                    {c.label}
                  </div>
                ))}
                <div className="px-1 py-3" />
              </div>

              {loading && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid px-3 py-3.5" style={{ gridTemplateColumns: gridCols }}>
                  {Array.from({ length: COLS.length + 3 }).map((__, j) => <div key={j} className="h-3 rounded-full shimmer mr-2" />)}
                </div>
              ))}

              {!loading && days.length === 0 && (
                <div className="py-16 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3"><Plus className="h-5 w-5 text-muted-foreground" /></div>
                  <p className="text-sm font-semibold text-foreground mb-1">Nog geen dagen</p>
                  <p className="text-xs text-muted-foreground">Klik op 'Dag toevoegen' om te starten</p>
                </div>
              )}

              {!loading && days.map((d) => {
                const c = derive(d);
                return (
                  <div key={d.id} className="group grid border-b border-border/50 hover:bg-muted/40 transition-colors"
                    style={{ gridTemplateColumns: gridCols }}>
                    <div className="px-3 py-2 text-[13px] font-medium text-foreground flex items-center sticky left-0 bg-card group-hover:bg-muted z-10 border-r border-border/60 tabular-nums">
                      {fmtDate(d.date)}
                    </div>
                    <div className="px-1 py-2 text-[11px] text-muted-foreground/50 flex items-center justify-center tabular-nums">{c.week}</div>
                    {COLS.map((col) => col.kind === "input" ? (
                      <Cell key={col.key} value={d[col.key] as number} fmt={col.fmt} onCommit={(v) => setCell(d.id, col.key, v)} />
                    ) : (
                      <div key={col.key} className={`px-3 py-2 text-[12px] text-right flex items-center justify-end tabular-nums font-medium ${col.tone ? col.tone(d, c) : "text-muted-foreground"}`}>
                        {col.get(d, c)}
                      </div>
                    ))}
                    <button onClick={() => setDeleteId(d.id)} tabIndex={-1}
                      className="px-1 grid place-items-center text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-bad transition-colors text-sm">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {backend === "local" && !loading && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="dot" style={{ background: "hsl(var(--warn))" }} />
            Lokale modus — data in deze browser. Pas migratie <span className="font-medium text-foreground">daily_metrics</span> toe in Supabase voor teamsync.
          </p>
        )}
      </div>

      <ConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => { if (deleteId) removeDay(deleteId); setDeleteId(null); }}
        title="Dag verwijderen?"
        description="Deze dagregel wordt permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden."
      />
    </div>
  );
}

/* ─── editable numeric cell ──────────────────────────────────────────────────
   Always-mounted input (formatted when idle, raw when focused) so native Tab walks
   every column — including ones scrolled off-screen, which get pulled into view. */
function Cell({ value, fmt, onCommit }: { value: number; fmt: "int" | "eur" | "pct"; onCommit: (v: number) => void }) {
  const [foc, setFoc] = useState(false);
  const [draft, setDraft] = useState("");

  const shown = value === 0 ? "" : fmt === "eur" ? eur2(value) : fmt === "pct" ? pct(value) : value.toLocaleString("nl-BE");
  const raw = value === 0 ? "" : fmt === "pct" ? String(+(value * 100).toFixed(4)) : String(value);

  return (
    <input
      inputMode="decimal"
      value={foc ? draft : shown}
      placeholder="·"
      onFocus={(e) => { setFoc(true); setDraft(raw); requestAnimationFrame(() => e.target.select()); e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setFoc(false); let n = parseFloat(draft.replace(",", ".")) || 0; if (fmt === "pct") n = n / 100; onCommit(n); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
      className="px-3 py-2 text-[12px] text-right w-full bg-transparent outline-none focus:bg-card focus:ring-2 focus:ring-inset focus:ring-primary/40 rounded-2xl text-foreground tabular-nums placeholder:text-muted-foreground/30 transition-colors"
    />
  );
}
