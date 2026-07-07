import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Check, AlertCircle } from "lucide-react";
import { opsRegistry, allFields, OpsField } from "@/pages/ops/opsConfig";
import { fadeUp, stagger } from "@/lib/motion";

export default function RecordForm() {
  const { table, id } = useParams<{ table: string; id?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const cfg = table ? opsRegistry[table] : undefined;
  const isEdit = Boolean(id);
  const orderId = params.get("order_id");
  const returnTo = params.get("return_to");

  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<{ id: string; order_number: string } | null>(null);

  // Initialise form
  useEffect(() => {
    if (!cfg) return;
    if (!isEdit) {
      const init: Record<string, any> = {};
      allFields(cfg).forEach((f) => {
        const prefill = params.get(f.key); // allow ?customer_email=…&order_number=… prefill
        init[f.key] = prefill ?? f.defaultValue ?? (f.type === "number" ? 0 : "");
      });
      setForm(init);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any).from(table).select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(`${cfg.label} niet gevonden`);
        const init: Record<string, any> = {};
        allFields(cfg).forEach((f) => {
          const v = data[f.key];
          init[f.key] = f.type === "date" && v ? new Date(v).toISOString().slice(0, 16) : v ?? (f.type === "number" ? 0 : "");
        });
        setForm(init);
        if (data.order_id) {
          const { data: o } = await (supabase as any).from("orders").select("id, order_number").eq("id", data.order_id).maybeSingle();
          if (o) setOrderRef(o);
        }
      } catch (e: any) { setError(e.message ?? "Kon niet laden"); }
      finally { setLoading(false); }
    })();
  }, [table, id]); // eslint-disable-line

  // Resolve linked order label for create-mode
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data: o } = await (supabase as any).from("orders").select("id, order_number").eq("id", orderId).maybeSingle();
      if (o) setOrderRef(o);
    })();
  }, [orderId]);

  const done = () => {
    if (returnTo) navigate(returnTo);
    else if (cfg?.detailPath && id) navigate(cfg.detailPath(id));
    else if (cfg) navigate(cfg.listPath);
    else navigate(-1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg) return;
    for (const f of allFields(cfg)) {
      if (f.required && !form[f.key]) { toast.error(`${f.label} is verplicht`); return; }
    }
    setSaving(true);
    try {
      const payload: any = {};
      for (const f of allFields(cfg)) {
        const v = form[f.key];
        payload[f.key] = v === "" || v === null || v === undefined ? null : f.type === "number" ? Number(v) : v;
      }
      if (isEdit) {
        const { error } = await (supabase as any).from(table).update(payload).eq("id", id);
        if (error) throw error;
        toast.success(`${cfg.label} opgeslagen`);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Niet ingelogd");
        payload.user_id = user.id;
        if (orderId && cfg.hasOrderLink) payload.order_id = orderId;
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
        toast.success(`${cfg.label} aangemaakt`);
      }
      done();
    } catch (e: any) { toast.error(e.message ?? "Kon niet opslaan"); }
    finally { setSaving(false); }
  };

  if (!cfg) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Onbekende tabel.</div>;
  }
  if (loading) {
    return <div className="p-16 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Laden…</div>;
  }
  if (error) {
    return (
      <div className="p-16 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div className="text-sm text-muted-foreground">{error}</div>
        <Link to={cfg.listPath} className="text-sm text-primary hover:underline">Terug naar {cfg.labelPlural}</Link>
      </div>
    );
  }

  const backTo = returnTo || (cfg.detailPath && id ? cfg.detailPath(id) : cfg.listPath);

  return (
    <form onSubmit={submit} className="min-h-screen pb-24">
      {/* ── Header ── */}
      <div className="border-b border-border bg-background">
        <div className="max-w-3xl mx-auto px-6 py-7">
          <Link to={backTo} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Terug
          </Link>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
              {cfg.labelPlural}
            </p>
            <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground leading-none">
              {isEdit ? `${cfg.label} bewerken` : `Nieuwe ${cfg.label.toLowerCase()}`}
            </h1>
            {orderRef && (
              <p className="text-sm text-muted-foreground mt-2.5">
                Gekoppeld aan order{" "}
                <Link to={`/orders/${orderRef.id}`} className="font-medium text-foreground hover:text-primary underline underline-offset-2">
                  {orderRef.order_number}
                </Link>
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Sections ── */}
      <motion.div
        variants={stagger(0.05, 0.08)}
        initial="hidden" animate="visible"
        className="max-w-3xl mx-auto px-6 py-8 space-y-5"
      >
        {cfg.sections.map((section) => (
          <motion.section
            key={section.title}
            variants={fadeUp}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="mb-5">
              <h2 className="font-display text-lg font-semibold text-foreground tracking-tight">{section.title}</h2>
              {section.description && <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              {section.fields.map((f) => (
                <FieldControl
                  key={f.key}
                  field={f}
                  value={form[f.key]}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                />
              ))}
            </div>
          </motion.section>
        ))}
      </motion.div>

      {/* ── Sticky action bar ── */}
      <div className="glass fixed bottom-0 inset-x-0 z-30 border-t border-border/60">
        <div className="max-w-3xl mx-auto px-6 py-3.5 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground hidden sm:block">
            {isEdit ? "Wijzigingen worden pas opgeslagen bij bevestigen." : "Vul de velden in en maak de record aan."}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Link
              to={backTo}
              className="h-9 px-4 rounded-xl border border-border bg-card text-sm font-medium flex items-center hover:bg-muted transition-colors"
            >
              Annuleer
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isEdit ? "Opslaan" : `${cfg.label} aanmaken`}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ── Field control ─────────────────────────────────────────────────────── */
function FieldControl({ field: f, value, onChange }: { field: OpsField; value: any; onChange: (v: any) => void }) {
  const inputCls =
    "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-all " +
    "focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)] placeholder:text-muted-foreground/50";

  return (
    <div className={`flex flex-col gap-1.5 ${f.full ? "sm:col-span-2" : ""}`}>
      <label className="text-xs font-semibold text-foreground">
        {f.label}
        {f.required && <span className="text-primary ml-0.5">*</span>}
      </label>

      {f.type === "textarea" ? (
        <Textarea
          rows={4}
          value={value ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="resize-none rounded-lg"
        />
      ) : f.type === "select" && f.options ? (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className="h-10 rounded-lg capitalize"><SelectValue placeholder="Kies…" /></SelectTrigger>
          <SelectContent>
            {f.options.map((o) => <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "date" ? "datetime-local" : "text"}
          value={value ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}

      {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
    </div>
  );
}
