import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp } from "@/lib/motion";
import {
  ArrowLeft, ShoppingCart, User, Mail, Truck, RotateCcw, LifeBuoy, BadgeEuro,
  Plus, ChevronRight, Loader2, Save,
} from "lucide-react";
import { StatusBadge } from "@/components/ops/ResourcePage";

type Order = { id: string; order_number: string | null; customer_name: string | null; customer_email: string | null; status: string; fulfillment_status: string | null; total: number | null; currency: string | null; tracking_number: string | null; notes: string | null; created_at?: string };

const payTone = (v?: string | null) => (v === "paid" ? "ok" : v === "refunded" || v === "cancelled" ? "bad" : "warn");
const fulfilTone = (v?: string | null) => (v === "fulfilled" ? "ok" : v === "partial" ? "warn" : "bad");
const sbTone = (t: string) => (t === "ok" ? "success" : t === "bad" ? "danger" : "warn") as "success" | "warn" | "danger";
const toneColor = (t: string) => (({ ok: "hsl(var(--ok))", warn: "hsl(var(--warn))", bad: "hsl(var(--bad))", info: "hsl(var(--info))" }) as Record<string, string>)[t] ?? "hsl(var(--muted-foreground))";
const eur = (v: number, c = "EUR") => new Intl.NumberFormat("nl-BE", { style: "currency", currency: c || "EUR" }).format(v || 0);
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "—");

async function detect(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}
const readLS = (t: string): any[] => { try { return JSON.parse(localStorage.getItem(`gb_${t}`) || "[]"); } catch { return []; } };

