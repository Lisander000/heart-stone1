import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp, stagger } from "@/lib/motion";
import { Plus, RefreshCw, Trash2, RotateCcw, Check, Settings2, X, ChevronRight, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useIsSuperUser, SUPERUSER_BLOCK } from "@/lib/superuser";
import { useAllStepPlans, saveSteps, useAllOutcomes, useAllOwners, useAllReturnMethods, ladderState, methodLabel, METHOD_GROUPS, type ReturnStep, type MethodGroup } from "@/lib/returnsSteps";
import { isOpenReturn, pingReturns } from "@/lib/returnsData";

type Ret = { id: string; order_id: string | null; reason: string | null; status: string; refund_amount: number | null; currency: string | null; created_at?: string };
type Order = { id: string; order_number: string | null; customer_name: string | null };

const STATUSES = ["requested", "approved", "received", "refunded", "rejected"];
const statusTone = (s: string) => s === "refunded" ? "ok" : s === "rejected" ? "bad" : s === "received" || s === "approved" ? "info" : "warn";
const eur = (v: number, c = "EUR") => new Intl.NumberFormat("nl-BE", { style: "currency", currency: c || "EUR" }).format(v || 0);
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
// shared status/phase pill — bordered "button" look, tone via a design token
const pillCls = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold";
const pillStyle = (token: string) => ({ background: `hsl(var(--${token}) / 0.1)`, color: `hsl(var(--${token}))`, borderColor: `hsl(var(--${token}) / 0.35)`, boxShadow: `0 1px 1.5px hsl(var(--${token}) / 0.08)` });

async function detect(table: string): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from(table).select("id").limit(1);
  return error ? "local" : "supabase";
}
async function loadArr(table: string): Promise<any[]> {
  const be = await detect(table);
  if (be === "supabase") { const { data } = await (supabase as any).from(table).select("*").order("created_at", { ascending: false }); return data ?? []; }
  try { return JSON.parse(localStorage.getItem(`gb_${table}`) || "[]"); } catch { return []; }
}

