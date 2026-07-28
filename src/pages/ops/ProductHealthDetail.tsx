import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp } from "@/lib/motion";
import {
  ArrowLeft, HeartPulse, AlertTriangle, Check, Loader2, MessageSquare, ClipboardList, Send,
  Trash2, Circle, Flag, Boxes, Undo2, Star, Wrench, PackagePlus, FlaskConical, Pause, Clock,
  SlidersHorizontal,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HEALTH_STATUSES, statusMeta, toneColor, computeSeverity, stockSignal, returnSignal, reviewSignal,
  ACTIONS, actionMeta, usePHLog, addPHLog, usePHNotes, addPHNote, removePHNote, usePHMeta, setPHMeta,
  usePHThresholds, setPHThresholds, DEFAULT_THRESHOLDS,
  type HealthStatus, type ActionId, type PHLogKind, type Signal, type PHThresholds,
} from "@/lib/productHealthCase";
import { useCurrentUser } from "@/lib/superuser";

type Product = { id: string; product_name: string | null; sku: string | null; status: string; stock: number | null; return_rate: number | null; review_score: number | null; issues: string | null; created_at?: string };

const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const relTime = (iso: string) => { const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return "net nu"; if (s < 3600) return `${Math.floor(s / 60)} min geleden`; if (s < 86400) return `${Math.floor(s / 3600)} u geleden`; return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
const initials = (name?: string) => (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

async function detect(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}

export default function ProductHealthDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<Product | null>(null);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const me = useCurrentUser();
  const log = usePHLog(id);
  const notes = usePHNotes(id);
  const meta = usePHMeta(id);
  const thr = usePHThresholds();

  const actor = () => ({ by: me.email, byName: me.name || me.email || "Onbekend" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const be = await detect("product_health"); setBackend(be);
      let row: Product | null = null;
      if (be === "supabase") { const { data } = await (supabase as any).from("product_health").select("*").eq("id", id).maybeSingle(); row = data ?? null; }
      else { try { row = (JSON.parse(localStorage.getItem("gb_product_health") || "[]") as Product[]).find((x) => x.id === id) ?? null; } catch { row = null; } }
      setP(row);
      setLoading(false);
    })();
  }, [id]);

  const patch = async (patchObj: Partial<Product>) => {
    setP((prev) => prev ? { ...prev, ...patchObj } : prev);
    if (backend === "local") { try { const arr = JSON.parse(localStorage.getItem("gb_product_health") || "[]") as Product[]; localStorage.setItem("gb_product_health", JSON.stringify(arr.map((x) => x.id === id ? { ...x, ...patchObj } : x))); } catch { /* ignore */ } }
    else { const { error } = await (supabase as any).from("product_health").update(patchObj).eq("id", id); if (error) toast.error(error.message); }
  };
  const setMeta = (patchObj: Parameters<typeof setPHMeta>[1]) => setPHMeta(id, patchObj);

  const setStatus = (s: HealthStatus) => { if (!p) return; patch({ status: s }); addPHLog(id, `Status → ${statusMeta(s).label}`, "status", actor()); };
  const chooseAction = (a: ActionId) => { setMeta({ action: a }); addPHLog(id, `Bezig met fixen: ${actionMeta(a)?.label}`, "action", actor()); };
  const clearAction = () => { setMeta({ action: undefined }); addPHLog(id, "Herstelactie gestopt", "action", actor()); };
  const submitNote = () => { if (!note.trim()) return; addPHNote(id, note.trim(), actor()); setNote(""); };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!p) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div><p className="text-sm font-semibold text-foreground mb-1">Product niet gevonden</p><Link to="/product-health" className="text-sm text-primary hover:underline">← Terug naar Product Health</Link></div>
    </div>
  );

  const st = statusMeta(p.status);
  const sev = computeSeverity({ status: p.status, returnRate: p.return_rate, reviewScore: p.review_score, stock: p.stock }, thr);
  const chosen = actionMeta(meta.action);
  const sig = { stock: stockSignal(p.stock, thr), ret: returnSignal(p.return_rate, thr), rev: reviewSignal(p.review_score, thr) };

  return (
    <div className="min-h-screen" style={sev.level >= 3 ? { background: `hsl(var(--${sev.tone}) / 0.04)` } : undefined}>
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/product-health")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Product Health</button>
          <button onClick={() => setSettingsOpen(true)} className="h-8 px-2.5 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5" title="Stel in waarop de gezondheid gebaseerd is"><SlidersHorizontal className="h-3.5 w-3.5" /> Drempels</button>
        </div>

        {/* STATUS HERO — product + health status at a glance */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="card-soft p-5" style={{ background: `hsl(var(--${sev.tone}) / 0.06)`, boxShadow: `inset 0 0 0 1px hsl(var(--${sev.tone}) / 0.35)` }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-12 w-12 rounded-2xl grid place-items-center shrink-0" style={{ background: `hsl(var(--${sev.tone}) / 0.14)` }}>
                {sev.level >= 3 ? <AlertTriangle className="h-6 w-6" style={{ color: toneColor(sev.tone) }} /> : <HeartPulse className="h-6 w-6" style={{ color: toneColor(sev.tone) }} />}
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{p.product_name || "Product"}</h1>
                <p className="text-sm text-muted-foreground">{p.sku ? `${p.sku} · ` : ""}toegevoegd {fmtDate(p.created_at)}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold border" style={{ background: `hsl(var(--${st.tone}) / 0.12)`, color: toneColor(st.tone), borderColor: `hsl(var(--${st.tone}) / 0.4)` }}>
                {sev.level >= 3 && <AlertTriangle className="h-3.5 w-3.5" />}{st.label}
              </span>
              <p className="text-[11px] text-muted-foreground mt-1.5">Inschatting: <span className="font-medium" style={{ color: toneColor(sev.tone) }}>{sev.label}</span> · {sev.reason}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5"><Clock className="h-3 w-3" /> {sev.sla}</p>
            </div>
          </div>
          {/* set status */}
          <div className="mt-4 pt-4 border-t border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status instellen</p>
            <div className="flex flex-wrap gap-1.5">
              {HEALTH_STATUSES.filter((s) => s.id !== "resolved").map((s) => {
                const active = p.status === s.id; const col = toneColor(s.tone);
                return (
                  <button key={s.id} onClick={() => setStatus(s.id)} title={s.desc}
                    className="h-8 px-3 rounded-lg text-[11px] font-medium border transition-colors"
                    style={active ? { background: col, color: "#fff", borderColor: col } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ACTIVE FIX — indicated across the page */}
        {chosen && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "hsl(var(--primary)/0.07)", boxShadow: "inset 0 0 0 1px hsl(var(--primary)/0.3)" }}>
            <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0 bg-primary text-primary-foreground"><Wrench className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">We zijn dit aan het doen om het te fixen</p>
              <p className="text-sm font-semibold text-foreground">{chosen.label}</p>
            </div>
            <button onClick={clearAction} className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground shrink-0">Stop</button>
          </motion.div>
        )}

        {/* KEY METRICS — the basis for the health status */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">Key metrics · waarop de gezondheid gebaseerd is</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric label="Voorraad" icon={<Boxes className="h-4 w-4" />} value={p.stock ?? 0} suffix="" sig={sig.stock} onChange={(v) => patch({ stock: v })} />
            <Metric label="Retour-ratio" icon={<Undo2 className="h-4 w-4" />} value={p.return_rate ?? 0} suffix="%" sig={sig.ret} step="0.1" onChange={(v) => patch({ return_rate: v })} />
            <Metric label="Review score" icon={<Star className="h-4 w-4" />} value={p.review_score ?? 0} suffix="/5" sig={sig.rev} step="0.1" onChange={(v) => patch({ review_score: v })} />
          </div>
        </motion.div>

        {/* ACTIES — even row of action tiles */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
          <div className="flex items-center gap-2 mb-3"><Wrench className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Acties</h2><span className="text-[11px] text-muted-foreground">· kies wat je nu doet</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {ACTIONS.map((a) => {
              const active = meta.action === a.id;
              const Icon = a.id === "restock" ? PackagePlus : a.id === "supplier_qa" ? Wrench : a.id === "review_outreach" ? MessageSquare : a.id === "reformulate" ? FlaskConical : Pause;
              return (
                <button key={a.id} onClick={() => (active ? clearAction() : chooseAction(a.id))} title={a.desc}
                  className={`relative rounded-xl border px-2 py-3 flex flex-col items-center text-center gap-2 transition-colors ${active ? "border-primary bg-primary/[0.06]" : "border-border bg-card hover:border-primary/30"}`}
                  style={a.urgent && !active ? { boxShadow: "inset 0 0 0 1px hsl(var(--ember)/0.3)" } : undefined}>
                  <span className="h-9 w-9 rounded-lg grid place-items-center shrink-0" style={{ background: active ? "hsl(var(--primary))" : a.urgent ? "hsl(var(--ember)/0.15)" : "hsl(var(--muted))", color: active ? "#fff" : a.urgent ? "hsl(var(--ember))" : "hsl(var(--muted-foreground))" }}><Icon className="h-4 w-4" /></span>
                  <span className={`text-[11px] font-medium leading-tight ${active ? "text-foreground" : "text-muted-foreground"}`}>{a.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary absolute top-1.5 right-1.5" />}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Interne notities */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
          <div className="flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Interne notities</h2></div>
          <div className="flex items-start gap-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Interne opmerking (bv. leverancier gebeld, batch-nr genoteerd)…" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }} className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
            <button onClick={submitNote} disabled={!note.trim()} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-4 space-y-3">
            {notes.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">Nog geen notities.</p> : notes.map((n) => (
              <div key={n.at} className="group flex gap-3">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold shrink-0 mt-0.5">{initials(n.byName)}</span>
                <div className="flex-1 min-w-0 pb-1"><p className="text-[13px] text-foreground whitespace-pre-wrap">{n.text}</p><p className="text-[11px] text-muted-foreground mt-0.5"><span className="font-medium text-foreground/80">{n.byName || "Onbekend"}</span> · {relTime(n.at)}</p></div>
                <button onClick={() => removePHNote(id, n.at)} className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded text-muted-foreground/50 hover:text-bad transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Log */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
          <div className="flex items-center gap-2 mb-3"><ClipboardList className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Log</h2><span className="text-[11px] text-muted-foreground">· wie deed wat</span></div>
          {log.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">Nog geen activiteit.</p> : (
            <div className="space-y-0">{log.map((l, i) => (
              <div key={l.at} className="flex gap-3">
                <div className="flex flex-col items-center"><span className="h-6 w-6 rounded-full grid place-items-center shrink-0" style={{ background: "hsl(var(--muted))" }}><LogIcon kind={l.kind} /></span>{i < log.length - 1 && <span className="w-px flex-1 bg-border my-1" />}</div>
                <div className="flex-1 min-w-0 pb-4"><p className="text-[13px] text-foreground">{l.text}</p><p className="text-[11px] text-muted-foreground mt-0.5"><span className="font-medium text-foreground/80">{l.byName || "Onbekend"}</span> · {relTime(l.at)}</p></div>
              </div>
            ))}</div>
          )}
        </motion.div>
      </div>

      <ThresholdsDialog open={settingsOpen} onOpenChange={setSettingsOpen} thr={thr} />
    </div>
  );
}

function Metric({ label, icon, value, suffix, sig, step, onChange }: { label: string; icon: React.ReactNode; value: number; suffix: string; sig: Signal; step?: string; onChange: (v: number) => void }) {
  return (
    <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `hsl(var(--${sig.tone}) / 0.4)`, background: `hsl(var(--${sig.tone}) / 0.05)` }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5" style={{ color: toneColor(sig.tone) }}>{icon}<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span></div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: `hsl(var(--${sig.tone}) / 0.12)`, color: toneColor(sig.tone), borderColor: `hsl(var(--${sig.tone}) / 0.4)` }}>{sig.label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-transparent font-num text-3xl font-bold tabular-nums outline-none text-foreground" />
        {suffix && <span className="text-sm text-muted-foreground shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function ThrRow({ label, value, onChange, step }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; step?: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-foreground">{label}</span><input type="number" step={step} value={value} onChange={onChange} className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-sm text-right tabular-nums outline-none focus:border-primary/40" /></div>;
}
function ThresholdsDialog({ open, onOpenChange, thr }: { open: boolean; onOpenChange: (o: boolean) => void; thr: PHThresholds }) {
  const [f, setF] = useState<PHThresholds>(thr);
  useEffect(() => { if (open) setF(thr); }, [open, thr]);
  const upd = (k: keyof PHThresholds) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: parseFloat(e.target.value) || 0 }));
  const save = () => { setPHThresholds(f); onOpenChange(false); toast.success("Drempels opgeslagen."); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display text-lg flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /> Gezondheidsdrempels</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Bepaal zelf wanneer een metric goed, matig of slecht is. Wat “veel voorraad” is, verschilt per merk — dit geldt voor alle producten.</p>
        <div className="space-y-3 mt-1">
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Voorraad (stuks)</p>
            <ThrRow label="Krap onder" value={f.stockWarn} onChange={upd("stockWarn")} />
            <ThrRow label="Lage voorraad onder" value={f.stockLow} onChange={upd("stockLow")} />
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Retour-ratio (%)</p>
            <ThrRow label="Verhoogd vanaf" value={f.retWarn} onChange={upd("retWarn")} step="0.1" />
            <ThrRow label="Hoog vanaf" value={f.retHigh} onChange={upd("retHigh")} step="0.1" />
            <ThrRow label="Zeer hoog vanaf" value={f.retSevere} onChange={upd("retSevere")} step="0.1" />
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Review score (/5)</p>
            <ThrRow label="Sterk vanaf" value={f.revStrong} onChange={upd("revStrong")} step="0.1" />
            <ThrRow label="Redelijk vanaf" value={f.revFair} onChange={upd("revFair")} step="0.1" />
            <ThrRow label="Slecht onder" value={f.revBad} onChange={upd("revBad")} step="0.1" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setF(DEFAULT_THRESHOLDS)} className="text-xs text-muted-foreground hover:text-foreground">Herstel standaard</button>
          <div className="flex gap-2">
            <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">Annuleer</button>
            <button onClick={save} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium">Opslaan</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
const LogIcon = ({ kind }: { kind: PHLogKind }) => {
  const c = kind === "status" ? "hsl(var(--info))" : kind === "action" ? "hsl(var(--primary))" : kind === "resolution" ? "hsl(var(--ok))" : "hsl(var(--primary))";
  const I = kind === "status" ? Flag : kind === "action" ? Wrench : kind === "resolution" ? Check : Circle;
  return <I className="h-3 w-3" style={{ color: c }} />;
};
