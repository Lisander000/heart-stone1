import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp } from "@/lib/motion";
import {
  ArrowLeft, PackageOpen, User, Mail, MapPin, Truck, ExternalLink, Plus, ChevronRight,
  Loader2, Save, Clock, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { StatusBadge } from "@/components/ops/ResourcePage";

type Order = { id: string; order_number: string | null; customer_name: string | null; customer_email: string | null; status: string; fulfillment_status: string | null; total: number | null; currency: string | null; tracking_number: string | null; notes: string | null; created_at?: string; shipping_address?: string | null; address?: string | null; shipping_street?: string | null; shipping_postal_code?: string | null; shipping_zip?: string | null; shipping_city?: string | null; shipping_country?: string | null };
type Ship = { id: string; order_id: string | null; carrier: string | null; tracking_number: string | null; status: string; shipped_at: string | null; delivered_at: string | null; created_at?: string };

const payTone = (v?: string | null) => (v === "paid" ? "ok" : v === "refunded" || v === "cancelled" ? "bad" : "warn");
const fulfilTone = (v?: string | null) => (v === "fulfilled" ? "ok" : v === "partial" ? "warn" : "bad");
const sbTone = (t: string) => (t === "ok" ? "success" : t === "bad" ? "danger" : "warn") as "success" | "warn" | "danger";
const toneColor = (t: string) => (({ ok: "hsl(var(--ok))", warn: "hsl(var(--warn))", bad: "hsl(var(--bad))", info: "hsl(var(--info))", ember: "hsl(var(--ember))" }) as Record<string, string>)[t] ?? "hsl(var(--muted-foreground))";
const eur = (v: number, c = "EUR") => new Intl.NumberFormat("nl-BE", { style: "currency", currency: c || "EUR" }).format(v || 0);
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—");
const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : 0);
const orderAddress = (o?: Order | null): string => {
  if (!o) return "";
  if (o.shipping_address) return o.shipping_address;
  if (o.address) return o.address;
  return [o.shipping_street, [o.shipping_postal_code || o.shipping_zip, o.shipping_city].filter(Boolean).join(" "), o.shipping_country].filter(Boolean).join("\n");
};

async function detect(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}
const readLS = (t: string): any[] => { try { return JSON.parse(localStorage.getItem(`gb_${t}`) || "[]"); } catch { return []; } };

