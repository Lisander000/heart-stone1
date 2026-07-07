import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Cloud, HardDriveDownload, ExternalLink, Check } from "lucide-react";
import { fadeUp, stagger } from "@/lib/motion";
import { ConfirmDelete } from "@/components/ConfirmDelete";

/* ─── field spec ─────────────────────────────────────────────────────────── */
export type Tone = "ok" | "warn" | "bad" | "info" | "idle";
export type Field = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "url" | "num" | "eur" | "pct" | "readonly" | "computed" | "check";
  options?: string[];
  optionsKey?: string;     // resolve options dynamically from optionSets[optionsKey]
  compute?: (row: any) => string;  // for type "computed" — derived from the row (formula)
  computeTone?: (row: any) => Tone | undefined;  // optional colour for a computed value
  w?: string;              // grid column width
  tones?: Record<string, Tone>;
};
export type BoardConfig = {
  table: string;           // supabase table + localStorage key
  title: string;
  description: string;
  fields: Field[];
  statusKey?: string;      // drives filter chips + row LED
  autoId?: { key: string; prefix: string }; // auto-sequence e.g. AN001
};

type Row = Record<string, any> & { id: string };


async function detectBackend(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}

/* ─── board ──────────────────────────────────────────────────────────────── */
export default function TrackerBoard({ config, optionSets, headerExtra, onRows, embedded }: {
  config: BoardConfig;
  optionSets?: Record<string, string[]>;
  headerExtra?: React.ReactNode;
  onRows?: (rows: Row[]) => void;
  embedded?: boolean;
}) {
  const { table, title, description, fields, statusKey } = config;
  // Keep rows in ascending auto-ID order (001, 002, …) — also re-sorts data saved
  // under the old newest-first behaviour so existing rows show in the right order.
  const sortRows = (arr: Row[]): Row[] => {
    if (!config.autoId) return arr;
    const k = config.autoId.key;
    const n = (v: any) => { const m = String(v ?? "").match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0; };
    return [...arr].sort((a, b) => n(a[k]) - n(b[k]));
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [uid, setUid] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const saveTimer = useRef<Record<string, any>>({});
  const LS = `gb_${table}`;

  useEffect(() => { onRows?.(rows); }, [rows]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUid(user?.id ?? "");
      const be = await detectBackend(table);
      setBackend(be);
      if (be === "supabase") {
        const { data } = await (supabase as any).from(table).select("*").order("created_at", { ascending: true });
        setRows(sortRows((data ?? []) as Row[]));
      } else {
        const raw = localStorage.getItem(LS);
        setRows(sortRows(raw ? JSON.parse(raw) : []));
      }
      setLoading(false);
    })();
  }, [table]); // eslint-disable-line

  const persistLocal = (next: Row[]) => localStorage.setItem(LS, JSON.stringify(next));

  const commit = (row: Row) => {
    if (backend === "local") { persistLocal(rows.map((r) => r.id === row.id ? row : r)); return; }
    clearTimeout(saveTimer.current[row.id]);
    saveTimer.current[row.id] = setTimeout(async () => {
      const { id, created_at, ...rest } = row as any;
      const { error } = await (supabase as any).from(table).update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) toast.error(error.message);
    }, 500);
  };

  const setCell = (id: string, key: string, value: any) => {
    setRows((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, [key]: value } : r);
      const row = next.find((r) => r.id === id)!;
      commit(row);
      return next;
    });
  };

  const addRow = async () => {
    const blank: Row = { id: crypto.randomUUID() };
    fields.forEach((f) => {
      blank[f.key] = f.type === "check" ? false
        : f.type === "select" ? (f.options?.[0] ?? "")
        : (f.type === "num" || f.type === "eur" || f.type === "pct" ? 0 : "");
    });
    if (config.autoId) {
      const nums = rows.map((r) => { const m = String(r[config.autoId!.key] ?? "").match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0; });
      const next = (nums.length ? Math.max(...nums) : 0) + 1;
      blank[config.autoId.key] = config.autoId.prefix + String(next).padStart(3, "0");
    }
    const next = [...rows, blank];   // append at bottom → ascending (001 first, rest below)
    setRows(next);
    if (backend === "local") persistLocal(next);
    else {
      const { created_at, ...rest } = blank as any;
      const { error } = await (supabase as any).from(table).insert({ ...rest, user_id: uid });
      if (error) toast.error(error.message);
    }
  };

  const removeRow = async (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    if (backend === "local") persistLocal(next);
    else await (supabase as any).from(table).delete().eq("id", id);
  };

  /* status filter options */
  const statusOpts = useMemo(() => {
    if (!statusKey) return [];
    const m = new Map<string, number>();
    rows.forEach((r) => { const v = r[statusKey]; if (v) m.set(String(v), (m.get(String(v)) ?? 0) + 1); });
    return Array.from(m.entries());
  }, [rows, statusKey]);

  const visible = useMemo(
    () => (statusKey && filter ? rows.filter((r) => String(r[statusKey]) === filter) : rows),
    [rows, filter, statusKey]
  );

  const statusField = statusKey ? fields.find((f) => f.key === statusKey) : undefined;
  // Full-width: every column becomes flexible (min = its width) so the table always fills the row.
  const gridCols = `${fields.map((f) => {
    const w = f.w ?? "minmax(120px,1fr)";
    return w.includes("fr") || w.includes("minmax") ? w : `minmax(${w}, 1fr)`;
  }).join(" ")} 44px`;

  const cleanTitle = title.replace(/_/g, " ");

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      <div className={embedded ? "space-y-4" : "max-w-full px-6 py-7 space-y-5"}>
        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {embedded ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : (
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground capitalize">{cleanTitle}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </motion.div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {headerExtra}
            <span className="h-9 px-3 rounded-full border border-border bg-card shadow-xs text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {backend === "supabase" ? <><Cloud className="h-3.5 w-3.5 text-ok" /> Synced</> : <><HardDriveDownload className="h-3.5 w-3.5 text-warn" /> Lokaal</>}
            </span>
            <button onClick={addRow}
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
              <Plus className="h-4 w-4" /> Nieuw
            </button>
          </div>
        </div>

        {/* filter pills */}
        {statusOpts.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setFilter(null)}
              className={`h-8 px-3 rounded-full text-xs font-medium transition-all ${filter === null ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs"}`}>
              Alle <span className="tabular-nums opacity-70">{rows.length}</span>
            </button>
            {statusOpts.map(([v, n]) => (
              <button key={v} onClick={() => setFilter(filter === v ? null : v)}
                className={`h-8 px-3 rounded-full text-xs font-medium capitalize transition-all flex items-center gap-1.5 ${filter === v ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs"}`}>
                <span className="dot" style={{ background: `hsl(var(--${statusField?.tones?.[v] === "ok" ? "ok" : statusField?.tones?.[v] === "warn" ? "warn" : statusField?.tones?.[v] === "bad" ? "bad" : statusField?.tones?.[v] === "info" ? "info" : "muted-foreground"}))`, width: 6, height: 6 }} />
                {v.replace(/_/g, " ")} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            ))}
          </div>
        )}

        {/* board table (soft card) */}
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-max min-w-full">
              <div className="grid bg-muted border-b border-border" style={{ gridTemplateColumns: gridCols }}>
                {fields.map((f) => (
                  <div key={f.key} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</div>
                ))}
                <div className="px-2 py-3" />
              </div>

              {loading && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid px-4 py-4" style={{ gridTemplateColumns: gridCols }}>
                  {Array.from({ length: fields.length + 1 }).map((__, j) => <div key={j} className="h-3.5 rounded-full shimmer mr-4" />)}
                </div>
              ))}

              {!loading && visible.length === 0 && (
                <div className="py-16 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3"><Plus className="h-5 w-5 text-muted-foreground" /></div>
                  <p className="text-sm font-semibold text-foreground mb-1">{filter ? "Geen resultaten" : "Leeg board"}</p>
                  <p className="text-xs text-muted-foreground">{filter ? "Wis het filter" : "Klik op 'Nieuw' om een kaart toe te voegen"}</p>
                </div>
              )}

              {!loading && (
                <motion.div variants={stagger(0.015, 0.03)} initial="hidden" animate="visible" className="divide-y divide-border/50">
                  {visible.map((r) => (
                    <motion.div key={r.id} variants={fadeUp}
                      className="group grid items-stretch hover:bg-muted/40 transition-colors"
                      style={{ gridTemplateColumns: gridCols }}>
                      {fields.map((f) => (
                        <BoardCell key={f.key} field={f} value={r[f.key]} row={r} optionSets={optionSets}
                          onChange={(v) => setCell(r.id, f.key, v)} />
                      ))}
                      <button onClick={() => setDeleteId(r.id)} tabIndex={-1}
                        className="px-2 grid place-items-center text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-bad transition-colors">
                        <span className="text-sm">✕</span>
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {backend === "local" && !loading && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="dot" style={{ background: "hsl(var(--warn))" }} />
            Lokale modus — data in deze browser. Pas migratie <span className="font-medium text-foreground">{table}</span> toe in Supabase voor teamsync.
          </p>
        )}
      </div>

      <ConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => { if (deleteId) removeRow(deleteId); setDeleteId(null); }}
        title="Kaart verwijderen?"
        description="Deze rij wordt permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden."
      />
    </div>
  );
}

/* ─── cell ───────────────────────────────────────────────────────────────── */
const eur2 = (n: number) => "€" + Number(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toneVar = (t?: Tone) => t === "ok" ? "ok" : t === "warn" ? "warn" : t === "bad" ? "bad" : t === "info" ? "info" : "muted-foreground";

// Bring a cell into view (horizontally too) when it receives focus — so Tab can
// walk into columns that are currently scrolled off-screen.
const seeIntoView = (el: HTMLElement) => el.scrollIntoView({ block: "nearest", inline: "nearest" });
// Every editable control stays mounted & focusable → native Tab traverses them all.
const CELL = "w-full px-4 py-2.5 text-[13px] rounded-2xl bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30 focus:bg-card focus:ring-2 focus:ring-inset focus:ring-primary/40 transition-colors";

function BoardCell({ field: f, value, row, optionSets, onChange }: { field: Field; value: any; row?: any; optionSets?: Record<string, string[]>; onChange: (v: any) => void }) {
  const [foc, setFoc] = useState(false);
  const [draft, setDraft] = useState("");

  /* readonly → code chip (auto-generated id) — not a tab stop */
  if (f.type === "readonly") {
    return (
      <div className="px-4 py-2.5 flex items-center min-w-0">
        <span className="font-mono text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-muted text-muted-foreground">{value || "—"}</span>
      </div>
    );
  }

  /* computed → derived value (formula), read-only — not a tab stop */
  if (f.type === "computed") {
    const out = (f.compute?.(row ?? {}) ?? "").trim();
    const tone = f.computeTone?.(row ?? {});
    if (tone) {
      const c = `hsl(var(--${toneVar(tone)}))`;
      return (
        <div className="px-4 py-2.5 flex items-center justify-end min-w-0" title={out}>
          <span className="text-[12px] font-semibold tabular-nums" style={{ color: c }}>{out || "—"}</span>
        </div>
      );
    }
    return (
      <div className="px-4 py-2.5 flex items-center min-w-0" title={out}>
        <span className="text-[12px] text-muted-foreground italic truncate">{out || "—"}</span>
      </div>
    );
  }

  /* check → boolean toggle (tabbable; space/enter toggles) */
  if (f.type === "check") {
    const on = value === true || value === "true";
    return (
      <div className="px-4 py-2.5 flex items-center">
        <button onClick={() => onChange(!on)} aria-pressed={on}
          onFocus={(e) => seeIntoView(e.currentTarget)}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!on); } }}
          className={`h-5 w-5 rounded-md border grid place-items-center transition-colors outline-none focus:ring-2 focus:ring-primary/40 ${on ? "bg-ok border-ok text-white" : "border-border bg-card hover:border-ring/50"}`}>
          {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>
      </div>
    );
  }

  /* select → dropdown with colored dot; options can be dynamic */
  if (f.type === "select") {
    const opts = f.optionsKey ? (optionSets?.[f.optionsKey] ?? []) : (f.options ?? []);
    if (opts.length === 0) {
      // no options yet (e.g. no ICPs / no angle codes) → free text
      return <input value={value ?? ""} placeholder="—"
        onChange={(e) => onChange(e.target.value)} onFocus={(e) => seeIntoView(e.currentTarget)} className={CELL} />;
    }
    const tone = f.tones?.[String(value)];
    const hasTone = !!tone;
    const c = hasTone ? `hsl(var(--${toneVar(tone)}))` : "hsl(var(--foreground))";
    return (
      <div className="px-4 py-2.5 flex items-center min-w-0">
        <span className={`inline-flex items-center gap-1.5 rounded-full py-0.5 text-[11px] font-medium capitalize ${hasTone ? "pl-2 pr-1" : "px-1"}`}
          style={hasTone ? { background: `${c}18`, color: c } : { color: c }}>
          {hasTone && <span className="dot" style={{ background: c, width: 6, height: 6 }} />}
          <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} onFocus={(e) => seeIntoView(e.currentTarget)}
            className="bg-transparent outline-none cursor-pointer appearance-none capitalize max-w-[150px] rounded focus:ring-2 focus:ring-primary/40" style={{ color: c }}>
            <option value="" className="bg-popover text-foreground">—</option>
            {opts.map((o) => <option key={o} value={o} className="bg-popover text-foreground">{o.replace(/_/g, " ")}</option>)}
          </select>
        </span>
      </div>
    );
  }

  /* url → editable field + a small open-link affordance (link itself skipped by tab) */
  if (f.type === "url") {
    return (
      <div className="flex items-center min-w-0">
        <input value={value ?? ""} placeholder="url…"
          onChange={(e) => onChange(e.target.value)} onFocus={(e) => seeIntoView(e.currentTarget)}
          className={`${CELL} pr-1`} />
        {value ? (
          <a href={value} target="_blank" rel="noreferrer" tabIndex={-1}
            className="shrink-0 pr-3 text-info hover:text-info/80"><ExternalLink className="h-3.5 w-3.5" /></a>
        ) : null}
      </div>
    );
  }

  /* date → native date input (always available) */
  if (f.type === "date") {
    return <input type="date" value={value ?? ""}
      onChange={(e) => onChange(e.target.value)} onFocus={(e) => seeIntoView(e.currentTarget)}
      className={`${CELL} tabular-nums`} />;
  }

  /* numeric (num/eur/pct) → formatted when idle, raw when focused */
  if (f.type === "num" || f.type === "eur" || f.type === "pct") {
    const shown = value === "" || value == null || Number(value) === 0
      ? "" : f.type === "eur" ? eur2(value) : f.type === "pct" ? (Number(value) * 100).toFixed(0) + "%" : Number(value).toLocaleString("nl-BE");
    const raw = value === "" || value == null || Number(value) === 0
      ? "" : f.type === "pct" ? String(+(Number(value) * 100).toFixed(4)) : String(value);
    return (
      <input inputMode="decimal" value={foc ? draft : shown} placeholder="—"
        onFocus={(e) => { setFoc(true); setDraft(raw); requestAnimationFrame(() => e.target.select()); seeIntoView(e.currentTarget); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setFoc(false); let n = parseFloat(draft.replace(",", ".")) || 0; if (f.type === "pct") n = n / 100; onChange(n); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
        className={`${CELL} text-right tabular-nums`} />
    );
  }

  /* textarea */
  if (f.type === "textarea") {
    return <textarea value={value ?? ""} rows={1} placeholder="—"
      onChange={(e) => onChange(e.target.value)} onFocus={(e) => seeIntoView(e.currentTarget)}
      className={`${CELL} resize-none leading-snug align-middle`} />;
  }

  /* text */
  return <input value={value ?? ""} placeholder="—"
    onChange={(e) => onChange(e.target.value)} onFocus={(e) => seeIntoView(e.currentTarget)}
    className={CELL} />;
}
