import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp } from "@/lib/motion";
import {
  ArrowLeft, LifeBuoy, ExternalLink, User, Mail, ShieldCheck, AlertTriangle, Clock,
  Send, Trash2, Check, RotateCcw, Loader2, MessageSquare, ClipboardList, Copy,
  ArrowDownLeft, ArrowUpRight, Flag, Circle, Tag, Zap,
} from "lucide-react";
import {
  FLOW, STATUS_LABEL, statusIndex, PRIORITIES, prioMeta, computeUrgency, fmtWaited, toneColor, TEMPLATES, RESOLUTIONS,
  useTicketOwner, setTicketOwner, clearTicketOwner, useTicketLog, addTicketLog, useTicketNotes, addTicketNote, removeTicketNote,
  useTicketComms, addTicketComm, useTicketMeta, setTicketMeta, type TicketStatus, type Priority, type TicketLogKind, type CommDir,
} from "@/lib/ticketCase";
import { useCurrentUser } from "@/lib/superuser";

type Ticket = { id: string; order_id: string | null; subject: string | null; customer_email: string | null; channel: string | null; priority: string | null; status: string; assigned_to: string | null; body: string | null; created_at?: string };
type Order = { id: string; order_number: string | null; customer_name: string | null };

const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const relTime = (iso: string) => { const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return "net nu"; if (s < 3600) return `${Math.floor(s / 60)} min geleden`; if (s < 86400) return `${Math.floor(s / 3600)} u geleden`; return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
const initials = (name?: string) => (name || "?").split(/[ @.]/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

async function detect(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}

export default function TicketDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [replyDir, setReplyDir] = useState<CommDir>("out");

  const me = useCurrentUser();
  const owner = useTicketOwner(id);
  const log = useTicketLog(id);
  const notes = useTicketNotes(id);
  const comms = useTicketComms(id);
  const meta = useTicketMeta(id);

  const iAmOwner = !!owner && !!me.email && owner.email.toLowerCase() === me.email.toLowerCase();
  const otherOwns = !!owner && !iAmOwner;
  const actor = () => ({ by: me.email, byName: me.name || me.email || "Onbekend" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const be = await detect("tickets"); setBackend(be);
      let t: Ticket | null = null;
      if (be === "supabase") { const { data } = await (supabase as any).from("tickets").select("*").eq("id", id).maybeSingle(); t = data ?? null; }
      else { try { t = (JSON.parse(localStorage.getItem("gb_tickets") || "[]") as Ticket[]).find((x) => x.id === id) ?? null; } catch { t = null; } }
      setTicket(t);
      if (t?.order_id) {
        let o: Order | null = null;
        if (be === "supabase") { const { data } = await (supabase as any).from("orders").select("id,order_number,customer_name").eq("id", t.order_id).maybeSingle(); o = data ?? null; }
        else { try { o = (JSON.parse(localStorage.getItem("gb_orders") || "[]") as Order[]).find((x) => x.id === t!.order_id) ?? null; } catch { o = null; } }
        setOrder(o);
      }
      setLoading(false);
    })();
  }, [id]);

  const patch = async (p: Partial<Ticket>) => {
    setTicket((prev) => prev ? { ...prev, ...p } : prev);
    if (backend === "local") { try { const arr = JSON.parse(localStorage.getItem("gb_tickets") || "[]") as Ticket[]; localStorage.setItem("gb_tickets", JSON.stringify(arr.map((x) => x.id === id ? { ...x, ...p } : x))); } catch { /* ignore */ } }
    else { const { error } = await (supabase as any).from("tickets").update(p).eq("id", id); if (error) toast.error(error.message); }
  };

  const ensureOwner = () => { if (!owner && me.email) { setTicketOwner(id, { email: me.email, name: me.name || me.email }); addTicketLog(id, `${me.name || me.email} nam dit ticket op`, "owner", actor()); } };
  const claim = () => { if (!me.email) { toast.error("Geen gebruiker gevonden."); return; } setTicketOwner(id, { email: me.email, name: me.name || me.email }); addTicketLog(id, `${me.name || me.email} ${owner ? "nam het ticket over" : "nam dit ticket op"}`, "owner", actor()); };
  const release = () => { clearTicketOwner(id); addTicketLog(id, `${me.name || me.email || "Iemand"} gaf het ticket vrij`, "owner", actor()); };

  const setStatus = (s: TicketStatus) => { if (!ticket) return; ensureOwner(); patch({ status: s }); if (s === "solved" || s === "closed") setTicketMeta(id, { resolvedAt: new Date().toISOString() }); else setTicketMeta(id, { resolvedAt: null }); addTicketLog(id, `Status → ${STATUS_LABEL[s] ?? s}`, "status", actor()); };
  const setPriority = (p: Priority) => { ensureOwner(); patch({ priority: p }); addTicketLog(id, `Prioriteit → ${prioMeta(p).label}`, "priority", actor()); };
  const resolve = (outcome: string) => { ensureOwner(); patch({ status: "solved" }); setTicketMeta(id, { resolvedAt: new Date().toISOString(), outcome }); addTicketLog(id, `Ticket opgelost — ${outcome}`, "resolution", actor()); };
  const reopen = () => { patch({ status: "open" }); setTicketMeta(id, { resolvedAt: null as any }); addTicketLog(id, "Ticket heropend", "resolution", actor()); };

  const submitNote = () => { if (!note.trim()) return; ensureOwner(); addTicketNote(id, note.trim(), actor()); setNote(""); };
  const logReply = () => { if (!reply.trim()) return; ensureOwner(); addTicketComm(id, { text: reply.trim(), dir: replyDir }, actor()); addTicketLog(id, `${replyDir === "out" ? "Antwoord aan klant" : "Klantreactie"} gelogd`, "reply", actor()); if (replyDir === "out" && ticket?.status === "open") patch({ status: "pending" }); setReply(""); };
  const copyReply = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success("Gekopieerd."); } catch { toast.error("Kopiëren niet gelukt."); } };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!ticket) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div><p className="text-sm font-semibold text-foreground mb-1">Ticket niet gevonden</p><Link to="/tickets" className="text-sm text-primary hover:underline">← Terug naar Tickets</Link></div>
    </div>
  );

  const urg = computeUrgency(ticket.priority, ticket.created_at, ticket.status);
  const resolved = ticket.status === "solved" || ticket.status === "resolved" || ticket.status === "closed";
  const sIdx = statusIndex(ticket.status);
  const tplCtx = { name: ticket.customer_email ?? undefined, subject: ticket.subject ?? undefined };

  return (
    <div className="min-h-screen" style={urg.overSla ? { background: "hsl(var(--bad)/0.04)" } : undefined}>
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <button onClick={() => navigate("/tickets")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Tickets</button>
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center" style={{ background: "hsl(var(--grape)/0.12)" }}><LifeBuoy className="h-5 w-5" style={{ color: "hsl(var(--grape))" }} /></span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground truncate">{ticket.subject || "Ticket"}</h1>
              <p className="text-sm text-muted-foreground capitalize">{ticket.channel || "kanaal onbekend"} · {STATUS_LABEL[ticket.status] ?? ticket.status}</p>
            </div>
          </div>
        </motion.div>

        {/* OWNER strip */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft px-4 py-3 flex items-center gap-3" style={otherOwns ? { boxShadow: "inset 0 0 0 1px hsl(var(--ember)/0.35)" } : undefined}>
          <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0" style={{ background: iAmOwner ? "hsl(var(--ok)/0.12)" : otherOwns ? "hsl(var(--ember)/0.12)" : "hsl(var(--muted))" }}>
            <ShieldCheck className="h-4 w-4" style={{ color: iAmOwner ? "hsl(var(--ok))" : otherOwns ? "hsl(var(--ember))" : "hsl(var(--muted-foreground))" }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eigenaar van dit ticket</p>
            {owner ? (
              <p className="text-sm text-foreground truncate"><span className="font-semibold">{owner.name}</span>{iAmOwner && <span className="ml-1.5 text-[10px] font-semibold text-ok bg-ok/12 rounded-full px-1.5 py-0.5 align-middle">jij</span>}<span className="text-muted-foreground font-normal"> · {owner.email}</span></p>
            ) : <p className="text-sm text-muted-foreground">Nog niemand behandelt dit ticket — neem het op zodat collega's weten dat jij bezig bent.</p>}
          </div>
          <div className="shrink-0">
            {!owner ? <button onClick={claim} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Ik neem dit op</button>
             : iAmOwner ? <button onClick={release} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Vrijgeven</button>
             : <button onClick={claim} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ border: "1px solid hsl(var(--ember)/0.4)", color: "hsl(var(--ember))" }}>Overnemen</button>}
          </div>
        </motion.div>

        {/* URGENCY / SLA banner */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ background: `${toneColor(urg.tone)}14`, boxShadow: `inset 0 0 0 1px ${toneColor(urg.tone)}44` }}>
          <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: toneColor(urg.tone) }}>{urg.overSla ? <AlertTriangle className="h-5 w-5" /> : <Zap className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: toneColor(urg.tone) }}>{urg.label}{urg.overSla ? " · SLA overschreden" : ""}</p>
            <p className="text-xs text-muted-foreground">Wachttijd klant: <span className="font-medium text-foreground">{fmtWaited(urg.waited)}</span> · {urg.sla}</p>
          </div>
          {urg.overSla && <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" style={{ color: toneColor(urg.tone) }} />}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Message */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center gap-2 mb-3"><Mail className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Bericht van de klant</h2></div>
              <p className="text-[13px] font-medium text-foreground mb-1">{ticket.subject || "—"}</p>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed min-h-[60px]">{ticket.body || "Geen berichtinhoud."}</div>
            </motion.div>

            {/* Reply to customer */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Antwoord aan de klant</h2></div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[11px] text-muted-foreground self-center">Templates:</span>
                {TEMPLATES.map((t) => <button key={t.id} onClick={() => { setReply(t.body(tplCtx)); setReplyDir("out"); }} className="h-7 px-2.5 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">{t.label}</button>)}
              </div>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Antwoord aan de klant… (of kies een template)" className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
              <div className="flex items-center gap-2 mt-2">
                <select value={replyDir} onChange={(e) => setReplyDir(e.target.value as CommDir)} className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none"><option value="out">Naar klant</option><option value="in">Van klant</option></select>
                <button onClick={() => copyReply(reply)} disabled={!reply.trim()} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Kopieer</button>
                <button onClick={logReply} disabled={!reply.trim()} className="ml-auto h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /> Loggen</button>
              </div>
              <div className="mt-4 space-y-3">
                {comms.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">Nog geen antwoorden gelogd.</p> : comms.map((c) => (
                  <div key={c.at} className="flex gap-2.5">
                    <span className="h-6 w-6 rounded-full grid place-items-center shrink-0 mt-0.5" style={{ background: c.dir === "out" ? "hsl(var(--primary)/0.1)" : "hsl(var(--info)/0.12)" }}>{c.dir === "out" ? <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> : <ArrowDownLeft className="h-3.5 w-3.5" style={{ color: "hsl(var(--info))" }} />}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground whitespace-pre-wrap">{c.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.dir === "out" ? "naar klant" : "van klant"} · <span className="font-medium text-foreground/80">{c.byName || "Onbekend"}</span> · {relTime(c.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Internal notes */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center gap-2 mb-3"><ClipboardList className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Interne notities</h2></div>
              <div className="flex items-start gap-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Interne opmerking…" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }} className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
                <button onClick={submitNote} disabled={!note.trim()} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-4 space-y-3">
                {notes.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">Nog geen notities.</p> : notes.map((n) => (
                  <div key={n.at} className="group flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold shrink-0 mt-0.5">{initials(n.byName)}</span>
                    <div className="flex-1 min-w-0 pb-1"><p className="text-[13px] text-foreground whitespace-pre-wrap">{n.text}</p><p className="text-[11px] text-muted-foreground mt-0.5"><span className="font-medium text-foreground/80">{n.byName || "Onbekend"}</span> · {relTime(n.at)}</p></div>
                    <button onClick={() => removeTicketNote(id, n.at)} className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded text-muted-foreground/50 hover:text-bad transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
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
            {/* Ticket & klant */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Ticket & klant</h2>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-[13px] text-foreground truncate">{ticket.customer_email || "—"}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Kanaal</span><span className="text-foreground capitalize">{ticket.channel || "—"}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Aangemaakt</span><span className="text-foreground">{fmtDate(ticket.created_at)}</span></div>
              {order ? (
                <Link to={`/orders/${order.id}`} className="block rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-foreground">{order.order_number || "Order"}</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  {order.customer_name && <p className="text-xs text-muted-foreground mt-0.5">{order.customer_name}</p>}
                </Link>
              ) : <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Circle className="h-3 w-3" /> Geen order gekoppeld</p>}
            </motion.div>

            {/* Status & prioriteit */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Status & prioriteit</h2>
              {/* status stepper */}
              <div className="flex items-start">
                {FLOW.map((st, i) => {
                  const done = i < sIdx, curNode = i === sIdx;
                  const bg = done ? "hsl(var(--ok))" : curNode ? "hsl(var(--primary))" : "hsl(var(--muted))";
                  const fg = done || curNode ? "#fff" : "hsl(var(--muted-foreground))";
                  return (
                    <div key={st} className="flex-1 flex flex-col items-center relative">
                      {i > 0 && <span className="absolute top-3 right-1/2 w-full h-0.5" style={{ background: i <= sIdx ? "hsl(var(--ok))" : "hsl(var(--border))" }} />}
                      <button onClick={() => setStatus(st as TicketStatus)} className="relative z-10 h-6 w-6 rounded-full grid place-items-center transition-transform hover:scale-105" style={{ background: bg, color: fg }} title={`Zet op ${STATUS_LABEL[st]}`}>{done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}</button>
                      <span className={`text-[10px] mt-1.5 text-center leading-tight ${curNode ? "text-foreground font-medium" : "text-muted-foreground"}`}>{STATUS_LABEL[st]}</span>
                    </div>
                  );
                })}
              </div>
              {/* priority */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Prioriteit</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((pr) => {
                    const active = (ticket.priority || "normal") === pr.id; const col = toneColor(pr.tone);
                    return <button key={pr.id} onClick={() => setPriority(pr.id)} className="h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-colors" style={active ? { background: col, color: "#fff", borderColor: col } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>{pr.label}</button>;
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1"><Clock className="h-3 w-3" /> SLA: {computeUrgency(ticket.priority, ticket.created_at, "open").sla}</p>
              </div>
            </motion.div>

            {/* Resolutie */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Resolutie & afsluiting</h2>
              {resolved ? (
                <div className="rounded-xl bg-ok/10 border border-ok/20 px-3 py-3">
                  <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-full bg-ok grid place-items-center"><Check className="h-4 w-4 text-white" /></span><div><p className="text-[13px] font-semibold text-foreground">{STATUS_LABEL[ticket.status] ?? "Opgelost"}</p><p className="text-xs text-muted-foreground">{meta.outcome || "—"} · {fmtDate(meta.resolvedAt)}</p></div></div>
                  <button onClick={reopen} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Heropenen</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Sluit het ticket af met de uitkomst.</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {RESOLUTIONS.map((o) => (
                      <button key={o} onClick={() => resolve(o)} className="h-9 px-3 rounded-lg border border-border text-[13px] font-medium text-foreground hover:border-ok/50 hover:bg-ok/[0.04] text-left flex items-center gap-2 transition-colors"><Check className="h-3.5 w-3.5 text-ok" /> {o}</button>
                    ))}
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

const LogIcon = ({ kind }: { kind: TicketLogKind }) => {
  const c = kind === "status" ? "hsl(var(--info))" : kind === "priority" ? "hsl(var(--ember))" : kind === "owner" ? "hsl(var(--ember))" : kind === "resolution" ? "hsl(var(--ok))" : "hsl(var(--primary))";
  const I = kind === "status" ? Flag : kind === "priority" ? Tag : kind === "owner" ? ShieldCheck : kind === "resolution" ? Check : MessageSquare;
  return <I className="h-3 w-3" style={{ color: c }} />;
};
