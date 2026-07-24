import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp } from "@/lib/motion";
import {
  ArrowLeft, HeartPulse, ShieldCheck, AlertTriangle, Check, RotateCcw, Loader2, MessageSquare,
  ClipboardList, Send, Trash2, Circle, Copy, Flag, Boxes, Undo2, Star, Wrench, ArrowUpRight,
  PackagePlus, FlaskConical, Pause, Clock,
} from "lucide-react";
import {
  HEALTH_STATUSES, statusMeta, toneColor, computeSeverity, stockSignal, returnSignal, reviewSignal,
  ACTIONS, actionMeta, PH_OUTCOMES, usePHOwner, setPHOwner, clearPHOwner, usePHLog, addPHLog,
  usePHNotes, addPHNote, removePHNote, usePHMeta, setPHMeta,
  type HealthStatus, type ActionId, type PHLogKind, type Signal,
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

  const me = useCurrentUser();
  const owner = usePHOwner(id);
  const log = usePHLog(id);
  const notes = usePHNotes(id);
  const meta = usePHMeta(id);

  const iAmOwner = !!owner && !!me.email && owner.email.toLowerCase() === me.email.toLowerCase();
  const otherOwns = !!owner && !iAmOwner;
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

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success("Gekopieerd — klaar om te plakken."); } catch { toast.error("Kopiëren niet gelukt."); } };

  const patch = async (patchObj: Partial<Product>) => {
    setP((prev) => prev ? { ...prev, ...patchObj } : prev);
    if (backend === "local") { try { const arr = JSON.parse(localStorage.getItem("gb_product_health") || "[]") as Product[]; localStorage.setItem("gb_product_health", JSON.stringify(arr.map((x) => x.id === id ? { ...x, ...patchObj } : x))); } catch { /* ignore */ } }
    else { const { error } = await (supabase as any).from("product_health").update(patchObj).eq("id", id); if (error) toast.error(error.message); }
  };
  const setMeta = (patchObj: Parameters<typeof setPHMeta>[1]) => setPHMeta(id, patchObj);

  const ensureOwner = () => { if (!owner && me.email) { setPHOwner(id, { email: me.email, name: me.name || me.email }); addPHLog(id, `${me.name || me.email} nam deze case op`, "owner", actor()); } };
  const claim = () => { if (!me.email) { toast.error("Geen gebruiker gevonden."); return; } setPHOwner(id, { email: me.email, name: me.name || me.email }); addPHLog(id, `${me.name || me.email} ${owner ? "nam de case over" : "nam deze case op"}`, "owner", actor()); };
  const release = () => { clearPHOwner(id); addPHLog(id, `${me.name || me.email || "Iemand"} gaf de case vrij`, "owner", actor()); };

  const setStatus = (s: HealthStatus) => { if (!p) return; ensureOwner(); patch({ status: s }); addPHLog(id, `Status → ${statusMeta(s).label}`, "status", actor()); };
  const chooseAction = (a: ActionId) => { ensureOwner(); setMeta({ action: a }); addPHLog(id, `Actie gekozen: ${actionMeta(a)?.label}`, "action", actor()); };
  const startAction = () => { if (!meta.action) return; setMeta({ actionStartedAt: new Date().toISOString() }); addPHLog(id, `Actie in gang gezet: ${actionMeta(meta.action)?.label}`, "action", actor()); toast.success("Actie in gang gezet."); };
  const resolve = (outcome: string) => { ensureOwner(); patch({ status: "resolved" }); setMeta({ resolvedAt: new Date().toISOString(), outcome }); addPHLog(id, `Case afgesloten — ${outcome}`, "resolution", actor()); };
  const reopen = () => { patch({ status: "watch" }); setMeta({ resolvedAt: null }); addPHLog(id, "Case heropend", "resolution", actor()); };
  const submitNote = () => { if (!note.trim()) return; ensureOwner(); addPHNote(id, note.trim(), actor()); setNote(""); };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!p) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div><p className="text-sm font-semibold text-foreground mb-1">Product niet gevonden</p><Link to="/product-health" className="text-sm text-primary hover:underline">← Terug naar Product Health</Link></div>
    </div>
  );

  const st = statusMeta(p.status);
  const sev = computeSeverity({ status: p.status, returnRate: p.return_rate, reviewScore: p.review_score, stock: p.stock });
  const resolved = p.status === "resolved";
  const chosen = actionMeta(meta.action);
  const started = !!meta.actionStartedAt;
  const msgCtx = { product: p.product_name ?? undefined, sku: p.sku ?? undefined };
  const sig = { stock: stockSignal(p.stock), ret: returnSignal(p.return_rate), rev: reviewSignal(p.review_score) };

  return (
    <div className="min-h-screen" style={sev.level >= 3 ? { background: `hsl(var(--${sev.tone}) / 0.04)` } : undefined}>
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <button onClick={() => navigate("/product-health")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Product Health</button>
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center" style={{ background: `hsl(var(--${st.tone}) / 0.12)` }}><HeartPulse className="h-5 w-5" style={{ color: toneColor(st.tone) }} /></span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{p.product_name || "Product"}</h1>
              <p className="text-sm text-muted-foreground">{p.sku ? `${p.sku} · ` : ""}{st.label}</p>
            </div>
          </div>
        </motion.div>

        {/* OWNER strip */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft px-4 py-3 flex items-center gap-3" style={otherOwns ? { boxShadow: "inset 0 0 0 1px hsl(var(--ember)/0.35)" } : undefined}>
          <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0" style={{ background: iAmOwner ? "hsl(var(--ok)/0.12)" : otherOwns ? "hsl(var(--ember)/0.12)" : "hsl(var(--muted))" }}>
            <ShieldCheck className="h-4 w-4" style={{ color: iAmOwner ? "hsl(var(--ok))" : otherOwns ? "hsl(var(--ember))" : "hsl(var(--muted-foreground))" }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eigenaar van deze case</p>
            {owner ? (
              <p className="text-sm text-foreground truncate"><span className="font-semibold">{owner.name}</span>{iAmOwner && <span className="ml-1.5 text-[10px] font-semibold text-ok bg-ok/12 rounded-full px-1.5 py-0.5 align-middle">jij</span>}<span className="text-muted-foreground font-normal"> · {owner.email}</span></p>
            ) : <p className="text-sm text-muted-foreground">Nog niemand behandelt dit product — neem het op zodat collega's weten dat jij bezig bent.</p>}
          </div>
          <div className="shrink-0">
            {!owner ? <button onClick={claim} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Ik neem dit op</button>
             : iAmOwner ? <button onClick={release} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Vrijgeven</button>
             : <button onClick={claim} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ border: "1px solid hsl(var(--ember)/0.4)", color: "hsl(var(--ember))" }}>Overnemen</button>}
          </div>
        </motion.div>

        {/* SEVERITY banner (auto-computed) */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ background: `hsl(var(--${sev.tone}) / 0.1)`, boxShadow: `inset 0 0 0 1px hsl(var(--${sev.tone}) / 0.35)` }}>
          <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white font-num font-bold" style={{ background: toneColor(sev.tone) }}>{sev.level >= 3 ? <AlertTriangle className="h-5 w-5" /> : sev.level > 0 ? `N${sev.level}` : <Check className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: toneColor(sev.tone) }}>{sev.level > 0 ? `Niveau ${sev.level} · ${sev.label}` : sev.label}</p>
            <p className="text-xs text-muted-foreground">Automatisch bepaald ({sev.reason}) · <span className="font-medium text-foreground">{sev.sla}</span></p>
          </div>
          {sev.level >= 3 && <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" style={{ color: toneColor(sev.tone) }} />}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-5">
            {/* SECTIE 1 — Signalen & status */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <SectionHead n={1} title="Signalen & status" />
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Voorraad" icon={<Boxes className="h-3.5 w-3.5" />} value={p.stock ?? 0} suffix="" sig={sig.stock} onChange={(v) => patch({ stock: v })} />
                <Metric label="Retour-ratio" icon={<Undo2 className="h-3.5 w-3.5" />} value={p.return_rate ?? 0} suffix="%" sig={sig.ret} step="0.1" onChange={(v) => patch({ return_rate: v })} />
                <Metric label="Review score" icon={<Star className="h-3.5 w-3.5" />} value={p.review_score ?? 0} suffix="/5" sig={sig.rev} step="0.1" onChange={(v) => patch({ review_score: v })} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {HEALTH_STATUSES.filter((s) => s.id !== "resolved").map((s) => {
                  const active = p.status === s.id; const col = toneColor(s.tone);
                  return (
                    <button key={s.id} onClick={() => setStatus(s.id)} title={s.desc}
                      className="h-8 px-2.5 rounded-lg text-[11px] font-medium border transition-colors"
                      style={active ? { background: col, color: "#fff", borderColor: col } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{st.desc}</p>
            </motion.div>

            {/* SECTIE 2 — Herstelacties */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <SectionHead n={2} title="Herstelacties" />
              <div className="space-y-2">
                {ACTIONS.map((a) => {
                  const active = meta.action === a.id;
                  const Icon = a.id === "restock" ? PackagePlus : a.id === "supplier_qa" ? Wrench : a.id === "review_outreach" ? MessageSquare : a.id === "reformulate" ? FlaskConical : Pause;
                  return (
                    <button key={a.id} onClick={() => chooseAction(a.id)} disabled={resolved}
                      className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-colors disabled:opacity-60 ${active ? "border-primary/50 bg-primary/[0.05]" : "border-border bg-card hover:border-primary/30"}`}
                      style={a.urgent && !active ? { boxShadow: "inset 0 0 0 1px hsl(var(--ember)/0.3)" } : undefined}>
                      <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: active ? "hsl(var(--primary))" : a.urgent ? "hsl(var(--ember)/0.15)" : "hsl(var(--muted))", color: active ? "#fff" : a.urgent ? "hsl(var(--ember))" : "hsl(var(--muted-foreground))" }}><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] font-medium text-foreground">{a.label}</p>
                          {a.urgent && <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5" style={{ background: "hsl(var(--ember)/0.15)", color: "hsl(var(--ember))" }}><Zap /> urgent</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground shrink-0 text-right max-w-[100px]">{a.impact}</span>
                    </button>
                  );
                })}
              </div>
              {chosen && !resolved && (
                <>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{started ? <>In gang gezet · {relTime(meta.actionStartedAt!)}</> : `Gekozen: ${chosen.label}`}</p>
                    <button onClick={startAction} disabled={started} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                      {started ? <><Check className="h-4 w-4" /> In gang gezet</> : <>Zet in gang <ArrowUpRight className="h-3.5 w-3.5" /></>}
                    </button>
                  </div>
                  {/* ready-to-copy supplier/internal message for the chosen action */}
                  <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Kant-en-klaar bericht · {chosen.label}</p>
                      <button onClick={() => copy(chosen.message(msgCtx))} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1"><Copy className="h-3 w-3" /> Kopieer</button>
                    </div>
                    <p className="text-[12px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{chosen.message(msgCtx)}</p>
                  </div>
                </>
              )}
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

          {/* SIDEBAR */}
          <div className="space-y-5">
            {/* Product & oorzaak */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <SectionHead n={3} title="Product & oorzaak" />
              <Field label="SKU"><input value={p.sku ?? ""} onChange={(e) => patch({ sku: e.target.value })} placeholder="SKU" className="w-full bg-transparent text-[13px] outline-none font-mono" /></Field>
              <Field label="Bekende issues"><textarea value={p.issues ?? ""} onChange={(e) => patch({ issues: e.target.value })} rows={3} placeholder="Wat is er aan de hand met dit product?" className="w-full bg-transparent text-[13px] outline-none resize-none" /></Field>
              <Field label="Vermoedelijke oorzaak"><textarea value={meta.rootCause ?? ""} onChange={(e) => setMeta({ rootCause: e.target.value })} rows={2} placeholder="bv. slechte batch, transport, seizoensvraag" className="w-full bg-transparent text-[13px] outline-none resize-none" /></Field>
              <div className="flex items-center justify-between text-xs pt-0.5"><span className="text-muted-foreground">Toegevoegd</span><span className="font-medium text-foreground">{fmtDate(p.created_at)}</span></div>
            </motion.div>

            {/* Ernst detail */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <SectionHead n={4} title="Ernst & prioriteit" />
              <div className="rounded-xl px-3 py-2.5" style={{ background: `hsl(var(--${sev.tone}) / 0.07)` }}>
                <div className="flex items-center justify-between"><span className="text-[13px] font-semibold" style={{ color: toneColor(sev.tone) }}>{sev.level > 0 ? `Niveau ${sev.level}` : "Gezond"}</span><span className="text-xs text-muted-foreground">{sev.label}</span></div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3" /> {sev.sla}</p>
              </div>
              <div className="space-y-1.5">
                {([["Voorraad", sig.stock], ["Retour-ratio", sig.ret], ["Reviews", sig.rev]] as [string, Signal][]).map(([lbl, s]) => (
                  <div key={lbl} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{lbl}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: `hsl(var(--${s.tone}) / 0.1)`, color: toneColor(s.tone), borderColor: `hsl(var(--${s.tone}) / 0.35)` }}>{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">De ernst wordt automatisch bepaald door het slechtste signaal (voorraad, retour-ratio, reviews of status).</p>
            </motion.div>

            {/* Resolutie */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <SectionHead n={5} title="Resolutie & afsluiting" />
              {resolved ? (
                <div className="rounded-xl bg-ok/10 border border-ok/20 px-3 py-3">
                  <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-full bg-ok grid place-items-center"><Check className="h-4 w-4 text-white" /></span><div><p className="text-[13px] font-semibold text-foreground">Opgelost</p><p className="text-xs text-muted-foreground">{meta.outcome || "—"} · {fmtDate(meta.resolvedAt)}</p></div></div>
                  <button onClick={reopen} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Heropenen</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Sluit de case af met de uitkomst.{started && chosen && <> De uitkomst van je actie staat <span className="font-medium" style={{ color: "hsl(var(--ok))" }}>groen</span> gemarkeerd.</>}</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PH_OUTCOMES.map((o) => {
                      const suggested = started && chosen?.outcome === o;
                      return (
                        <button key={o} onClick={() => resolve(o)}
                          className={`h-9 px-3 rounded-lg border text-[13px] font-medium text-left flex items-center gap-2 transition-colors ${suggested ? "" : "border-border text-foreground hover:border-ok/50 hover:bg-ok/[0.04]"}`}
                          style={suggested ? { borderColor: "hsl(var(--ok))", background: "hsl(var(--ok)/0.1)", color: "hsl(var(--ok))" } : undefined}>
                          {suggested ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />} {o}
                          {suggested && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide">uit actie</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* tiny inline zap for the urgent badge (keeps imports lean) */
function Zap() { return <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>; }

function Metric({ label, icon, value, suffix, sig, step, onChange }: { label: string; icon: React.ReactNode; value: number; suffix: string; sig: Signal; step?: string; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span></div>
      <div className="flex items-baseline gap-1">
        <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-transparent font-num text-xl font-bold tabular-nums outline-none text-foreground" />
        {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
      </div>
      <span className="mt-1 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ background: `hsl(var(--${sig.tone}) / 0.1)`, color: toneColor(sig.tone), borderColor: `hsl(var(--${sig.tone}) / 0.35)` }}>{sig.label}</span>
    </div>
  );
}
function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="h-6 w-6 rounded-lg grid place-items-center text-[11px] font-bold shrink-0" style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}>{n}</span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      {children}
    </div>
  );
}
const LogIcon = ({ kind }: { kind: PHLogKind }) => {
  const c = kind === "status" ? "hsl(var(--info))" : kind === "action" ? "hsl(var(--primary))" : kind === "owner" ? "hsl(var(--ember))" : kind === "resolution" ? "hsl(var(--ok))" : "hsl(var(--primary))";
  const I = kind === "status" ? Flag : kind === "action" ? Wrench : kind === "owner" ? ShieldCheck : kind === "resolution" ? Check : Circle;
  return <I className="h-3 w-3" style={{ color: c }} />;
};
