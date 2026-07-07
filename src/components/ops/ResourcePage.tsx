import { useEffect, useMemo, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, RefreshCw, Pencil, Database, Search, ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import { fadeUp, stagger } from "@/lib/motion";
import { opsRegistry } from "@/pages/ops/opsConfig";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { notify } from "@/lib/notify";

export type FieldDef = {
  key: string; label: string;
  type?: "text" | "textarea" | "number" | "select" | "email" | "date";
  options?: string[]; required?: boolean; defaultValue?: any; placeholder?: string;
};
export type ColumnDef = {
  key: string; label: string; render?: (value: any, row: any) => ReactNode; className?: string;
};

type Props = {
  title: string; description?: string; table: string;
  fields: FieldDef[]; columns: ColumnDef[]; emptyText?: string;
  extraFilter?: Record<string, any>; orderBy?: { column: string; ascending?: boolean };
  rowLinkTo?: (row: any) => string;
};

export function ResourcePage({ title, description, table, fields, columns, emptyText, extraFilter, orderBy, rowLinkTo }: Props) {
  const navigate = useNavigate();
  const [rows, setRows]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [addOpen, setAddOpen]   = useState(false);
  const [editRow, setEditRow]   = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm]         = useState<Record<string, any>>({});
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");
  const [filter, setFilter]     = useState<string | null>(null);

  const cfg = opsRegistry[table];
  const metrics = useMemo(() => (cfg?.metrics ? cfg.metrics(rows) : []), [cfg, rows]);
  const filterKey = cfg?.filterKey;

  // Distinct filter values with counts, in a sensible order
  const filterOptions = useMemo(() => {
    if (!filterKey) return [];
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const v = r[filterKey];
      if (v == null || v === "") return;
      counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
  }, [rows, filterKey]);

  // Client-side filter + search + sort → a real data-view experience
  const visibleRows = useMemo(() => {
    let out = rows;
    if (filterKey && filter) out = out.filter((r) => String(r[filterKey]) === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        const na = Number(av), nb = Number(bv);
        const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, search, sortKey, sortDir, filter, filterKey]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else { setSortKey(key); setSortDir("asc"); }
  };

  const load = async () => {
    setLoading(true); setError(null);
    try {
      let q: any = (supabase as any).from(table).select("*");
      if (extraFilter) for (const [k, v] of Object.entries(extraFilter)) q = q.eq(k, v);
      q = q.order(orderBy?.column ?? "created_at", { ascending: orderBy?.ascending ?? false });
      const { data, error } = await q;
      if (error) throw error;
      setRows(data ?? []);
    } catch (e: any) { setError(e.message ?? "Kon data niet laden"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table, JSON.stringify(extraFilter)]);

  const resetForm = () => {
    const init: Record<string, any> = {};
    fields.forEach((f) => { init[f.key] = f.defaultValue ?? (f.type === "number" ? 0 : ""); });
    setForm(init);
  };

  useEffect(() => { if (addOpen) resetForm(); /* eslint-disable-next-line */ }, [addOpen]);

  useEffect(() => {
    if (!editRow) return;
    const init: Record<string, any> = {};
    fields.forEach((f) => {
      const v = editRow[f.key];
      init[f.key] = f.type === "date" && v ? new Date(v).toISOString().slice(0, 16) : v ?? (f.type === "number" ? 0 : "");
    });
    setForm(init); /* eslint-disable-next-line */
  }, [editRow]);

  const buildPayload = () => {
    const p: any = {};
    for (const f of fields) {
      const v = form[f.key];
      p[f.key] = (v === "" || v === null || v === undefined) ? null : f.type === "number" ? Number(v) : v;
    }
    return p;
  };

  const add = async () => {
    for (const f of fields) if (f.required && !form[f.key]) { toast.error(`${f.label} is verplicht`); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd");
      const payload: any = { user_id: user.id, ...buildPayload() };
      if (extraFilter) Object.assign(payload, extraFilter);
      const { data: inserted, error } = await (supabase as any).from(table).insert(payload).select().single();
      if (error) throw error;
      toast.success("Toegevoegd"); setAddOpen(false); load();
      // Fire a notification (in-app + browser push) for the new record.
      const row = inserted ?? payload;
      const label = cfg?.label ?? "record";
      const alertTables = ["tickets", "cases", "returns"];
      notify({
        title: `Nieuw ${label.toLowerCase()}${cfg?.title ? `: ${cfg.title(row)}` : ""}`,
        body: cfg?.subtitle ? cfg.subtitle(row) : `Er is een nieuw ${label.toLowerCase()} aangemaakt.`,
        kind: alertTables.includes(table) ? "warning" : "info",
        link: rowLinkTo ? rowLinkTo(row) : cfg?.listPath,
      });
    } catch (e: any) { toast.error(e.message ?? "Kon niet toevoegen"); }
    finally { setSaving(false); }
  };

  const update = async () => {
    if (!editRow) return;
    for (const f of fields) if (f.required && !form[f.key]) { toast.error(`${f.label} is verplicht`); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from(table).update(buildPayload()).eq("id", editRow.id);
      if (error) throw error;
      toast.success("Opgeslagen"); setEditRow(null); load();
    } catch (e: any) { toast.error(e.message ?? "Kon niet opslaan"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
      setRows((r) => r.filter((x) => x.id !== id)); toast.success("Verwijderd");
    } catch (e: any) { toast.error(e.message ?? "Kon niet verwijderen"); }
    finally { setDeletingId(null); }
  };

  const hasFormPage = Boolean(cfg);
  const openRow = (row: any) => {
    if (rowLinkTo) { navigate(rowLinkTo(row)); return; }
    if (hasFormPage) { navigate(`/ops/${table}/${row.id}`); return; }
    setEditRow(row);
  };
  const editRowPage = (row: any) => {
    if (rowLinkTo) { navigate(rowLinkTo(row)); return; }
    if (hasFormPage) { navigate(`/ops/${table}/${row.id}/edit`); return; }
    setEditRow(row);
  };

  const renderFormFields = () => (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {f.label}{f.required && <span className="text-primary ml-0.5">*</span>}
          </label>
          {f.type === "textarea" ? (
            <Textarea value={form[f.key] ?? ""} placeholder={f.placeholder} rows={3}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="resize-none" />
          ) : f.type === "select" && f.options ? (
            <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
              <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
              <SelectContent>
                {f.options.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "date" ? "datetime-local" : "text"}
              value={form[f.key] ?? ""} placeholder={f.placeholder}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
    </div>
  );

  const newButton = hasFormPage ? (
    <button
      onClick={() => navigate(`/ops/${table}/new`)}
      className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
    >
      <Plus className="h-4 w-4" /> Nieuw
    </button>
  ) : (
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogTrigger asChild>
        <button className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
          <Plus className="h-4 w-4" /> Nieuw
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-lg font-semibold tracking-tight">{title} — nieuw</DialogTitle></DialogHeader>
        <div className="py-2">{renderFormFields()}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Annuleer</Button>
          <Button onClick={add} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const gridCols = `44px repeat(${columns.length}, minmax(0,1fr)) 72px`;
  const kpiTone = (t?: string) => t === "success" ? "hsl(var(--ok))" : t === "warn" ? "hsl(var(--warn))" : t === "danger" ? "hsl(var(--bad))" : "hsl(var(--ember))";

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-7 space-y-5">
        {/* ── Page header ── */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </motion.div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading}
              className="h-9 w-9 rounded-full border border-border bg-card grid place-items-center text-muted-foreground shadow-xs hover:text-foreground transition-colors disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {newButton}
          </div>
        </div>

        {error && <div className="text-sm text-bad border border-bad/20 bg-bad/5 rounded-xl px-4 py-3">{error}</div>}

        {/* ── KPI cards ── */}
        {metrics.length > 0 && (
          <motion.div variants={stagger(0.04)} initial="hidden" animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, minmax(0,1fr))` }}>
            {metrics.map((m) => (
              <motion.div key={m.label} variants={fadeUp} className="card-soft p-4">
                <div className="flex items-center gap-1.5">
                  <span className="dot" style={{ background: kpiTone(m.tone), width: 7, height: 7 }} />
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
                <p className="font-num text-3xl font-bold leading-none mt-2 tabular-nums"
                  style={{ color: m.tone && m.tone !== "default" ? kpiTone(m.tone) : "hsl(var(--foreground))" }}>
                  {m.value}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Filter pills + search ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {filterOptions.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setFilter(null)}
                className={`h-8 px-3 rounded-full text-xs font-medium transition-all ${filter === null ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs"}`}>
                Alle <span className="tabular-nums opacity-70">{rows.length}</span>
              </button>
              {filterOptions.map(({ value, count }) => (
                <button key={value} onClick={() => setFilter(filter === value ? null : value)}
                  className={`h-8 px-3 rounded-full text-xs font-medium capitalize transition-all ${filter === value ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs"}`}>
                  {value.replace(/_/g, " ")} <span className="tabular-nums opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}
          <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Zoek in ${title.toLowerCase()}…`}
              className="h-9 w-full rounded-full border border-border bg-card pl-9 pr-8 text-sm shadow-xs outline-none transition-all placeholder:text-muted-foreground/60 focus:shadow-sm focus:border-ring/40" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>

        {/* ── Data table (soft card) ──────────────────────────────────── */}
        <div className="card-soft overflow-hidden">
          {/* Column headers — sortable */}
          <div className="grid bg-muted border-b border-border" style={{ gridTemplateColumns: gridCols }}>
            <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">#</div>
            {columns.map((c) => {
              const active = sortKey === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`group/sort flex items-center gap-1 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-left transition-colors hover:text-foreground ${active ? "text-primary" : "text-muted-foreground"} ${c.className ?? ""}`}
                >
                  <span className="truncate">{c.label}</span>
                  {active ? (
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ArrowUp className="h-3 w-3 shrink-0 opacity-0 group-hover/sort:opacity-40" />
                  )}
                </button>
              );
            })}
            <div className="px-4 py-3" />
          </div>

          {/* Loading */}
          {loading && (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid px-4 py-4" style={{ gridTemplateColumns: gridCols }}>
                  {Array.from({ length: columns.length + 2 }).map((__, j) => (
                    <div key={j} className="h-3.5 rounded-full shimmer mr-4" style={{ width: `${55 + (j * 11) % 35}%` }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && visibleRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mb-3">
                {search ? <Search className="h-5 w-5 text-muted-foreground" /> : <Database className="h-5 w-5 text-muted-foreground" />}
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{search ? "Geen resultaten" : "Nog geen rijen"}</p>
              <p className="text-xs text-muted-foreground">{search ? `Niets gevonden voor "${search}".` : (emptyText ?? "Klik op 'Nieuw' om te beginnen.")}</p>
            </div>
          )}

          {/* Rows */}
          {!loading && visibleRows.length > 0 && (
            <motion.div variants={stagger(0.015, 0.03)} initial="hidden" animate="visible" className="divide-y divide-border/50">
              {visibleRows.map((row, idx) => (
                <motion.div
                  key={row.id}
                  variants={fadeUp}
                  className="group grid cursor-pointer transition-colors duration-100 hover:bg-muted/40"
                  style={{ gridTemplateColumns: gridCols }}
                  onClick={(e) => { const t = e.target as HTMLElement; if (t.closest("a,button")) return; openRow(row); }}
                >
                  <div className="px-4 py-3.5 text-xs text-muted-foreground/40 tabular-nums flex items-center">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  {columns.map((c) => (
                    <div key={c.key} className={`px-4 py-3.5 text-[13px] text-foreground flex items-center min-w-0 ${c.className ?? ""}`}>
                      <span className="truncate">
                        {c.render ? c.render(row[c.key], row) : (row[c.key] ?? <span className="text-muted-foreground/40">—</span>)}
                      </span>
                    </div>
                  ))}
                  <div className="px-2 py-3.5 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button title="Bewerken"
                      className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      onClick={(e) => { e.stopPropagation(); editRowPage(row); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button title="Verwijderen"
                      className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                      onClick={(e) => { e.stopPropagation(); setConfirmId(row.id); }}
                      disabled={deletingId === row.id}>
                      {deletingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{title} — bewerken</DialogTitle>
          </DialogHeader>
          <div className="py-2">{renderFormFields()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={saving}>Annuleer</Button>
            <Button onClick={update} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        onConfirm={() => { if (confirmId) remove(confirmId); setConfirmId(null); }}
        title={`${title.replace(/s$/, "")} verwijderen?`}
        description="Deze record wordt permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden."
      />
    </div>
  );
}

export function StatusBadge({ value, tone = "default" }: { value: string; tone?: "default" | "success" | "warn" | "danger" }) {
  const c = {
    default: "hsl(var(--muted-foreground))",
    success: "hsl(var(--ok))",
    warn:    "hsl(var(--warn))",
    danger:  "hsl(var(--bad))",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
      style={{ background: `${c}18`, color: c }}>
      <span className="dot" style={{ background: c, width: 6, height: 6 }} />
      {value ?? "—"}
    </span>
  );
}

export const fmtDate  = (v: string) => v ? new Date(v).toLocaleDateString("nl-BE", { day:"2-digit", month:"short", year:"numeric" }) : "—";
export const fmtMoney = (v: number, c = "EUR") => new Intl.NumberFormat("nl-BE", { style:"currency", currency:c }).format(Number(v ?? 0));