export default function UnfulfilledDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [shipments, setShipments] = useState<Ship[]>([]);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const be = await detect("orders"); setBackend(be);
      let o: Order | null = null; let s: Ship[] = [];
      if (be === "supabase") {
        const { data } = await (supabase as any).from("orders").select("*").eq("id", id).maybeSingle(); o = data ?? null;
        const { data: sd } = await (supabase as any).from("shipments").select("*").eq("order_id", id).order("created_at", { ascending: false }); s = sd ?? [];
      } else {
        o = (readLS("orders") as Order[]).find((x) => x.id === id) ?? null;
        s = (readLS("shipments") as Ship[]).filter((x) => x.order_id === id);
      }
      setOrder(o); setShipments(s); setNotes(o?.notes ?? ""); setNotesDirty(false); setLoading(false);
    })();
  }, [id]);

  const patch = async (p: Partial<Order>) => {
    setOrder((prev) => (prev ? { ...prev, ...p } : prev));
    if (backend === "local") { try { const arr = readLS("orders") as Order[]; localStorage.setItem("gb_orders", JSON.stringify(arr.map((x) => (x.id === id ? { ...x, ...p } : x)))); } catch { /* ignore */ } }
    else { const { error } = await (supabase as any).from("orders").update(p).eq("id", id); if (error) toast.error(error.message); }
  };
  const saveNotes = () => { patch({ notes: notes.trim() || null }); setNotesDirty(false); toast.success("Notitie opgeslagen."); };

  const days = useMemo(() => daysSince(order?.created_at), [order]);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!order) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div><p className="text-sm font-semibold text-foreground mb-1">Order niet gevonden</p><Link to="/unfulfilled" className="text-sm text-primary hover:underline">← Terug naar Unfulfilled</Link></div>
    </div>
  );

  const cur = order.currency ?? "EUR";
  const fulfilled = order.fulfillment_status === "fulfilled";
  const paid = order.status === "paid";
  const addr = orderAddress(order);
  const backQ = `?order_id=${id}&return_to=${encodeURIComponent(`/unfulfilled/${id}`)}`;
  // urgency: paid orders that sit unshipped for long are the priority
  const tone = fulfilled ? "ok" : days > 5 ? "bad" : days >= 2 ? "warn" : "info";
  const bannerLabel = fulfilled ? "Volledig verzonden" : `${days} ${days === 1 ? "dag" : "dagen"} onvervuld`;
  const bannerSub = fulfilled ? "Deze order is verzonden — niets meer te doen." : paid ? "Betaald · wacht op verzending — pak dit op door een shipment aan te maken." : "Nog niet betaald — controleer de betaling voor je verzendt.";

  return (
    <div className="min-h-screen" style={tone === "bad" ? { background: "hsl(var(--bad)/0.04)" } : undefined}>
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <button onClick={() => navigate("/unfulfilled")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Unfulfilled</button>
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--warn)/0.14)" }}><PackageOpen className="h-5 w-5" style={{ color: "hsl(var(--warn))" }} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{order.order_number || "Order"}</h1>
                <StatusBadge value={order.status} tone={sbTone(payTone(order.status))} />
                <StatusBadge value={order.fulfillment_status ?? "—"} tone={sbTone(fulfilTone(order.fulfillment_status))} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{order.customer_name || "Klant onbekend"}{order.customer_email ? ` · ${order.customer_email}` : ""}</p>
            </div>
          </div>
        </motion.div>

        {/* aging / urgency banner */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ background: `hsl(var(--${tone}) / 0.1)`, boxShadow: `inset 0 0 0 1px hsl(var(--${tone}) / 0.35)` }}>
          <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: toneColor(tone) }}>{fulfilled ? <CheckCircle2 className="h-5 w-5" /> : tone === "bad" ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: toneColor(tone) }}>{bannerLabel}</p>
            <p className="text-xs text-muted-foreground">{bannerSub}</p>
          </div>
          {tone === "bad" && <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" style={{ color: toneColor(tone) }} />}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-5">
            {/* Verzending & status */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Verzending &amp; status</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Orderbedrag" value={eur(Number(order.total ?? 0), cur)} tone="info" />
                <Metric label="Onvervuld" value={`${days}d`} tone={tone === "info" ? "info" : tone} />
                <Metric label="Shipments" value={String(shipments.length)} tone="ember" />
                <Metric label="Betaald" value={paid ? "Ja" : "Nee"} tone={paid ? "ok" : "bad"} />
              </div>
              {/* read-only synced status */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Status</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Betaalstatus</p><StatusBadge value={order.status} tone={sbTone(payTone(order.status))} /></div>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Fulfilment</p><StatusBadge value={order.fulfillment_status ?? "—"} tone={sbTone(fulfilTone(order.fulfillment_status))} /></div>
                </div>
              </div>
              {/* shipping address — from the order */}
              <Field label="Verzendadres · uit de order">
                {addr ? <p className="text-[13px] text-foreground whitespace-pre-wrap flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />{addr}</p> : <p className="text-[13px] text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> Geen adres in de order gevonden.</p>}
              </Field>
              {/* shipments for this order — creating one is how you fulfil */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Verzendingen voor deze order</p>
                {shipments.length === 0 ? <div className="py-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border">Nog geen verzending — maak er een aan om deze order te verzenden.</div> : (
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                    {shipments.map((s) => (
                      <button key={s.id} onClick={() => navigate(`/shipments/${s.id}`)} className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                        <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: "hsl(var(--ember)/0.12)" }}><Truck className="h-4 w-4" style={{ color: "hsl(var(--ember))" }} /></span>
                        <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-foreground truncate">{s.carrier || "Shipment"}</p><p className="text-xs text-muted-foreground truncate">{s.tracking_number || "geen tracking"} · {fmtDate(s.shipped_at)}</p></div>
                        <StatusBadge value={s.status} tone={["delivered", "resolved"].includes(s.status) ? "success" : ["lost", "failed", "returned_to_sender", "delivered_disputed"].includes(s.status) ? "danger" : "warn"} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
                <Link to={`/ops/shipments/new${backQ}`} className="mt-3 flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.99] transition-all shadow-sm"><Plus className="h-4 w-4" /> Maak shipment aan</Link>
              </div>
              {/* tracking */}
              <Field label="Tracking nummer">
                <input value={order.tracking_number ?? ""} onChange={(e) => patch({ tracking_number: e.target.value })} placeholder="Trackingnummer" className="w-full bg-transparent text-[13px] outline-none" />
              </Field>
            </motion.div>

            {/* Internal note */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Interne notitie</h2>
                {notesDirty && <button onClick={saveNotes} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Opslaan</button>}
              </div>
              <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }} rows={3} placeholder="Interne notitie over deze verzending…" className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
            </motion.div>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-5">
            {/* Klant */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Klant</h2>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-[13px] text-foreground truncate">{order.customer_name || "—"}</span></div>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-[13px] text-foreground truncate">{order.customer_email || "—"}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Besteld op</span><span className="text-foreground">{fmtDate(order.created_at)}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Orderbedrag</span><span className="text-foreground font-semibold tabular-nums">{eur(Number(order.total ?? 0), cur)}</span></div>
            </motion.div>

            {/* Overzicht + full order */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-2.5">
              <h2 className="text-sm font-semibold text-foreground">Overzicht</h2>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Dagen onvervuld</span><span className="font-semibold tabular-nums" style={{ color: toneColor(tone) }}>{days}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Shipments</span><span className="text-foreground font-semibold tabular-nums">{shipments.length}</span></div>
              <Link to={`/orders/${id}`} className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 hover:border-primary/30 transition-colors">
                <span className="text-[13px] font-medium text-foreground">Volledige order openen</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <p className="text-[10px] text-muted-foreground">Returns, tickets en finance van deze order vind je op de orderpagina.</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */
function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5"><span className="rounded-full shrink-0" style={{ background: toneColor(tone), width: 7, height: 7 }} /><p className="text-[11px] text-muted-foreground truncate">{label}</p></div>
      <p className="font-num text-lg font-bold tabular-nums text-foreground leading-none mt-1.5">{value}</p>
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