export default function Returns() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Ret[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [uid, setUid] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const plans = useAllStepPlans();
  const methods = useAllReturnMethods();
  const outcomes = useAllOutcomes();
  const owners = useAllOwners();
  const iAmSuper = useIsSuperUser();

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUid(user?.id ?? "");
    setBackend(await detect("returns"));
    const [r, o] = await Promise.all([loadArr("returns"), loadArr("orders")]);
    setRows(r as Ret[]); setOrders(o as Order[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const persist = (next: Ret[]) => localStorage.setItem("gb_returns", JSON.stringify(next));
  const orderOf = (id: string | null) => orders.find((o) => o.id === id);

  const addRet = async (draft: { order_id: string; reason: string; status: string; refund_amount: number }) => {
    const row: Ret = { id: crypto.randomUUID(), order_id: draft.order_id || null, reason: draft.reason.trim() || null, status: draft.status, refund_amount: draft.refund_amount || 0, currency: "EUR", created_at: new Date().toISOString() };
    const next = [row, ...rows]; setRows(next);
    if (backend === "local") persist(next);
    else { const { error } = await (supabase as any).from("returns").insert({ id: row.id, order_id: row.order_id, reason: row.reason, status: row.status, refund_amount: row.refund_amount, currency: row.currency, user_id: uid }); if (error) toast.error(error.message); }
    pingReturns();
    setAddOpen(false);
    navigate(`/returns/${row.id}`);
  };
  const removeRet = async (id: string) => {
    const next = rows.filter((r) => r.id !== id); setRows(next);
    if (backend === "local") persist(next); else await (supabase as any).from("returns").delete().eq("id", id);
    pingReturns();
  };

  const openPlan = () => { if (!iAmSuper) { toast.error(SUPERUSER_BLOCK); return; } setPlanOpen(true); };
  const GRID = "minmax(90px,0.7fr) minmax(180px,2.4fr) 132px minmax(128px,0.9fr) minmax(150px,1.2fr) 104px 40px";
  const unassignedOpen = rows.filter((r) => isOpenReturn(r.status) && !owners[r.id]).length;

  return (
    <div className="min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <div className="flex items-center gap-2.5">
              <span className="h-10 w-10 rounded-2xl grid place-items-center" style={{ background: "hsl(var(--bad)/0.12)" }}><RotateCcw className="h-5 w-5" style={{ color: "hsl(var(--bad))" }} /></span>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Returns</h1>
                <p className="text-sm text-muted-foreground">Per order · reden &amp; status. Open een retour om het stappenplan te volgen.</p>
              </div>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-xs transition-colors"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
            <button onClick={openPlan} title={iAmSuper ? "Stappenplan bewerken" : SUPERUSER_BLOCK}
              className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors">
              <Settings2 className="h-3.5 w-3.5" /> Stappenplan {!iAmSuper && <span className="text-[10px] opacity-60">🔒</span>}
            </button>
            <button onClick={() => setAddOpen(true)} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all"><Plus className="h-4 w-4" /> Nieuw retour</button>
          </div>
        </div>

        {/* smooth reminder banner */}
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3 flex items-center gap-3">
          <span className="h-8 w-8 rounded-xl bg-primary/10 grid place-items-center shrink-0"><ListChecks className="h-4 w-4 text-primary" /></span>
          <p className="text-sm text-foreground">Volg <span className="font-semibold">te allen tijde</span> het CS-stappenplan.</p>
          <span className="ml-auto text-xs text-muted-foreground shrink-0">per betaalmethode</span>
        </div>

        {/* unassigned cases need someone to pick them up */}
        {unassignedOpen > 0 && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "hsl(var(--ember)/0.08)", boxShadow: "inset 0 0 0 1px hsl(var(--ember)/0.25)" }}>
            <span className="h-8 w-8 rounded-xl grid place-items-center shrink-0" style={{ background: "hsl(var(--ember)/0.15)" }}><span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(var(--ember))" }} /></span>
            <p className="text-sm text-foreground"><span className="font-semibold" style={{ color: "hsl(var(--ember))" }}>{unassignedOpen} {unassignedOpen === 1 ? "case" : "cases"}</span> {unassignedOpen === 1 ? "moet" : "moeten"} nog opgenomen worden. Open een retour en klik <span className="font-medium">"Ik neem dit op"</span>.</p>
          </div>
        )}

        {/* returns list */}
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-max min-w-full">
              <div className="grid bg-muted border-b border-border" style={{ gridTemplateColumns: GRID }}>
                {["Order", "Reden", "Status", "Fase", "Eigenaar", "Refund", ""].map((h, i) => <div key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</div>)}
              </div>

              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 shimmer m-px" />)
              ) : rows.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3"><RotateCcw className="h-5 w-5 text-muted-foreground" /></div>
                  <p className="text-sm font-semibold text-foreground mb-1">Nog geen retouren</p>
                  <p className="text-xs text-muted-foreground mb-4">Maak er een aan om het stappenplan te doorlopen.</p>
                  <button onClick={() => setAddOpen(true)} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nieuw retour</button>
                </div>
              ) : (
                <motion.div variants={stagger(0.02)} initial="hidden" animate="visible" className="divide-y divide-border/50">
                  {rows.map((r) => {
                    const o = orderOf(r.order_id);
                    const tone = statusTone(r.status);
                    const c = `hsl(var(--${tone}))`;
                    const g = methods[r.id];
                    const rSteps = g ? plans[g] : null;
                    const ls = ladderState(outcomes[r.id] ?? {}, rSteps?.length ?? 0);
                    const owner = owners[r.id];
                    const needsPickup = isOpenReturn(r.status) && !owner;
                    return (
                      <motion.div key={r.id} variants={fadeUp} onClick={() => navigate(`/returns/${r.id}`)}
                        className="group grid items-center hover:bg-muted/40 transition-colors cursor-pointer" style={{ gridTemplateColumns: GRID }}>
                        <div className="px-4 py-3 text-[13px] font-medium text-foreground break-words">{o?.order_number || "—"}</div>
                        <div className="px-4 py-3 text-[13px] text-muted-foreground break-words">{r.reason || "—"}</div>
                        <div className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full border pl-2 pr-2.5 py-1 text-[11px] font-semibold capitalize" style={{ background: `hsl(var(--${tone}) / 0.1)`, color: c, borderColor: `hsl(var(--${tone}) / 0.35)`, boxShadow: `0 1px 1.5px hsl(var(--${tone}) / 0.08)` }}><span className="dot" style={{ background: c, width: 6, height: 6 }} />{r.status}</span>
                        </div>
                        <div className="px-4 py-3 whitespace-nowrap">
                          {!g
                            ? <span className={pillCls} style={pillStyle("ember")}>Methode kiezen</span>
                            : ls.resolved
                            ? <span className={pillCls} style={pillStyle("ok")}><Check className="h-3.5 w-3.5" /> Geaccepteerd</span>
                            : ls.currentIdx >= (rSteps?.length ?? 0)
                            ? <span className={pillCls} style={pillStyle("bad")}>Volledig refund</span>
                            : <span className={`${pillCls} tabular-nums`} style={pillStyle("muted-foreground")}>stap {ls.currentIdx + 1}/{rSteps?.length ?? 0}</span>}
                        </div>
                        <div className="px-4 py-3 min-w-0">
                          {owner ? (
                            <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full rounded-full border border-border bg-card pl-1 pr-2.5 py-0.5 shadow-[0_1px_1.5px_rgba(0,0,0,0.04)]" title={owner.email}>
                              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold shrink-0">{initials(owner.name)}</span>
                              <span className="text-[12px] font-medium text-foreground break-words">{owner.name}</span>
                            </span>
                          ) : needsPickup ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border pl-2 pr-2.5 py-1 text-[11px] font-semibold" style={{ background: "hsl(var(--ember) / 0.1)", color: "hsl(var(--ember))", borderColor: "hsl(var(--ember) / 0.35)", boxShadow: "0 1px 1.5px hsl(var(--ember) / 0.08)" }}>
                              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(var(--ember))" }} /> Nog op te nemen
                            </span>
                          ) : <span className="text-[12px] text-muted-foreground/50">—</span>}
                        </div>
                        <div className="px-4 py-3 text-[13px] text-foreground tabular-nums">{r.refund_amount ? eur(r.refund_amount, r.currency || "EUR") : "—"}</div>
                        <div className="px-2 flex items-center justify-end gap-0.5">
                          <button onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }} className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-bad transition-colors"><Trash2 className="h-4 w-4" /></button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddReturnDialog open={addOpen} onOpenChange={setAddOpen} orders={orders} onAdd={addRet} />
      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} plans={plans} onSave={saveSteps} />
      <ConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} onConfirm={() => { if (deleteId) removeRet(deleteId); setDeleteId(null); }} title="Retour verwijderen?" description="Dit retour en zijn voortgang worden verwijderd." />
    </div>
  );
}

