import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp } from "@/lib/motion";
import { ArrowLeft, ExternalLink, Check, X, RotateCcw, Send, Trash2, Circle, Loader2, Undo2, Ban, ShieldCheck, PackageCheck, BadgeEuro, Flag, ListChecks, MessageSquare, ClipboardList, ArrowRight, CreditCard, Wallet } from "lucide-react";
import { useSteps, useNotes, addNote, removeNote, useOutcome, setOutcome, ladderState, refundPct, useLog, addLog, useOwner, setOwner, clearOwner, useMeta, setMeta, useReturnMethod, setReturnMethod, METHOD_GROUPS, methodLabel, type MethodGroup, type LogKind } from "@/lib/returnsSteps";
import { pingReturns } from "@/lib/returnsData";
import { useCurrentUser } from "@/lib/superuser";

type Ret = { id: string; order_id: string | null; reason: string | null; status: string; refund_amount: number | null; currency: string | null; notes: string | null; created_at?: string };
type Order = { id: string; order_number: string | null; customer_name: string | null; customer_email?: string | null };

const FLOW = ["requested", "approved", "received", "refunded"];
const FLOW_LABEL: Record<string, string> = { requested: "Aangevraagd", approved: "Goedgekeurd", received: "Ontvangen", refunded: "Terugbetaald" };
const eur = (v: number, c = "EUR") => new Intl.NumberFormat("nl-BE", { style: "currency", currency: c || "EUR" }).format(v || 0);
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const relTime = (iso: string) => { const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return "net nu"; if (s < 3600) return `${Math.floor(s / 60)} min geleden`; if (s < 86400) return `${Math.floor(s / 3600)} u geleden`; return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

async function detect(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}

export default function ReturnDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [ret, setRet] = useState<Ret | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  const me = useCurrentUser();
  const method = useReturnMethod(id);
  const steps = useSteps(method ?? "other");
  const outcomes = useOutcome(id);
  const notes = useNotes(id);
  const log = useLog(id);
  const owner = useOwner(id);
  const meta = useMeta(id);
  const ls = ladderState(outcomes, steps.length);

  const iAmOwner = !!owner && !!me.email && owner.email.toLowerCase() === me.email.toLowerCase();
  const otherOwns = !!owner && !iAmOwner;
  const actor = () => ({ by: me.email, byName: me.name || me.email || "Onbekend" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const be = await detect("returns"); setBackend(be);
      let r: Ret | null = null;
      if (be === "supabase") { const { data } = await (supabase as any).from("returns").select("*").eq("id", id).maybeSingle(); r = data ?? null; }
      else { try { r = (JSON.parse(localStorage.getItem("gb_returns") || "[]") as Ret[]).find((x) => x.id === id) ?? null; } catch { r = null; } }
      setRet(r);
      if (r?.order_id) {
        let o: Order | null = null;
        if (be === "supabase") { const { data } = await (supabase as any).from("orders").select("*").eq("id", r.order_id).maybeSingle(); o = data ?? null; }
        else { try { o = (JSON.parse(localStorage.getItem("gb_orders") || "[]") as Order[]).find((x) => x.id === r!.order_id) ?? null; } catch { o = null; } }
        setOrder(o);
      }
      setLoading(false);
    })();
  }, [id]);

  const patch = async (p: Partial<Ret>) => {
    setRet((prev) => prev ? { ...prev, ...p } : prev);
    if (backend === "local") {
      try { const arr = JSON.parse(localStorage.getItem("gb_returns") || "[]") as Ret[]; localStorage.setItem("gb_returns", JSON.stringify(arr.map((x) => x.id === id ? { ...x, ...p } : x))); } catch { /* ignore */ }
    } else { const { error } = await (supabase as any).from("returns").update(p).eq("id", id); if (error) toast.error(error.message); }
    if (p.status !== undefined) pingReturns(); // keep the sidebar open-count in sync
  };

  // claim ownership silently on first action, so the audit trail always has an actor
  const ensureOwner = () => { if (!owner && me.email) { setOwner(id, { email: me.email, name: me.name || me.email }); addLog(id, `${me.name || me.email} nam deze case op`, "owner", actor()); } };
  const claim = () => { if (!me.email) { toast.error("Geen gebruiker gevonden."); return; } setOwner(id, { email: me.email, name: me.name || me.email }); addLog(id, `${me.name || me.email} ${owner ? "nam de case over" : "nam deze case op"}`, "owner", actor()); };
  const release = () => { clearOwner(id); addLog(id, `${me.name || me.email || "Iemand"} gaf de case vrij`, "owner", actor()); };

  const setStatus = (s: string) => {
    if (!ret) return;
    ensureOwner();
    patch({ status: s });
    if (s === "refunded") {
      // only pay out the accepted phase's share (10% korting → 10%), not the full amount
      const pct = refundPct(outcomes, steps);
      const payout = round2((ret.refund_amount ?? 0) * pct / 100);
      setMeta(id, { resolvedAt: new Date().toISOString(), refundedTotal: payout, refundedPct: pct });
      addLog(id, `Status → Terugbetaald · ${eur(payout, ret.currency ?? "EUR")} (${pct}%)`, "status", actor());
      return;
    }
    if (s === "rejected") setMeta(id, { resolvedAt: new Date().toISOString() });
    else setMeta(id, { resolvedAt: null });
    addLog(id, `Status → ${s === "rejected" ? "Afgewezen" : (FLOW_LABEL[s] ?? s)}`, "status", actor());
  };

  const accept = (i: number) => {
    if (!ret) return;
    ensureOwner();
    setOutcome(id, i, "accepted");
    // any accepted phase → status at least Goedgekeurd, regardless of which step
    const bump = ret.status === "rejected" || FLOW.indexOf(ret.status) < FLOW.indexOf("approved");
    if (bump) patch({ status: "approved" });
    addLog(id, `Stap ${i + 1} geaccepteerd — ${steps[i]?.label ?? ""}${bump ? " → Goedgekeurd" : ""}`, "step", actor());
  };
  const reject = (i: number) => { ensureOwner(); setOutcome(id, i, "rejected"); addLog(id, `Stap ${i + 1} niet geaccepteerd — ${steps[i]?.label ?? ""}`, "step", actor()); };
  const undo = (i: number) => { setOutcome(id, i, null); addLog(id, `Beslissing stap ${i + 1} teruggedraaid`, "step", actor()); };
  const submitNote = () => { if (!note.trim()) return; ensureOwner(); addNote(id, note.trim(), actor()); setNote(""); };

  const chooseMethod = (g: MethodGroup) => { ensureOwner(); setReturnMethod(id, g); addLog(id, `Betaalmethode gekozen: ${methodLabel(g)} — stappenplan geladen`, "step", actor()); };
  const changeMethod = () => { Object.keys(outcomes).forEach((k) => setOutcome(id, Number(k), null)); setReturnMethod(id, null); addLog(id, `Betaalmethode gewijzigd — stappenplan opnieuw te kiezen`, "step", actor()); };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!ret) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div><p className="text-sm font-semibold text-foreground mb-1">Retour niet gevonden</p><Link to="/returns" className="text-sm text-primary hover:underline">← Terug naar Returns</Link></div>
    </div>
  );

  const lastDecided = ls.resolved ? (ls.acceptedIdx as number) : ls.currentIdx - 1;
  const locked = ret.status === "rejected"; // afgewezen → alles vergrendeld + rood
  // how much actually gets refunded: the accepted phase's share (10% → 10%), full if none accepted
  const pct = refundPct(outcomes, steps);
  const decided = ls.resolved || ls.complete;
  const expectedPayout = round2((ret.refund_amount ?? 0) * pct / 100);

  return (
    <div className="min-h-screen" style={locked ? { background: "hsl(var(--bad)/0.04)" } : undefined}>
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
          <button onClick={() => navigate("/returns")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Returns</button>
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center" style={{ background: "hsl(var(--bad)/0.12)" }}><RotateCcw className="h-5 w-5" style={{ color: "hsl(var(--bad))" }} /></span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{order ? (order.order_number || "Retour") : "Retour"}</h1>
              <p className="text-sm text-muted-foreground">{ret.reason || "Geen reden opgegeven"}</p>
            </div>
          </div>
        </motion.div>

        {/* REJECTED — locked banner (the only live control is Heropenen) */}
        {locked && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ background: "hsl(var(--bad)/0.1)", boxShadow: "inset 0 0 0 1px hsl(var(--bad)/0.3)" }}>
            <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0" style={{ background: "hsl(var(--bad)/0.15)" }}><Ban className="h-4 w-4" style={{ color: "hsl(var(--bad))" }} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-bad">Retour afgewezen — case vergrendeld</p>
              <p className="text-xs text-muted-foreground">Er zijn geen acties meer mogelijk. Heropen de case om opnieuw te kunnen werken.</p>
            </div>
            <button onClick={() => setStatus("requested")} className="h-9 px-4 rounded-lg text-white text-[13px] font-medium flex items-center gap-1.5 shrink-0" style={{ background: "hsl(var(--bad))" }}><RotateCcw className="h-4 w-4" /> Heropenen</button>
          </motion.div>
        )}

        {/* everything below is disabled + red-tinted when the return is rejected */}
        <div className={`space-y-5 ${locked ? "pointer-events-none select-none [&_.card-soft]:ring-1 [&_.card-soft]:ring-bad/40" : ""}`}>
        {/* OWNER — small strip card so others don't step in */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft px-4 py-3 flex items-center gap-3" style={otherOwns && !locked ? { boxShadow: "inset 0 0 0 1px hsl(var(--ember)/0.35)" } : undefined}>
          <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0" style={{ background: iAmOwner ? "hsl(var(--ok)/0.12)" : otherOwns ? "hsl(var(--ember)/0.12)" : "hsl(var(--muted))" }}>
            <ShieldCheck className="h-4 w-4" style={{ color: iAmOwner ? "hsl(var(--ok))" : otherOwns ? "hsl(var(--ember))" : "hsl(var(--muted-foreground))" }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eigenaar van deze case</p>
            {owner ? (
              <p className="text-sm text-foreground truncate">
                <span className="font-semibold">{owner.name}</span>
                {iAmOwner && <span className="ml-1.5 text-[10px] font-semibold text-ok bg-ok/12 rounded-full px-1.5 py-0.5 align-middle">jij</span>}
                <span className="text-muted-foreground font-normal"> · {owner.email}</span>
              </p>
            ) : <p className="text-sm text-muted-foreground">Nog niemand behandelt deze case — neem ze op zodat collega's weten dat jij bezig bent.</p>}
          </div>
          <div className="shrink-0">
            {!owner ? <button onClick={claim} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Ik neem dit op</button>
             : iAmOwner ? <button onClick={release} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Vrijgeven</button>
             : <button onClick={claim} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ border: "1px solid hsl(var(--ember)/0.4)", color: "hsl(var(--ember))" }}>Overnemen</button>}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* STATUS CARD */}
            <StatusCard status={ret.status} currency={ret.currency ?? "EUR"} refundedTotal={meta.refundedTotal ?? 0} refundedPct={meta.refundedPct ?? 100} pendingPayout={expectedPayout} payoutPct={pct} resolvedAt={meta.resolvedAt ?? null} onSet={setStatus} />

            {/* CS STEP PLAN — first pick the payment method, then follow that ladder */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">CS-stappenplan</h2>
                {method && lastDecided >= 0 && !locked && <button onClick={() => undo(lastDecided)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"><Undo2 className="h-3.5 w-3.5" /> Ongedaan</button>}
              </div>

              {!method ? (
                /* payment-method gate — nothing else shows until a method is chosen */
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Kies eerst de betaalmethode. Het passende stappenplan verschijnt daarna.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {METHOD_GROUPS.map((g) => {
                      const Icon = g.id === "creditcard" ? CreditCard : Wallet;
                      return (
                        <button key={g.id} onClick={() => chooseMethod(g.id)}
                          className="group text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/[0.03] transition-all">
                          <span className="h-10 w-10 rounded-xl grid place-items-center bg-primary/10 mb-2.5"><Icon className="h-5 w-5 text-primary" /></span>
                          <p className="text-sm font-semibold text-foreground">{g.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{g.hint}</p>
                          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">Stappenplan openen <ArrowRight className="h-3 w-3" /></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
              <>
              {/* chosen method bar */}
              <div className="flex items-center gap-2 mb-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
                {method === "creditcard" ? <CreditCard className="h-4 w-4 text-primary shrink-0" /> : <Wallet className="h-4 w-4 text-primary shrink-0" />}
                <p className="text-xs text-foreground"><span className="font-semibold">{methodLabel(method)}</span><span className="text-muted-foreground"> · stappenplan</span></p>
                {!locked && <button onClick={changeMethod} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">wijzig</button>}
              </div>

              <div className="space-y-2">
                {steps.map((s, i) => {
                  const outcome = outcomes[i];
                  const isCurrent = i === ls.currentIdx;
                  const na = ls.resolved && ls.acceptedIdx != null && i > (ls.acceptedIdx as number);
                  const nodeBg = outcome === "accepted" ? "hsl(var(--ok))" : outcome === "rejected" ? "hsl(var(--bad))" : isCurrent ? "hsl(var(--primary))" : "hsl(var(--muted))";
                  const nodeFg = outcome || isCurrent ? "#fff" : "hsl(var(--muted-foreground))";
                  return (
                    <div key={i} className={`rounded-xl border p-3 transition-colors ${isCurrent ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card"} ${na ? "opacity-45" : ""}`}>
                      <div className="flex items-start gap-3">
                        <span className="h-6 w-6 rounded-full grid place-items-center shrink-0 mt-0.5" style={{ background: nodeBg, color: nodeFg }}>
                          {outcome === "accepted" ? <Check className="h-3.5 w-3.5" /> : outcome === "rejected" ? <X className="h-3.5 w-3.5" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-[13px] font-medium ${outcome === "rejected" ? "text-muted-foreground line-through" : "text-foreground"}`}>{s.label}</p>
                            {outcome === "accepted" && <span className="text-[10px] font-semibold uppercase tracking-wide text-ok bg-ok/12 rounded-full px-1.5 py-0.5">Geaccepteerd</span>}
                            {outcome === "rejected" && <span className="text-[10px] font-semibold uppercase tracking-wide text-bad bg-bad/12 rounded-full px-1.5 py-0.5">Afgewezen</span>}
                          </div>
                          {s.note && !outcome && <p className="text-xs text-muted-foreground mt-0.5">{s.note}</p>}
                        </div>
                        {isCurrent && !locked && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => reject(i)} className="h-8 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-bad hover:border-bad/40 flex items-center gap-1"><X className="h-3.5 w-3.5" /> Niet</button>
                            <button onClick={() => accept(i)} className="h-8 px-3 rounded-lg bg-ok text-white text-xs font-medium flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Geaccepteerd</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {ls.resolved && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-ok/10 border border-ok/20 px-4 py-2.5">
                  <Check className="h-4 w-4 text-ok shrink-0" /><p className="text-[13px] font-medium text-foreground">Klant accepteerde stap {(ls.acceptedIdx as number) + 1} ({pct}%) — {pct < 100 ? <>slechts <span className="font-semibold">{eur(expectedPayout, ret.currency ?? "EUR")}</span> terug te betalen.</> : <>volledige terugbetaling van <span className="font-semibold">{eur(expectedPayout, ret.currency ?? "EUR")}</span>.</>}</p>
                </div>
              )}
              {!ls.resolved && ls.currentIdx >= steps.length && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-bad/10 border border-bad/20 px-4 py-2.5">
                  <Ban className="h-4 w-4 text-bad shrink-0" /><p className="text-[13px] font-medium text-foreground">Geen enkel aanbod geaccepteerd — volledige terugbetaling van <span className="font-semibold">{eur(expectedPayout, ret.currency ?? "EUR")}</span> verwerken.</p>
                </div>
              )}
              </>
              )}
            </motion.div>

            {/* NOTITIES — free text, with author */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Notities</h2></div>
              <div className="flex items-start gap-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Wat heb je met de klant besproken of aangeboden?"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }}
                  className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
                <button onClick={submitNote} disabled={!note.trim()} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-4 space-y-3">
                {notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nog geen notities.</p>
                ) : notes.map((n) => (
                  <div key={n.at} className="group flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold shrink-0 mt-0.5">{initials(n.byName || "?")}</span>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-[13px] text-foreground whitespace-pre-wrap">{n.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5"><span className="font-medium text-foreground/80">{n.byName || "Onbekend"}</span> · {relTime(n.at)}</p>
                    </div>
                    <button onClick={() => removeNote(id, n.at)} className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded text-muted-foreground/50 hover:text-bad transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* LOG — system audit trail, with author */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center gap-2 mb-3"><ClipboardList className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Log</h2><span className="text-[11px] text-muted-foreground">· wie deed wat</span></div>
              {log.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nog geen activiteit. Statuswijzigingen en stapbeslissingen komen hier automatisch in.</p>
              ) : (
                <div className="space-y-0">
                  {log.map((l, i) => (
                    <div key={l.at} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="h-6 w-6 rounded-full grid place-items-center shrink-0" style={{ background: l.kind === "status" ? "hsl(var(--info)/0.14)" : l.kind === "owner" ? "hsl(var(--ember)/0.14)" : "hsl(var(--primary)/0.1)" }}>
                          <LogIcon kind={l.kind} />
                        </span>
                        {i < log.length - 1 && <span className="w-px flex-1 bg-border my-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-4">
                        <p className="text-[13px] text-foreground">{l.text}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5"><span className="font-medium text-foreground/80">{l.byName || "Onbekend"}</span> · {relTime(l.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* sidebar */}
          <div className="space-y-5">
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Order</h2>
              {order ? (
                <Link to={`/orders/${order.id}`} className="block rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-foreground">{order.order_number || "Order"}</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  {order.customer_name && <p className="text-xs text-muted-foreground mt-0.5">{order.customer_name}</p>}
                  {order.customer_email && <p className="text-xs text-muted-foreground">{order.customer_email}</p>}
                </Link>
              ) : <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Circle className="h-3.5 w-3.5" /> Geen order gekoppeld</p>}
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Details</h2>
              {/* 1. reden */}
              <Field label="Reden"><input value={ret.reason ?? ""} onChange={(e) => patch({ reason: e.target.value })} placeholder="Verkeerde maat, defect…" className="w-full bg-transparent text-[13px] text-foreground outline-none" /></Field>
              {/* 2. bedrag */}
              <Field label="Bedrag"><div className="flex items-center gap-1"><span className="text-muted-foreground text-[13px]">€</span><input type="number" value={ret.refund_amount ?? 0} onChange={(e) => patch({ refund_amount: parseFloat(e.target.value) || 0 })} className="w-full bg-transparent text-[13px] text-foreground outline-none tabular-nums" /></div></Field>
              {/* 3. totaal terugbetaald — only the accepted phase's share */}
              <Field label="Totaal terugbetaald">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-foreground tabular-nums font-semibold">{eur(ret.status === "refunded" ? (meta.refundedTotal ?? 0) : (decided ? expectedPayout : 0), ret.currency ?? "EUR")}</span>
                  {ret.status === "refunded"
                    ? <span className="text-[10px] font-semibold text-ok bg-ok/12 rounded-full px-1.5 py-0.5 shrink-0">bevestigd · {meta.refundedPct ?? 100}%</span>
                    : decided
                    ? <span className="text-[10px] font-semibold shrink-0" style={{ color: "hsl(var(--ember))" }}>te betalen · {pct}%</span>
                    : <span className="text-[10px] text-muted-foreground shrink-0">nog niet bepaald</span>}
                </div>
              </Field>
              {/* 4. aanmaakdatum + 5. datum afgerond */}
              <div className="flex items-center justify-between pt-0.5"><span className="text-xs text-muted-foreground">Aangemaakt</span><span className="text-xs text-foreground">{fmtDate(ret.created_at)}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Afgerond</span><span className="text-xs text-foreground">{fmtDate(meta.resolvedAt)}</span></div>
            </motion.div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

const LogIcon = ({ kind }: { kind: LogKind }) => {
  if (kind === "status") return <Flag className="h-3 w-3" style={{ color: "hsl(var(--info))" }} />;
  if (kind === "owner") return <ShieldCheck className="h-3 w-3" style={{ color: "hsl(var(--ember))" }} />;
  return <ListChecks className="h-3 w-3 text-primary" />;
};

/* ─── status lifecycle card ──────────────────────────────────────────────── */
function StatusCard({ status, currency, refundedTotal, refundedPct, pendingPayout, payoutPct, resolvedAt, onSet }: { status: string; currency: string; refundedTotal: number; refundedPct: number; pendingPayout: number; payoutPct: number; resolvedAt: string | null; onSet: (s: string) => void }) {
  const rejected = status === "rejected";
  const idx = FLOW.indexOf(status);
  const next = !rejected && idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  // Approval is driven by the CS step plan (any accepted phase → Goedgekeurd), so there is
  // no manual "Goedkeuren" button. Status actions only appear from Goedgekeurd (phase 2) on,
  // once the step plan no longer requires action.
  const CTA: Record<string, { label: string; icon: any; hint: string }> = {
    received: { label: "Markeer als ontvangen", icon: PackageCheck, hint: "Bevestig zodra het pakket fysiek binnen is." },
    refunded: { label: "Bevestig terugbetaling", icon: BadgeEuro, hint: `Bevestig de terugbetaling van ${eur(pendingPayout, currency)}${payoutPct < 100 ? ` (${payoutPct}%)` : ""}.` },
  };
  const showCTA = next === "received" || next === "refunded";
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className={`card-soft p-5 ${rejected ? "ring-1 ring-bad/40" : ""}`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className={`text-sm font-semibold ${rejected ? "text-bad" : "text-foreground"}`}>Status</h2>
        {!rejected && <button onClick={() => onSet("rejected")} className="text-[11px] font-medium text-muted-foreground hover:text-bad flex items-center gap-1"><Ban className="h-3.5 w-3.5" /> Afwijzen</button>}
      </div>

      {rejected ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-bad/10 border border-bad/20 px-4 py-3">
          <span className="h-8 w-8 rounded-full bg-bad grid place-items-center"><Ban className="h-4 w-4 text-white" /></span>
          <div><p className="text-[13px] font-semibold text-bad">Afgewezen</p><p className="text-xs text-muted-foreground">Het retour is niet toegekend{resolvedAt ? ` · ${fmtDate(resolvedAt)}` : ""}.</p></div>
        </div>
      ) : (
        <>
          <div className="flex items-start">
            {FLOW.map((st, i) => {
              const done = i < idx, cur = i === idx;
              const bg = done ? "hsl(var(--ok))" : cur ? "hsl(var(--primary))" : "hsl(var(--muted))";
              const fg = done || cur ? "#fff" : "hsl(var(--muted-foreground))";
              return (
                <div key={st} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && <span className="absolute top-4 right-1/2 w-full h-0.5" style={{ background: i <= idx ? "hsl(var(--ok))" : "hsl(var(--border))" }} />}
                  <button onClick={() => onSet(st)} className="relative z-10 h-8 w-8 rounded-full grid place-items-center transition-transform hover:scale-105" style={{ background: bg, color: fg }} title={`Zet status op ${FLOW_LABEL[st]}`}>
                    {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </button>
                  <span className={`text-[11px] mt-1.5 font-medium ${cur ? "text-foreground" : "text-muted-foreground"}`}>{FLOW_LABEL[st]}</span>
                </div>
              );
            })}
          </div>

          {/* phase 1 (Aangevraagd): no button — the CS step plan drives approval.
              phase 2+ : confirm the next physical step. refunded: done state. */}
          {status === "refunded" ? (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-ok/10 border border-ok/20 px-4 py-3">
              <span className="h-8 w-8 rounded-full bg-ok grid place-items-center"><BadgeEuro className="h-4 w-4 text-white" /></span>
              <div><p className="text-[13px] font-semibold text-foreground">Terugbetaald · {eur(refundedTotal, currency)}{refundedPct < 100 ? ` (${refundedPct}%)` : ""}</p><p className="text-xs text-muted-foreground">Afgerond op {fmtDate(resolvedAt)}.</p></div>
            </div>
          ) : showCTA && next ? (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">{CTA[next].hint}</p>
              <button onClick={() => onSet(next)} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium flex items-center gap-1.5 shrink-0">
                {(() => { const Icon = CTA[next].icon; return <Icon className="h-4 w-4" />; })()} {CTA[next].label} <ArrowRight className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </motion.div>
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
