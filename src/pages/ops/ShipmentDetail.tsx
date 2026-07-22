import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp } from "@/lib/motion";
import {
  ArrowLeft, Truck, ExternalLink, MapPin, User, Package, ShieldCheck, AlertTriangle, Clock,
  Send, Trash2, Check, RotateCcw, Loader2, MessageSquare, ClipboardList, Zap, BadgeEuro,
  Gift, PhoneCall, Circle, ArrowDownLeft, ArrowUpRight, Flag, Copy, Search,
} from "lucide-react";
import {
  SHIP_STATUSES, statusMeta, toneColor, computePhase, estimateExpected, SOLUTIONS, solutionMeta, SHIP_OUTCOMES, TEMPLATES,
  useShipOwner, setShipOwner, clearShipOwner, useShipLog, addShipLog, useShipNotes, addShipNote, removeShipNote,
  useShipComms, addShipComm, useShipMeta, setShipMeta, type ShipStatus, type SolutionId, type ShipLogKind, type CommDir,
} from "@/lib/shipmentCase";
import { useCurrentUser } from "@/lib/superuser";

type Ship = { id: string; order_id: string | null; carrier: string | null; tracking_number: string | null; status: string; shipped_at: string | null; delivered_at: string | null; notes: string | null; created_at?: string };
type Order = { id: string; order_number: string | null; customer_name: string | null; customer_email?: string | null; total?: number | null; currency?: string | null; created_at?: string; shipping_address?: string | null; address?: string | null; shipping_street?: string | null; shipping_postal_code?: string | null; shipping_zip?: string | null; shipping_city?: string | null; shipping_country?: string | null };

// shipping address straight from the order (whichever fields the order carries)
const orderAddress = (o?: Order | null): string => {
  if (!o) return "";
  if (o.shipping_address) return o.shipping_address;
  if (o.address) return o.address;
  const line = [o.shipping_street, [o.shipping_postal_code || o.shipping_zip, o.shipping_city].filter(Boolean).join(" "), o.shipping_country].filter(Boolean).join("\n");
  return line;
};

