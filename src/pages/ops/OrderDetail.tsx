import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Loader2, AlertCircle, Truck, RotateCcw, Ticket as TicketIcon,
  DollarSign, Plus, Pencil, User, Mail, Package, ChevronRight,
} from "lucide-react";
import { fmtDate, fmtMoney, StatusBadge } from "@/components/ops/ResourcePage";
import { fadeUp, stagger } from "@/lib/motion";

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [finance, setFinance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!orderId) return;
    setLoading(true); setError(null);
    try {
      const { data: o, error: e0 } = await (supabase as any).from("orders").select("*").eq("id", orderId).maybeSingle();
      if (e0) throw e0;
      if (!o) throw new Error("Order niet gevonden");
      setOrder(o);

      const [s, r, t, f] = await Promise.all([
        (supabase as any).from("shipments").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
        (supabase as any).from("returns").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
        (supabase as any).from("tickets").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
        (supabase as any).from("finance_entries").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      ]);
      setShipments(s.data ?? []);
      setReturns(r.data ?? []);
      setTickets(t.data ?? []);
      setFinance(f.data ?? []);
    } catch (e: any) {
      setError(e.message ?? "Kon order niet laden");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  const netFinance = useMemo(() => {
    let n = 0;
    finance.forEach((x) => { const a = Number(x.amount ?? 0); n += x.type === "revenue" ? a : -Math.abs(a); });
    return n;
  }, [finance]);

  if (loading) return <div className="p-16 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Laden…</div>;
  if (error || !order) return (
    <div className="p-16 flex flex-col items-center gap-4 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div className="text-sm text-muted-foreground">{error ?? "Niet gevonden"}</div>
      <Link to="/orders" className="text-sm text-primary hover:underline">Terug naar orders</Link>
    </div>
  );

  const backQ = `?order_id=${orderId}&return_to=${encodeURIComponent(`/orders/${orderId}`)}`;
  const custQ = order.customer_email ? `&customer_email=${encodeURIComponent(order.customer_email)}` : "";

  return (
    <div className="min-h-screen pb-12">
      {/* ── Header ── */}
      <div className="border-b border-border bg-background">
        <div className="max-w-5xl mx-auto px-6 py-7">
          <Link to="/orders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Orders
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start justify-between gap-4 flex-wrap"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Order</p>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground leading-none font-mono">
                  {order.order_number}
                </h1>
                <StatusBadge value={order.status} tone={order.status === "paid" ? "success" : order.status === "cancelled" ? "danger" : "warn"} />
                <StatusBadge value={order.fulfillment_status} tone={order.fulfillment_status === "fulfilled" ? "success" : "warn"} />
              </div>
              <p className="text-sm text-muted-foreground mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {order.customer_name && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{order.customer_name}</span>}
                {order.customer_email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{order.customer_email}</span>}
                {order.tracking_number && <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />{order.tracking_number}</span>}
              </p>
            </div>
            <Link
              to={`/ops/orders/${orderId}/edit?return_to=${encodeURIComponent(`/orders/${orderId}`)}`}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" /> Order bewerken
            </Link>
          </motion.div>
        </div>
      </div>

      <motion.div
        variants={stagger(0.05)}
        initial="hidden" animate="visible"
        className="max-w-5xl mx-auto px-6 py-8 space-y-6"
      >
        {/* KPI strip */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {[
            { label: "Totaal", value: fmtMoney(order.total, order.currency) },
            { label: "Shipments", value: shipments.length },
            { label: "Returns", value: returns.length },
            { label: "Tickets", value: tickets.length },
            { label: "Netto finance", value: fmtMoney(netFinance, order.currency) },
          ].map((k) => (
            <div key={k.label} className="bg-card px-4 py-3.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className="mt-1 font-display text-xl font-semibold text-foreground leading-none">{k.value}</div>
            </div>
          ))}
        </motion.div>

        {order.notes && (
          <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-secondary/50 px-5 py-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Interne notitie</div>
            <p className="text-sm text-foreground leading-relaxed">{order.notes}</p>
          </motion.div>
        )}

        {/* Related dossiers */}
        <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card overflow-hidden">
          <Tabs defaultValue="shipments" className="w-full">
            <div className="px-3 pt-3 border-b border-border">
              <TabsList className="bg-muted p-1 rounded-xl h-auto flex-wrap gap-0.5">
                <TabTrig value="shipments" icon={<Truck className="h-3.5 w-3.5" />} label="Shipments" count={shipments.length} />
                <TabTrig value="returns" icon={<RotateCcw className="h-3.5 w-3.5" />} label="Returns" count={returns.length} />
                <TabTrig value="tickets" icon={<TicketIcon className="h-3.5 w-3.5" />} label="Tickets" count={tickets.length} />
                <TabTrig value="finance" icon={<DollarSign className="h-3.5 w-3.5" />} label="Finance" count={finance.length} />
              </TabsList>
            </div>

            {/* Shipments */}
            <TabsContent value="shipments" className="p-4 space-y-3 mt-0">
              <RelatedList
                items={shipments}
                empty="Nog geen shipments voor deze order."
                to={(s) => `/ops/shipments/${s.id}`}
                render={(s) => (
                  <Row
                    title={s.carrier ?? "Shipment"}
                    sub={`${s.tracking_number ?? "geen tracking"} · Verzonden ${fmtDate(s.shipped_at)} · Geleverd ${fmtDate(s.delivered_at)}`}
                    badge={<StatusBadge value={s.status} tone={s.status === "delivered" ? "success" : s.status === "failed" ? "danger" : "warn"} />}
                  />
                )}
              />
              <NewButton to={`/ops/shipments/new${backQ}`} label="Nieuwe shipment" />
            </TabsContent>

            {/* Returns */}
            <TabsContent value="returns" className="p-4 space-y-3 mt-0">
              <RelatedList
                items={returns}
                empty="Nog geen returns voor deze order."
                to={(r) => `/ops/returns/${r.id}`}
                render={(r) => (
                  <Row
                    title={r.reason ?? "—"}
                    sub={`Aangevraagd ${fmtDate(r.requested_at)} · Refund ${fmtMoney(r.refund_amount, r.currency)}`}
                    badge={<StatusBadge value={r.status} tone={r.status === "refunded" || r.status === "resolved" ? "success" : r.status === "rejected" ? "danger" : "warn"} />}
                  />
                )}
              />
              <NewButton to={`/ops/returns/new${backQ}&currency=${order.currency ?? "EUR"}`} label="Nieuwe return" />
            </TabsContent>

            {/* Tickets */}
            <TabsContent value="tickets" className="p-4 space-y-3 mt-0">
              <RelatedList
                items={tickets}
                empty="Nog geen tickets voor deze order."
                to={(t) => `/tickets/${t.id}`}
                render={(t) => (
                  <Row
                    title={t.subject ?? "—"}
                    sub={`${t.customer_email ?? ""} · ${fmtDate(t.created_at)}`}
                    badge={<StatusBadge value={t.status} tone={t.status === "solved" || t.status === "closed" || t.status === "resolved" ? "success" : "warn"} />}
                  />
                )}
              />
              <NewButton to={`/ops/tickets/new${backQ}${custQ}`} label="Nieuw ticket" />
            </TabsContent>

            {/* Finance */}
            <TabsContent value="finance" className="p-4 space-y-3 mt-0">
              <RelatedList
                items={finance}
                empty="Nog geen finance-boekingen voor deze order."
                to={(f) => `/ops/finance_entries/${f.id}`}
                render={(f) => (
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{f.category ?? f.description ?? f.type}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(f.occurred_at ?? f.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge value={f.type} tone={f.type === "revenue" ? "success" : "danger"} />
                      <span className="font-mono text-sm tabular-nums text-foreground">{f.type === "revenue" ? "+" : "−"}{fmtMoney(Math.abs(f.amount), f.currency)}</span>
                    </div>
                  </div>
                )}
              />
              <NewButton to={`/ops/finance_entries/new${backQ}&currency=${order.currency ?? "EUR"}`} label="Nieuwe boeking" />
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function TabTrig({ value, icon, label, count }: { value: string; icon: React.ReactNode; label: string; count: number }) {
  return (
    <TabsTrigger value={value} className="gap-1.5 rounded-lg data-[state=active]:bg-background text-xs">
      {icon} {label}
      <span className="ml-0.5 grid place-items-center h-4 min-w-4 px-1 rounded-full bg-muted-foreground/15 text-[10px] font-semibold">{count}</span>
    </TabsTrigger>
  );
}

function RelatedList<T extends { id: string }>({ items, empty, render, to }: {
  items: T[]; empty: string; render: (item: T) => React.ReactNode; to: (item: T) => string;
}) {
  const navigate = useNavigate();
  if (items.length === 0) return <div className="py-8 text-center text-xs text-muted-foreground">{empty}</div>;
  return (
    <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => navigate(to(it))}
          className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="flex-1 min-w-0">{render(it)}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </button>
      ))}
    </div>
  );
}

function Row({ title, mono, sub, badge }: { title?: string; mono?: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {mono && <span className="font-mono text-xs text-muted-foreground">{mono}</span>}
          {title}
        </div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}

function NewButton({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
    >
      <Plus className="h-4 w-4" /> {label}
    </Link>
  );
}