/* ─── add return ─────────────────────────────────────────────────────────── */
function AddReturnDialog({ open, onOpenChange, orders, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; orders: Order[]; onAdd: (d: { order_id: string; reason: string; status: string; refund_amount: number }) => void }) {
  const [orderId, setOrderId] = useState(""); const [reason, setReason] = useState(""); const [status, setStatus] = useState("requested"); const [refund, setRefund] = useState("");
  useEffect(() => { if (open) { setOrderId(""); setReason(""); setStatus("requested"); setRefund(""); } }, [open]);
  const IN = "mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-ring/50";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display text-lg">Nieuw retour</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-muted-foreground">Order</label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={IN}>
              <option value="">— Geen / onbekend —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number || o.id.slice(0, 8)}{o.customer_name ? ` · ${o.customer_name}` : ""}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-medium text-muted-foreground">Reden</label><input value={reason} onChange={(e) => setReason(e.target.value)} className={IN} placeholder="Verkeerde maat, defect…" /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="text-xs font-medium text-muted-foreground">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={`${IN} capitalize`}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="flex-1"><label className="text-xs font-medium text-muted-foreground">Refund €</label><input type="number" value={refund} onChange={(e) => setRefund(e.target.value)} className={IN} placeholder="0" /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">Annuleer</button>
          <button onClick={() => onAdd({ order_id: orderId, reason, status, refund_amount: parseFloat(refund) || 0 })} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5"><Plus className="h-4 w-4" /> Toevoegen</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── super-user step plan editor — one ladder per payment method ─────────── */
function PlanDialog({ open, onOpenChange, plans, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; plans: Record<MethodGroup, ReturnStep[]>; onSave: (group: MethodGroup, steps: ReturnStep[]) => void }) {
  const [group, setGroup] = useState<MethodGroup>("other");
  const [drafts, setDrafts] = useState<Record<MethodGroup, ReturnStep[]>>(plans);
  useEffect(() => { if (open) { setDrafts(plans); setGroup("other"); } }, [open, plans]);
  const draft = drafts[group];
  const set = (i: number, patch: Partial<ReturnStep>) => setDrafts((d) => ({ ...d, [group]: d[group].map((x, j) => j === i ? { ...x, ...patch } : x) }));
  const IN = "w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-ring/50";
  const saveAll = () => {
    (Object.keys(drafts) as MethodGroup[]).forEach((g) => onSave(g, drafts[g].filter((s) => s.label.trim())));
    onOpenChange(false); toast.success("Stappenplannen opgeslagen.");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-lg flex items-center gap-2"><Settings2 className="h-4.5 w-4.5 text-primary" /> Stappenplan bewerken</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Eén de-escalatieladder per betaalmethode. Alleen super users kunnen dit aanpassen.</p>
        {/* method toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted">
          {METHOD_GROUPS.map((mg) => (
            <button key={mg.id} onClick={() => setGroup(mg.id)}
              className={`flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors ${group === mg.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {mg.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 max-h-[42vh] overflow-y-auto py-1">
          {draft.map((s, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-2.5">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 space-y-1.5">
                <input value={s.label} onChange={(e) => set(i, { label: e.target.value })} className={IN} placeholder={`Stap ${i + 1} — bv. 10% korting`} />
                <input value={s.note} onChange={(e) => set(i, { note: e.target.value })} className={`${IN} text-xs`} placeholder="Toelichting (optioneel)" />
              </div>
              <button onClick={() => setDrafts((d) => ({ ...d, [group]: d[group].filter((_, j) => j !== i) }))} className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground/50 hover:text-bad shrink-0"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={() => setDrafts((d) => ({ ...d, [group]: [...d[group], { label: "", note: "" }] }))} className="w-full h-10 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Stap toevoegen</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Tip: het % in de staptitel (bv. "10% korting") bepaalt automatisch het terugbetaalde bedrag.</p>
        <div className="flex justify-end gap-2 mt-1">
          <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">Annuleer</button>
          <button onClick={saveAll} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5"><Check className="h-4 w-4" /> Beide opslaan</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