const eur = (v: number, c = "EUR") => new Intl.NumberFormat("nl-BE", { style: "currency", currency: c || "EUR" }).format(v || 0);
const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const toDay = (iso?: string | null) => iso ? new Date(iso).toISOString().slice(0, 10) : "";
const relTime = (iso: string) => { const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return "net nu"; if (s < 3600) return `${Math.floor(s / 60)} min geleden`; if (s < 86400) return `${Math.floor(s / 3600)} u geleden`; return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
const initials = (name?: string) => (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const trackUrl = (carrier?: string | null, t?: string | null) => {
  if (!t) return null; const c = (carrier || "").toLowerCase();
  if (c.includes("bpost")) return `https://track.bpost.be/btr/web/#/search?itemCode=${t}`;
  if (c.includes("dpd")) return `https://www.dpd.com/be/nl/tracking/?query=${t}`;
  if (c.includes("postnl")) return `https://postnl.nl/tracktrace/?B=${t}`;
  if (c.includes("dhl")) return `https://www.dhl.com/be-en/home/tracking.html?tracking-id=${t}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent((carrier || "") + " tracking " + t)}`;
};

async function detect(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}

export default function ShipmentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [ship, setShip] = useState<Ship | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [comm, setComm] = useState("");
  const [commDir, setCommDir] = useState<CommDir>("out");
  const [commChannel, setCommChannel] = useState("email");
  const [history, setHistory] = useState<{ priorIssues: number; customerSince: string | null; loading: boolean; done: boolean }>({ priorIssues: 0, customerSince: null, loading: false, done: false });

  const me = useCurrentUser();
  const owner = useShipOwner(id);
  const log = useShipLog(id);
  const notes = useShipNotes(id);
  const comms = useShipComms(id);
  const meta = useShipMeta(id);

  const iAmOwner = !!owner && !!me.email && owner.email.toLowerCase() === me.email.toLowerCase();
  const otherOwns = !!owner && !iAmOwner;
  const actor = () => ({ by: me.email, byName: me.name || me.email || "Onbekend" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const be = await detect("shipments"); setBackend(be);
      let s: Ship | null = null;
      if (be === "supabase") { const { data } = await (supabase as any).from("shipments").select("*").eq("id", id).maybeSingle(); s = data ?? null; }
      else { try { s = (JSON.parse(localStorage.getItem("gb_shipments") || "[]") as Ship[]).find((x) => x.id === id) ?? null; } catch { s = null; } }
      setShip(s);
      if (s?.order_id) {
        let o: Order | null = null;
        if (be === "supabase") { const { data } = await (supabase as any).from("orders").select("*").eq("id", s.order_id).maybeSingle(); o = data ?? null; }
        else { try { o = (JSON.parse(localStorage.getItem("gb_orders") || "[]") as Order[]).find((x) => x.id === s!.order_id) ?? null; } catch { o = null; } }
        setOrder(o);
      }
      setLoading(false);
    })();
  }, [id]);

  // "klant-agent": scan our own systems (orders/returns/shipments/tickets) for this
  // customer → earliest order = klant sinds, and count of prior issues.
  const lookupHistory = async (o: Order) => {
    const email = (o.customer_email || "").toLowerCase();
    setHistory((h) => ({ ...h, loading: true }));
    const readLS = (t: string) => { try { return JSON.parse(localStorage.getItem(`gb_${t}`) || "[]"); } catch { return []; } };
    let orders: any[] = [], returns: any[] = [], shipments: any[] = [], tickets: any[] = [];
    if (backend === "supabase") {
      const [a, b, c, d] = await Promise.all([
        (supabase as any).from("orders").select("id,customer_email,created_at"),
        (supabase as any).from("returns").select("order_id"),
        (supabase as any).from("shipments").select("id,order_id"),
        (supabase as any).from("tickets").select("customer_email"),
      ]);
      orders = a.data ?? []; returns = b.data ?? []; shipments = c.data ?? []; tickets = d.data ?? [];
    } else { orders = readLS("orders"); returns = readLS("returns"); shipments = readLS("shipments"); tickets = readLS("tickets"); }
    const mine = orders.filter((x) => email && (x.customer_email || "").toLowerCase() === email);
    const orderIds = new Set(mine.map((x) => x.id));
    const dates = mine.map((x) => x.created_at).filter(Boolean).sort();
    const priorIssues = returns.filter((r) => orderIds.has(r.order_id)).length
      + shipments.filter((s) => orderIds.has(s.order_id) && s.id !== id).length
      + tickets.filter((t) => email && (t.customer_email || "").toLowerCase() === email).length;
    setHistory({ priorIssues, customerSince: dates[0] ?? null, loading: false, done: true });
  };
  useEffect(() => { if (order?.customer_email) lookupHistory(order); /* eslint-disable-next-line */ }, [order, backend]);

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success("Gekopieerd — klaar om te plakken."); } catch { toast.error("Kopiëren niet gelukt."); } };

  const patch = async (p: Partial<Ship>) => {
    setShip((prev) => prev ? { ...prev, ...p } : prev);
    if (backend === "local") { try { const arr = JSON.parse(localStorage.getItem("gb_shipments") || "[]") as Ship[]; localStorage.setItem("gb_shipments", JSON.stringify(arr.map((x) => x.id === id ? { ...x, ...p } : x))); } catch { /* ignore */ } }
    else { const { error } = await (supabase as any).from("shipments").update(p).eq("id", id); if (error) toast.error(error.message); }
  };
  const setMetaField = (p: Parameters<typeof setShipMeta>[1]) => setShipMeta(id, p);

  const ensureOwner = () => { if (!owner && me.email) { setShipOwner(id, { email: me.email, name: me.name || me.email }); addShipLog(id, `${me.name || me.email} nam deze case op`, "owner", actor()); } };
  const claim = () => { if (!me.email) { toast.error("Geen gebruiker gevonden."); return; } setShipOwner(id, { email: me.email, name: me.name || me.email }); addShipLog(id, `${me.name || me.email} ${owner ? "nam de case over" : "nam deze case op"}`, "owner", actor()); };
  const release = () => { clearShipOwner(id); addShipLog(id, `${me.name || me.email || "Iemand"} gaf de case vrij`, "owner", actor()); };

  const setStatus = (s: ShipStatus) => { if (!ship) return; ensureOwner(); patch({ status: s }); addShipLog(id, `Status → ${statusMeta(s).label}`, "status", actor()); };
  const chooseSolution = (sol: SolutionId) => { ensureOwner(); setMetaField({ solution: sol }); addShipLog(id, `Oplossing gekozen: ${solutionMeta(sol)?.label}`, "solution", actor()); };
  const startSolution = () => { if (!meta.solution) return; setMetaField({ solutionStartedAt: new Date().toISOString() }); addShipLog(id, `Oplossing in gang gezet: ${solutionMeta(meta.solution)?.label}`, "solution", actor()); toast.success("Oplossing in gang gezet."); };
  const resolve = (outcome: string) => { ensureOwner(); patch({ status: "resolved" }); setMetaField({ resolvedAt: new Date().toISOString(), outcome }); addShipLog(id, `Case afgesloten — ${outcome}`, "resolution", actor()); };
  const reopen = () => { patch({ status: "in_transit" }); setMetaField({ resolvedAt: null as any }); addShipLog(id, `Case heropend`, "resolution", actor()); };

  const submitNote = () => { if (!note.trim()) return; ensureOwner(); addShipNote(id, note.trim(), actor()); setNote(""); };
  const logComm = () => { if (!comm.trim()) return; ensureOwner(); addShipComm(id, { text: comm.trim(), dir: commDir, channel: commChannel }, actor()); addShipLog(id, `${commDir === "out" ? "Bericht aan klant" : "Klantreactie"} gelogd (${commChannel})`, "comm", actor()); setComm(""); };
  const useTemplate = (body: string) => { setComm(body); setCommDir("out"); };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!ship) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div><p className="text-sm font-semibold text-foreground mb-1">Shipment niet gevonden</p><Link to="/shipments" className="text-sm text-primary hover:underline">← Terug naar Shipments</Link></div>
    </div>
  );

  const st = statusMeta(ship.status);
  const expectedDelivery = estimateExpected(ship.shipped_at, ship.carrier); // from tracking (carrier transit)
  const phase = computePhase({ expected: expectedDelivery, status: ship.status, chargeback: meta.chargebackThreat });
  const resolved = ship.status === "resolved";
  const orderTotal = Number(order?.total ?? 0);
  const shippingCost = meta.shippingCost ?? 5;
  const tUrl = trackUrl(ship.carrier, ship.tracking_number);
  const tplCtx = { name: order?.customer_name ?? undefined, product: undefined, tracking: ship.tracking_number ?? undefined, carrier: ship.carrier ?? undefined };
  const chosen = solutionMeta(meta.solution);           // currently selected solution
  const started = !!meta.solutionStartedAt;             // has it been set in motion?
  const addr = orderAddress(order);

  return (
    <div className="min-h-screen" style={phase.level >= 3 ? { background: `hsl(var(--${phase.tone}) / 0.04)` } : undefined}>
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <button onClick={() => navigate("/shipments")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Shipments</button>
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center" style={{ background: "hsl(var(--info)/0.12)" }}><Truck className="h-5 w-5" style={{ color: "hsl(var(--info))" }} /></span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{order?.order_number || ship.tracking_number || "Shipment"}</h1>
              <p className="text-sm text-muted-foreground">{ship.carrier || "Onbekende carrier"} · {st.label}</p>
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
            ) : <p className="text-sm text-muted-foreground">Nog niemand behandelt deze case — neem ze op zodat collega's weten dat jij bezig bent.</p>}
          </div>
          <div className="shrink-0">
            {!owner ? <button onClick={claim} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Ik neem dit op</button>
             : iAmOwner ? <button onClick={release} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Vrijgeven</button>
             : <button onClick={claim} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ border: "1px solid hsl(var(--ember)/0.4)", color: "hsl(var(--ember))" }}>Overnemen</button>}
          </div>
        </motion.div>

        {/* PHASE / urgency banner (auto-computed) */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ background: `hsl(var(--${phase.tone}) / 0.1)`, boxShadow: `inset 0 0 0 1px hsl(var(--${phase.tone}) / 0.35)` }}>
          <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white font-num font-bold" style={{ background: toneColor(phase.tone) }}>{phase.level >= 3 ? <AlertTriangle className="h-5 w-5" /> : phase.level > 0 ? `F${phase.level}` : <Check className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: toneColor(phase.tone) }}>{phase.level > 0 ? `Fase ${phase.level} · ${phase.label}` : phase.label}</p>
            <p className="text-xs text-muted-foreground">Automatisch bepaald ({phase.reason}) · <span className="font-medium text-foreground">{phase.sla}</span></p>
          </div>
          {phase.level >= 3 && <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" style={{ color: toneColor(phase.tone) }} />}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-5">

            {/* SECTIE 2 — Verzendgegevens & status */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <SectionHead n={2} title="Verzendgegevens & status" />
              {/* data first — dates come from the order & tracking */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tracking">
                  {ship.tracking_number ? (
                    <a href={tUrl ?? "#"} target="_blank" rel="noreferrer" className="text-[13px] text-primary hover:underline inline-flex items-center gap-1 font-mono">{ship.tracking_number}<ExternalLink className="h-3 w-3" /></a>
                  ) : <input value={ship.tracking_number ?? ""} onChange={(e) => patch({ tracking_number: e.target.value })} placeholder="Trackingnummer" className="w-full bg-transparent text-[13px] outline-none" />}
                </Field>
                <Field label="Carrier"><input value={ship.carrier ?? ""} onChange={(e) => patch({ carrier: e.target.value })} placeholder="bpost, DPD…" className="w-full bg-transparent text-[13px] outline-none" /></Field>
                <ReadField label="Besteld op" hint="uit de order" value={fmtDate(order?.created_at)} />
                <ReadField label="Verzonden op" hint="uit tracking" value={fmtDate(ship.shipped_at)} />
                <ReadField label="Verwachte levering" hint="tracking-schatting" value={fmtDate(expectedDelivery)} />
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2 grid place-items-center"><p className="text-[11px] text-muted-foreground text-center">Nog niet geleverd<br />(daarom een issue)</p></div>
              </div>
              {/* status selector below the data */}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">Trackingstatus</p>
              <div className="flex flex-wrap gap-1.5">
                {SHIP_STATUSES.filter((s) => s.id !== "resolved").map((s) => {
                  const active = ship.status === s.id; const col = toneColor(s.tone);
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

            {/* SECTIE 4 — Voorgestelde oplossing & actie */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <SectionHead n={4} title="Voorgestelde oplossing & actie" />
              <div className="space-y-2">
                {SOLUTIONS.map((s) => {
                  const active = meta.solution === s.id; const cost = Math.round(s.cost(orderTotal, shippingCost));
                  const rec = s.recommendSub && meta.isSubscription;
                  const Icon = s.id === "follow_up" ? PhoneCall : s.id === "expedite" ? Zap : s.id === "store_credit" ? Gift : BadgeEuro;
                  return (
                    <button key={s.id} onClick={() => chooseSolution(s.id)} disabled={resolved}
                      className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-colors disabled:opacity-60 ${active ? "border-primary/50 bg-primary/[0.05]" : "border-border bg-card hover:border-primary/30"}`}
                      style={s.spoed && !active ? { boxShadow: "inset 0 0 0 1px hsl(var(--ember)/0.3)" } : undefined}>
                      <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: active ? "hsl(var(--primary))" : s.spoed ? "hsl(var(--ember)/0.15)" : "hsl(var(--muted))", color: active ? "#fff" : s.spoed ? "hsl(var(--ember))" : "hsl(var(--muted-foreground))" }}><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] font-medium text-foreground">{s.label}</p>
                          {s.spoed && <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5" style={{ background: "hsl(var(--ember)/0.15)", color: "hsl(var(--ember))" }}><Zap className="h-2.5 w-2.5" /> spoed</span>}
                          {rec && <span className="text-[10px] font-semibold text-ok bg-ok/12 rounded-full px-1.5 py-0.5">aanbevolen voor abonnee</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: cost === 0 ? "hsl(var(--ok))" : "hsl(var(--foreground))" }}>{cost === 0 ? "gratis" : `± ${eur(cost, order?.currency ?? "EUR")}`}</span>
                    </button>
                  );
                })}
              </div>
              {meta.solution && !resolved && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{meta.solutionStartedAt ? <>In gang gezet · {relTime(meta.solutionStartedAt)}</> : `Gekozen: ${solutionMeta(meta.solution)?.label}`}</p>
                  <button onClick={startSolution} disabled={!!meta.solutionStartedAt} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                    {meta.solutionStartedAt ? <><Check className="h-4 w-4" /> In gang gezet</> : <>Zet in gang <ArrowUpRight className="h-3.5 w-3.5" /></>}
                  </button>
                </div>
              )}
            </motion.div>

            {/* SECTIE 5a — Communicatie met de klant */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <SectionHead n={5} title="Communicatie met de klant" />
              {/* ready-to-send email for the chosen action */}
              {chosen ? (
                <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Kant-en-klare mail · {chosen.label}</p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => useTemplate(chosen.email(tplCtx))} className="h-7 px-2 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground">In veld</button>
                      <button onClick={() => copy(chosen.email(tplCtx))} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1"><Copy className="h-3 w-3" /> Kopieer</button>
                    </div>
                  </div>
                  <p className="text-[12px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{chosen.email(tplCtx)}</p>
                </div>
              ) : <p className="text-xs text-muted-foreground mb-3">Kies een oplossing hierboven — de bijhorende, kant-en-klare mail verschijnt hier om te kopiëren.</p>}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[11px] text-muted-foreground self-center">Andere templates:</span>
                {TEMPLATES.map((t) => <button key={t.id} onClick={() => useTemplate(t.body(tplCtx))} className="h-7 px-2.5 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">{t.label}</button>)}
              </div>
              <textarea value={comm} onChange={(e) => setComm(e.target.value)} rows={3} placeholder="Bericht aan de klant… (of kies een template)" className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
              <div className="flex items-center gap-2 mt-2">
                <select value={commDir} onChange={(e) => setCommDir(e.target.value as CommDir)} className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none"><option value="out">Naar klant</option><option value="in">Van klant</option></select>
                <select value={commChannel} onChange={(e) => setCommChannel(e.target.value)} className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none"><option value="email">E-mail</option><option value="chat">Chat</option><option value="phone">Telefoon</option></select>
                <button onClick={logComm} disabled={!comm.trim()} className="ml-auto h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /> Loggen</button>
              </div>
              <div className="mt-4 space-y-3">
                {comms.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">Nog geen communicatie gelogd.</p> : comms.map((c) => (
                  <div key={c.at} className="flex gap-2.5">
                    <span className="h-6 w-6 rounded-full grid place-items-center shrink-0 mt-0.5" style={{ background: c.dir === "out" ? "hsl(var(--primary)/0.1)" : "hsl(var(--info)/0.12)" }}>{c.dir === "out" ? <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> : <ArrowDownLeft className="h-3.5 w-3.5" style={{ color: "hsl(var(--info))" }} />}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground whitespace-pre-wrap">{c.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.dir === "out" ? "naar klant" : "van klant"} · {c.channel} · <span className="font-medium text-foreground/80">{c.byName || "Onbekend"}</span> · {relTime(c.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* SECTIE 5b — Interne notities */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">Interne notities</h2></div>
              <div className="flex items-start gap-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Interne opmerking (bv. carrier gebeld, herverzending toegezegd)…" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }} className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
                <button onClick={submitNote} disabled={!note.trim()} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-4 space-y-3">
                {notes.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">Nog geen notities.</p> : notes.map((n) => (
                  <div key={n.at} className="group flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold shrink-0 mt-0.5">{initials(n.byName)}</span>
                    <div className="flex-1 min-w-0 pb-1"><p className="text-[13px] text-foreground whitespace-pre-wrap">{n.text}</p><p className="text-[11px] text-muted-foreground mt-0.5"><span className="font-medium text-foreground/80">{n.byName || "Onbekend"}</span> · {relTime(n.at)}</p></div>
                    <button onClick={() => removeShipNote(id, n.at)} className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded text-muted-foreground/50 hover:text-bad transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Log — audit trail */}
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
            {/* SECTIE 1 — Contactpunt & context */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <SectionHead n={1} title="Contactpunt & context" />
              {order ? (
                <Link to={`/orders/${order.id}`} className="block rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-foreground">{order.order_number || "Order"}</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><User className="h-3 w-3" />{order.customer_name || "—"}</div>
                  {order.customer_email && <p className="text-xs text-muted-foreground">{order.customer_email}</p>}
                  <div className="mt-1.5 flex items-center gap-3 text-xs"><span className="text-muted-foreground">Besteld {fmtDate(order.created_at)}</span>{orderTotal > 0 && <span className="font-medium text-foreground tabular-nums">{eur(orderTotal, order.currency ?? "EUR")}</span>}</div>
                </Link>
              ) : <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Circle className="h-3.5 w-3.5" /> Geen order gekoppeld</p>}

              {/* subscription — the rep must actively pick (a missed 1st order weighs heavier than a 5th) */}
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Abonnementslevering?</span>
                  <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted">
                    {([["Nee", false], ["Ja", true]] as const).map(([lbl, val]) => {
                      const active = meta.isSubscription === val;
                      return <button key={lbl} onClick={() => setMetaField({ isSubscription: val })} className={`h-6 px-3 rounded-md text-[11px] font-semibold transition-colors ${active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{lbl}</button>;
                    })}
                  </div>
                </div>
                {meta.isSubscription === undefined && <p className="text-[10px] mt-1" style={{ color: "hsl(var(--ember))" }}>Duid aan — dit bepaalt hoe royaal je oplost.</p>}
              </div>
              {meta.isSubscription && (
                <Field label="Zoveelste levering"><div className="flex items-center gap-1"><span className="text-muted-foreground text-[13px]">#</span><input type="number" value={meta.deliveryNumber ?? ""} onChange={(e) => setMetaField({ deliveryNumber: parseInt(e.target.value) || 0 })} placeholder="bv. 3" className="w-full bg-transparent text-[13px] outline-none tabular-nums" /></div></Field>
              )}
              {/* shipping address — straight from the order */}
              <Field label="Verzendadres · uit order">
                {addr ? <p className="text-[13px] text-foreground whitespace-pre-wrap flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />{addr}</p>
                  : <div><textarea value={meta.shippingAddress ?? ""} onChange={(e) => setMetaField({ shippingAddress: e.target.value })} rows={2} placeholder="Niet in de order — vul handmatig in en verifieer" className="w-full bg-transparent text-[13px] outline-none resize-none" /><p className="text-[10px]" style={{ color: "hsl(var(--ember))" }}>Geen adres in de order gevonden.</p></div>}
              </Field>
              {/* customer history — looked up automatically across our systems */}
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Klantgeschiedenis</span>
                  <button onClick={() => order && lookupHistory(order)} disabled={!order} className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5 disabled:opacity-50">{history.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} opnieuw opzoeken</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[10px] text-muted-foreground">Eerdere issues</p><p className="font-num text-lg font-bold tabular-nums leading-none mt-0.5" style={{ color: history.priorIssues >= 2 ? "hsl(var(--ember))" : "hsl(var(--foreground))" }}>{history.done ? history.priorIssues : "—"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Klant sinds</p><p className="text-[13px] font-medium text-foreground mt-1">{history.customerSince ? fmtDate(history.customerSince) : history.done ? "nieuw" : "—"}</p></div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Automatisch opgezocht in onze systemen (orders, returns, shipments, tickets).</p>
              </div>
              {history.priorIssues >= 2 && <p className="text-[11px]" style={{ color: "hsl(var(--ember))" }}><AlertTriangle className="h-3 w-3 inline mr-1" />Meerdere eerdere issues — behandel extra zorgvuldig.</p>}
            </motion.div>

            {/* SECTIE 3 — Fase & SLA detail */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <SectionHead n={3} title="Fase & urgentie" />
              <div className="rounded-xl px-3 py-2.5" style={{ background: `hsl(var(--${phase.tone}) / 0.07)` }}>
                <div className="flex items-center justify-between"><span className="text-[13px] font-semibold" style={{ color: toneColor(phase.tone) }}>{phase.level > 0 ? `Fase ${phase.level}` : "Op schema"}</span><span className="text-xs text-muted-foreground">{phase.label}</span></div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3" /> SLA: <span className="font-medium text-foreground">{phase.sla}</span></p>
              </div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Dagen te laat</span><span className="font-medium text-foreground tabular-nums">{phase.daysLate}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
                <span className="text-xs text-muted-foreground">Chargeback gedreigd</span>
                <button onClick={() => setMetaField({ chargebackThreat: !meta.chargebackThreat })} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={meta.chargebackThreat ? { background: "hsl(var(--bad)/0.14)", color: "hsl(var(--bad))" } : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{meta.chargebackThreat ? "Ja → fase 3" : "Nee"}</button>
              </div>
              <p className="text-[11px] text-muted-foreground">De fase wordt automatisch bepaald door de dagen vertraging óf het statustype — de ernstigste telt.</p>
            </motion.div>

            {/* SECTIE 6 — Resolutie & afsluiting */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <SectionHead n={6} title="Resolutie & afsluiting" />
              {resolved ? (
                <div className="rounded-xl bg-ok/10 border border-ok/20 px-3 py-3">
                  <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-full bg-ok grid place-items-center"><Check className="h-4 w-4 text-white" /></span><div><p className="text-[13px] font-semibold text-foreground">Opgelost</p><p className="text-xs text-muted-foreground">{meta.outcome || "—"} · {fmtDate(meta.resolvedAt)}</p></div></div>
                  <button onClick={reopen} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Heropenen</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Sluit de case af met de uitkomst — dit voedt je carrier- & kostenrapportage.{started && chosen && <> De uitkomst van je actie staat <span className="font-medium" style={{ color: "hsl(var(--ok))" }}>groen</span> gemarkeerd.</>}</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SHIP_OUTCOMES.map((o) => {
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
function ReadField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}{hint && <span className="font-normal normal-case tracking-normal opacity-70"> · {hint}</span>}</p>
      <p className="text-[13px] text-foreground">{value}</p>
    </div>
  );
}
const LogIcon = ({ kind }: { kind: ShipLogKind }) => {
  const c = kind === "status" ? "hsl(var(--info))" : kind === "phase" ? "hsl(var(--ember))" : kind === "owner" ? "hsl(var(--ember))" : kind === "resolution" ? "hsl(var(--ok))" : kind === "comm" ? "hsl(var(--primary))" : "hsl(var(--primary))";
  const I = kind === "status" ? Flag : kind === "solution" ? Package : kind === "owner" ? ShieldCheck : kind === "resolution" ? Check : kind === "comm" ? MessageSquare : Circle;
  return <I className="h-3 w-3" style={{ color: c }} />;
};