export default function OrderDetail() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [shipments, setShipments] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [finance, setFinance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"shipments" | "returns" | "tickets" | "finance">("shipments");
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const be = await detect("orders"); setBackend(be);
      let o: Order | null = null;
      if (be === "supabase") { const { data } = await (supabase as any).from("orders").select("*").eq("id", orderId).maybeSingle(); o = data ?? null; }
      else { o = (readLS("orders") as Order[]).find((x) => x.id === orderId) ?? null; }
      setOrder(o); setNotes(o?.notes ?? ""); setNotesDirty(false);
      const byOrder = (arr: any[]) => arr.filter((x) => x.order_id === orderId);
      if (be === "supabase") {
        const [s, r, t, f] = await Promise.all([
          (supabase as any).from("shipments").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
          (supabase as any).from("returns").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
          (supabase as any).from("tickets").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
          (supabase as any).from("finance_entries").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
        ]);
        setShipments(s.data ?? []); setReturns(r.data ?? []); setTickets(t.data ?? []); setFinance(f.data ?? []);
      } else {
        setShipments(byOrder(readLS("shipments"))); setReturns(byOrder(readLS("returns"))); setTickets(byOrder(readLS("tickets"))); setFinance(byOrder(readLS("finance_entries")));
      }
      setLoading(false);
    })();
  }, [orderId]);

  const patch = async (p: Partial<Order>) => {
    setOrder((prev) => (prev ? { ...prev, ...p } : prev));
    if (backend === "local") { try { const arr = readLS("orders") as Order[]; localStorage.setItem("gb_orders", JSON.stringify(arr.map((x) => (x.id === orderId ? { ...x, ...p } : x)))); } catch { /* ignore */ } }
    else { const { error } = await (supabase as any).from("orders").update(p).eq("id", orderId); if (error) toast.error(error.message); }
  };

  const netFinance = useMemo(() => finance.reduce((n, x) => n + (x.type === "revenue" ? Number(x.amount ?? 0) : -Math.abs(Number(x.amount ?? 0))), 0), [finance]);
  const saveNotes = () => { patch({ notes: notes.trim() || null }); setNotesDirty(false); toast.success("Notitie opgeslagen."); };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!order) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div><p className="text-sm font-semibold text-foreground mb-1">Order niet gevonden</p><Link to="/orders" className="text-sm text-primary hover:underline">← Terug naar Orders</Link></div>
    </div>
  );

  const cur = order.currency ?? "EUR";
  const backQ = `?order_id=${orderId}&return_to=${encodeURIComponent(`/orders/${orderId}`)}`;
  const custQ = order.customer_email ? `&customer_email=${encodeURIComponent(order.customer_email)}` : "";
  const relatedTabs = [
    { id: "shipments", label: "Shipments", icon: Truck, items: shipments },
    { id: "returns", label: "Returns", icon: RotateCcw, items: returns },
    { id: "tickets", label: "Tickets", icon: LifeBuoy, items: tickets },
    { id: "finance", label: "Finance", icon: BadgeEuro, items: finance },
  ] as const;

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <button onClick={() => navigate("/orders")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Orders</button>
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--info)/0.12)" }}><ShoppingCart className="h-5 w-5" style={{ color: "hsl(var(--info))" }} /></span>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-5">
            {/* Order & status */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Order &amp; status</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Orderbedrag" value={eur(Number(order.total ?? 0), cur)} tone="info" />
                <Metric label="Shipments" value={String(shipments.length)} tone="info" />
                <Metric label="Returns" value={String(returns.length)} tone={returns.length ? "warn" : "info"} />
                <Metric label="Netto finance" value={eur(netFinance, cur)} tone={netFinance >= 0 ? "ok" : "bad"} />
              </div>
              {/* betaal- & fulfilmentstatus komen uit de orderbron (Shopify) — alleen-lezen hier */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Status · gesynct vanuit de orderbron</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Betaalstatus</p>
                    <StatusBadge value={order.status} tone={sbTone(payTone(order.status))} />
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Fulfilment</p>
                    <StatusBadge value={order.fulfillment_status ?? "—"} tone={sbTone(fulfilTone(order.fulfillment_status))} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Betaal- en fulfilmentstatus worden opgehaald uit de orderbron (bv. Shopify) en zijn hier alleen-lezen. Het trackingnummer kan je wel aanvullen.</p>
              </div>
              <Field label="Tracking nummer">
                <input value={order.tracking_number ?? ""} onChange={(e) => patch({ tracking_number: e.target.value })} placeholder="Trackingnummer" className="w-full bg-transparent text-[13px] outline-none" />
              </Field>
            </motion.div>

            {/* Related dossiers */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Gerelateerde dossiers</h2>
              <div className="flex gap-1 p-1 rounded-full bg-muted mb-4 w-fit flex-wrap">
                {relatedTabs.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)} className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                    <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-muted-foreground/15 text-[10px] font-bold tabular-nums">{t.items.length}</span>
                  </button>
                ))}
              </div>
              {tab === "shipments" && <RelatedList items={shipments} empty="Nog geen shipments voor deze order." onClick={(s) => navigate(`/shipments/${s.id}`)} newTo={`/ops/shipments/new${backQ}`} newLabel="Nieuwe shipment" render={(s) => <Row title={s.carrier || "Shipment"} sub={`${s.tracking_number || "geen tracking"} · ${fmtDate(s.shipped_at)}`} badge={<StatusBadge value={s.status} tone={["delivered", "resolved"].includes(s.status) ? "success" : ["lost", "failed", "returned_to_sender", "delivered_disputed"].includes(s.status) ? "danger" : "warn"} />} />} />}
              {tab === "returns" && <RelatedList items={returns} empty="Nog geen returns voor deze order." onClick={(r) => navigate(`/returns/${r.id}`)} newTo={`/ops/returns/new${backQ}&currency=${cur}`} newLabel="Nieuwe return" render={(r) => <Row title={r.reason || "Return"} sub={`Refund ${eur(Number(r.refund_amount ?? 0), r.currency || cur)} · ${fmtDate(r.created_at)}`} badge={<StatusBadge value={r.status} tone={["refunded", "resolved"].includes(r.status) ? "success" : r.status === "rejected" ? "danger" : "warn"} />} />} />}
              {tab === "tickets" && <RelatedList items={tickets} empty="Nog geen tickets voor deze order." onClick={(t) => navigate(`/tickets/${t.id}`)} newTo={`/ops/tickets/new${backQ}${custQ}`} newLabel="Nieuw ticket" render={(t) => <Row title={t.subject || "Ticket"} sub={`${t.customer_email || ""} · ${fmtDate(t.created_at)}`} badge={<StatusBadge value={t.status} tone={["solved", "closed", "resolved"].includes(t.status) ? "success" : "warn"} />} />} />}
              {tab === "finance" && <RelatedList items={finance} empty="Nog geen finance-boekingen." onClick={(f) => navigate(`/ops/finance_entries/${f.id}`)} newTo={`/ops/finance_entries/new${backQ}&currency=${cur}`} newLabel="Nieuwe boeking" render={(f) => <div className="flex items-center justify-between gap-3 w-full"><div className="min-w-0"><p className="text-[13px] font-medium text-foreground truncate">{f.category || f.description || f.type}</p><p className="text-xs text-muted-foreground">{fmtDate(f.occurred_at || f.created_at)}</p></div><span className="font-num text-[13px] tabular-nums shrink-0" style={{ color: f.type === "revenue" ? "hsl(var(--ok))" : "hsl(var(--bad))" }}>{f.type === "revenue" ? "+" : "−"}{eur(Math.abs(Number(f.amount ?? 0)), f.currency || cur)}</span></div>} />}
            </motion.div>

            {/* Internal note */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Interne notitie</h2>
                {notesDirty && <button onClick={saveNotes} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Opslaan</button>}
              </div>
              <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }} rows={3} placeholder="Interne notitie over deze order…" className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] outline-none focus:border-ring/50 focus:bg-card resize-none" />
            </motion.div>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-5">
            {/* Klant */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Klant</h2>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-[13px] text-foreground truncate">{order.customer_name || "—"}</span></div>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-[13px] text-foreground truncate">{order.customer_email || "—"}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Aangemaakt</span><span className="text-foreground">{fmtDate(order.created_at)}</span></div>
              {order.tracking_number && <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Tracking</span><span className="text-foreground font-mono truncate max-w-[55%]">{order.tracking_number}</span></div>}
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Totaal</span><span className="text-foreground font-semibold tabular-nums">{eur(Number(order.total ?? 0), cur)}</span></div>
            </motion.div>

            {/* Overzicht */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5 space-y-2.5">
              <h2 className="text-sm font-semibold text-foreground">Overzicht</h2>
              <OverviewRow icon={Truck} label="Shipments" value={shipments.length} />
              <OverviewRow icon={RotateCcw} label="Returns" value={returns.length} />
              <OverviewRow icon={LifeBuoy} label="Tickets" value={tickets.length} />
              <div className="flex items-center justify-between pt-2.5 border-t border-border/60">
                <span className="text-xs text-muted-foreground flex items-center gap-2"><BadgeEuro className="h-3.5 w-3.5" /> Netto finance</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: netFinance >= 0 ? "hsl(var(--ok))" : "hsl(var(--bad))" }}>{eur(netFinance, cur)}</span>
              </div>
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
function OverviewRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span>
      <span className="text-foreground font-semibold tabular-nums">{value}</span>
    </div>
  );
}
function Row({ title, sub, badge }: { title?: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground truncate">{title}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}
function RelatedList<T extends { id: string }>({ items, empty, render, onClick, newTo, newLabel }: {
  items: T[]; empty: string; render: (item: T) => React.ReactNode; onClick: (item: T) => void; newTo: string; newLabel: string;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? <div className="py-8 text-center text-xs text-muted-foreground">{empty}</div> : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {items.map((it) => (
            <button key={it.id} onClick={() => onClick(it)} className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
              <div className="flex-1 min-w-0">{render(it)}</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      )}
      <Link to={newTo} className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all">
        <Plus className="h-4 w-4" /> {newLabel}
      </Link>
    </div>
  );
}
