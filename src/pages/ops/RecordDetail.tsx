import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertCircle, Pencil, Trash2, ExternalLink } from "lucide-react";
import { fmtDate, StatusBadge } from "@/components/ops/ResourcePage";
import { opsRegistry } from "@/pages/ops/opsConfig";
import { fadeUp, stagger } from "@/lib/motion";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export default function RecordDetail() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const navigate = useNavigate();
  const cfg = table ? opsRegistry[table] : undefined;

  const [row, setRow] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    if (!cfg || !id) return;
    setLoading(true); setError(null);
    try {
      const { data, error } = await (supabase as any).from(table).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`${cfg.label} niet gevonden`);
      setRow(data);
      if (data.order_id) {
        const { data: o } = await (supabase as any).from("orders").select("id, order_number, status, customer_name").eq("id", data.order_id).maybeSingle();
        setOrder(o);
      } else setOrder(null);
    } catch (e: any) { setError(e.message ?? "Kon niet laden"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table, id]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = async () => {
    if (!cfg || !id) return;
    setRemoving(true);
    try {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Verwijderd");
      navigate(cfg.listPath);
    } catch (e: any) { toast.error(e.message ?? "Kon niet verwijderen"); }
    finally { setRemoving(false); }
  };

  const overviewEntries = useMemo(() => {
    if (!row) return [];
    return Object.entries(row).filter(([k]) => !["id", "user_id"].includes(k));
  }, [row]);

  if (!cfg) return <div className="p-16 text-center text-sm text-muted-foreground">Onbekende tabel.</div>;
  if (loading) return <div className="p-16 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Laden…</div>;
  if (error || !row) return (
    <div className="p-16 flex flex-col items-center gap-4 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div className="text-sm text-muted-foreground">{error ?? "Niet gevonden"}</div>
      <Link to={cfg.listPath} className="text-sm text-primary hover:underline">Terug naar {cfg.labelPlural}</Link>
    </div>
  );

  const kpis = cfg.kpis?.(row) ?? [];

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <div className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-6 py-7">
          <Link to={cfg.listPath} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> {cfg.labelPlural}
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start justify-between gap-4 flex-wrap"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">{cfg.label}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground leading-none">
                  {cfg.title(row)}
                </h1>
                {cfg.statusKey && (
                  <StatusBadge value={row[cfg.statusKey]} tone={cfg.statusTone ? cfg.statusTone(row[cfg.statusKey]) : "default"} />
                )}
              </div>
              {cfg.subtitle && <p className="text-sm text-muted-foreground mt-2">{cfg.subtitle(row)}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmOpen(true)} disabled={removing}
                className="h-9 w-9 rounded-xl border border-border bg-card grid place-items-center text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-40"
                title="Verwijderen"
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
              <Link
                to={`/ops/${table}/${id}/edit`}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
              >
                <Pencil className="h-3.5 w-3.5" /> Bewerken
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        variants={stagger(0.05)}
        initial="hidden" animate="visible"
        className="max-w-4xl mx-auto px-6 py-8 space-y-6"
      >
        {/* KPIs */}
        {kpis.length > 0 && (
          <motion.div variants={fadeUp} className="grid gap-px bg-border rounded-xl overflow-hidden border border-border" style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0,1fr))` }}>
            {kpis.map((k, i) => (
              <div key={i} className="bg-card px-4 py-3.5">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</div>
                <div className="mt-1 font-display text-xl font-semibold text-foreground capitalize leading-none">{k.value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Linked order */}
        {order && (
          <motion.div variants={fadeUp}>
            <Link
              to={`/orders/${order.id}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 hover:border-primary/30 transition-all card-hover"
            >
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Gekoppelde order</div>
                <div className="mt-1 font-mono text-sm text-foreground">{order.order_number} · {order.customer_name ?? "—"}</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </Link>
          </motion.div>
        )}

        {/* Full overview */}
        <motion.section variants={fadeUp} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Volledig overzicht</h2>
          </div>
          <dl className="divide-y divide-border">
            {overviewEntries.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-3 px-5 py-3 text-sm">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                <dd className="col-span-2 break-words text-foreground">
                  {v === null || v === undefined || v === ""
                    ? <span className="text-muted-foreground/50">—</span>
                    : typeof v === "boolean" ? (v ? "Ja" : "Nee")
                    : typeof v === "object" ? <span className="font-mono text-xs">{JSON.stringify(v)}</span>
                    : /_at$/.test(k) ? fmtDate(String(v))
                    : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </motion.section>
      </motion.div>

      <ConfirmDelete
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => { setConfirmOpen(false); remove(); }}
        title={`${cfg.label} verwijderen?`}
        description="Deze record wordt permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden."
      />
    </div>
  );
}
