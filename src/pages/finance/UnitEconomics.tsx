import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calculator, RotateCcw, ShoppingBag, Repeat, TrendingDown, Info } from "lucide-react";
import { fadeUp } from "@/lib/motion";

/* ─────────────────────────────────────────────────────────────────────────
   Unit Economics — contribution margin, CAC, LTV, payback & break-even ROAS
   for a single purchase or a subscription. All inputs are variable, per order.
   ───────────────────────────────────────────────────────────────────────── */

const LS = "gb_unit_economics";
const eur = (v: number) =>
  !Number.isFinite(v) ? "—" : (v < 0 ? "−" : "") + "€" + Math.abs(v).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctS = (v: number) => (!Number.isFinite(v) ? "—" : (v * 100).toLocaleString("nl-BE", { maximumFractionDigits: 1 }) + "%");
const numS = (v: number, d = 1) => (!Number.isFinite(v) ? "∞" : v.toLocaleString("nl-BE", { maximumFractionDigits: d }));

type Mode = "single" | "subscription";
type Inputs = {
  name: string;
  price: number; priceInclVat: boolean; vatPct: number;
  cogs: number; packaging: number; shippingCost: number; shippingCharged: number; fulfillment: number;
  paymentPct: number; paymentFixed: number; platformPct: number; discountPct: number;
  returnsPct: number; returnCost: number; otherVar: number;
  cac: number; ordersPerCustomer: number;
  subPrice: number; subEveryWeeks: number; churnPct: number;
};

const DEFAULTS: Inputs = {
  name: "Product",
  price: 39.95, priceInclVat: true, vatPct: 21,
  cogs: 8.5, packaging: 1.2, shippingCost: 4.5, shippingCharged: 0, fulfillment: 1.5,
  paymentPct: 2.4, paymentFixed: 0.25, platformPct: 0, discountPct: 0,
  returnsPct: 4, returnCost: 3.5, otherVar: 0,
  cac: 22, ordersPerCustomer: 1.8,
  subPrice: 33.95, subEveryWeeks: 4, churnPct: 8,
};

function computeOrder(price: number, i: Inputs) {
  const vatF = i.priceInclVat ? 1 + i.vatPct / 100 : 1;
  const chargedProduct = price * (1 - i.discountPct / 100);
  const chargedTotal = chargedProduct + i.shippingCharged;      // wat de klant betaalt (incl. btw)
  const paymentFee = (chargedTotal * i.paymentPct) / 100 + i.paymentFixed;
  const platformFee = (chargedTotal * i.platformPct) / 100;
  const netRevenue = chargedTotal / vatF;                        // jouw omzet, excl. btw
  const vatAmount = chargedTotal - netRevenue;
  const returnsCost = (i.returnsPct / 100) * i.returnCost;       // verwachte retourkost per order
  const cogsTotal = i.cogs + i.packaging;
  const fees = paymentFee + platformFee;
  const variableCosts = cogsTotal + i.shippingCost + i.fulfillment + fees + i.otherVar + returnsCost;
  const cm = netRevenue - variableCosts;                        // contributiemarge per order
  const cmPct = netRevenue > 0 ? cm / netRevenue : 0;
  const grossMargin = netRevenue - cogsTotal;
  const grossPct = netRevenue > 0 ? grossMargin / netRevenue : 0;
  return { chargedTotal, netRevenue, vatAmount, cogsTotal, shipping: i.shippingCost, fulfillment: i.fulfillment, fees, returnsCost, other: i.otherVar, variableCosts, cm, cmPct, grossMargin, grossPct };
}

export default function UnitEconomics() {
  const [mode, setMode] = useState<Mode>("single");
  const [i, setI] = useState<Inputs>(() => {
    try { const raw = localStorage.getItem(LS); if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }; } catch { /* ignore */ }
    return DEFAULTS;
  });
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(i)); } catch { /* ignore */ } }, [i]);
  const set = (k: keyof Inputs, v: number | string | boolean) => setI((p) => ({ ...p, [k]: v as never }));

  const o = useMemo(() => computeOrder(mode === "subscription" ? i.subPrice : i.price, i), [mode, i]);

  const m = useMemo(() => {
    // single
    const ltvSingle = o.cm * i.ordersPerCustomer;
    const paybackOrders = o.cm > 0 ? i.cac / o.cm : Infinity;
    // subscription
    const deliveriesPerMonth = i.subEveryWeeks > 0 ? 4.345 / i.subEveryWeeks : 0;
    const lifetimeMonths = i.churnPct > 0 ? 100 / i.churnPct : Infinity;
    const lifetimeDeliveries = lifetimeMonths === Infinity ? Infinity : lifetimeMonths * deliveriesPerMonth;
    const ltvSub = lifetimeDeliveries === Infinity ? Infinity : o.cm * lifetimeDeliveries;
    const mrrCm = o.cm * deliveriesPerMonth;
    const paybackMonths = mrrCm > 0 ? i.cac / mrrCm : Infinity;

    const ltv = mode === "subscription" ? ltvSub : ltvSingle;
    const ltvCac = i.cac > 0 ? ltv / i.cac : Infinity;
    const profit = Number.isFinite(ltv) ? ltv - i.cac : Infinity;
    const breakEvenRoas = o.cmPct > 0 ? 1 / o.cmPct : Infinity;
    return { ltv, ltvCac, profit, breakEvenRoas, paybackOrders, paybackMonths, deliveriesPerMonth, lifetimeMonths, mrrCm };
  }, [o, i, mode]);

  const cmTone = o.cmPct >= 0.35 ? "ok" : o.cmPct >= 0.2 ? "warn" : "bad";
  const ratioTone = m.ltvCac >= 3 ? "ok" : m.ltvCac >= 1.5 ? "warn" : "bad";

  const segs = [
    { label: "COGS + verpakking", value: o.cogsTotal, v: "grape" },
    { label: "Verzending", value: o.shipping, v: "info" },
    { label: "Fulfilment", value: o.fulfillment, v: "sun" },
    { label: "Fees (betaal + platform)", value: o.fees, v: "warn" },
    { label: "Retouren (verwacht)", value: o.returnsCost, v: "bad" },
    { label: "Overige", value: o.other, v: "muted-foreground" },
    { label: "Contributiemarge", value: Math.max(o.cm, 0), v: "ok" },
  ].filter((s) => s.value > 0.0001);
  const segTotal = segs.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-6">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--ok) / 0.12)" }}><Calculator className="h-5 w-5" style={{ color: "hsl(var(--ok))" }} /></span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Finance</p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Unit Economics</h1>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            {/* mode toggle */}
            <div className="inline-flex rounded-full border border-border bg-card p-0.5 shadow-xs">
              {([["single", "Eenmalig", ShoppingBag], ["subscription", "Abonnement", Repeat]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setMode(id)}
                  className={`h-8 px-3.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all ${mode === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <button onClick={() => setI(DEFAULTS)} className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6">
          {/* ── Inputs ── */}
          <div className="space-y-4">
            <Group title="Product & prijs">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium text-muted-foreground">Naam</span>
                <input value={i.name} onChange={(e) => set("name", e.target.value)}
                  className="mt-1 w-full h-9 px-2.5 rounded-lg border border-border bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              {mode === "single" ? (
                <Field label="Verkoopprijs" value={i.price} onChange={(v) => set("price", v)} suffix="€" />
              ) : (
                <>
                  <Field label="Abonnementsprijs / levering" value={i.subPrice} onChange={(v) => set("subPrice", v)} suffix="€" />
                  <Field label="Levering elke" value={i.subEveryWeeks} onChange={(v) => set("subEveryWeeks", v)} suffix="wkn" step={1} />
                </>
              )}
              <Field label="Btw" value={i.vatPct} onChange={(v) => set("vatPct", v)} suffix="%" step={1} />
              <label className="flex items-center gap-2 self-end pb-1.5">
                <input type="checkbox" checked={i.priceInclVat} onChange={(e) => set("priceInclVat", e.target.checked)} className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]" />
                <span className="text-[12px] text-muted-foreground">Prijs is incl. btw</span>
              </label>
            </Group>

            <Group title="Kostprijs & fulfilment">
              <Field label="Inkoop / COGS per stuk" value={i.cogs} onChange={(v) => set("cogs", v)} suffix="€" />
              <Field label="Verpakking" value={i.packaging} onChange={(v) => set("packaging", v)} suffix="€" />
              <Field label="Verzendkost (jij betaalt)" value={i.shippingCost} onChange={(v) => set("shippingCost", v)} suffix="€" />
              <Field label="Verzending aangerekend" value={i.shippingCharged} onChange={(v) => set("shippingCharged", v)} suffix="€" />
              <Field label="Fulfilment / pick & pack" value={i.fulfillment} onChange={(v) => set("fulfillment", v)} suffix="€" />
            </Group>

            <Group title="Fees, korting & retouren">
              <Field label="Betaalkost" value={i.paymentPct} onChange={(v) => set("paymentPct", v)} suffix="%" />
              <Field label="Betaalkost vast" value={i.paymentFixed} onChange={(v) => set("paymentFixed", v)} suffix="€" />
              <Field label="Platform / marktplaats" value={i.platformPct} onChange={(v) => set("platformPct", v)} suffix="%" />
              <Field label="Korting" value={i.discountPct} onChange={(v) => set("discountPct", v)} suffix="%" step={1} />
              <Field label="Retourpercentage" value={i.returnsPct} onChange={(v) => set("returnsPct", v)} suffix="%" step={1} />
              <Field label="Kost per retour" value={i.returnCost} onChange={(v) => set("returnCost", v)} suffix="€" />
              <Field label="Overige variabele kost" value={i.otherVar} onChange={(v) => set("otherVar", v)} suffix="€" />
            </Group>

            <Group title="Acquisitie & herhaling">
              <Field label="CAC (kost per nieuwe klant)" value={i.cac} onChange={(v) => set("cac", v)} suffix="€" />
              {mode === "single" ? (
                <Field label="Gem. orders per klant" value={i.ordersPerCustomer} onChange={(v) => set("ordersPerCustomer", v)} suffix="×" step={0.1} />
              ) : (
                <Field label="Maandelijkse churn" value={i.churnPct} onChange={(v) => set("churnPct", v)} suffix="%" step={0.5} />
              )}
            </Group>
          </div>

          {/* ── Results ── */}
          <div className="space-y-4">
            {/* headline KPIs */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3">
              <Kpi label="Contributiemarge / order" value={eur(o.cm)} sub={pctS(o.cmPct)} tone={cmTone as any} big />
              <Kpi label={mode === "subscription" ? "LTV (levenslang)" : "LTV / klant"} value={eur(m.ltv)} accent="hsl(var(--info))" />
              <Kpi label="LTV : CAC" value={Number.isFinite(m.ltvCac) ? `${numS(m.ltvCac, 1)}×` : "∞"} sub={`CAC ${eur(i.cac)}`} tone={ratioTone as any} />
              <Kpi label="Winst per klant" value={eur(m.profit)} tone={(m.profit >= 0 ? "ok" : "bad") as any} />
            </motion.div>

            {/* secondary metrics */}
            <div className="card-soft p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
              <Stat label="Brutomarge" value={pctS(o.grossPct)} sub={eur(o.grossMargin)} />
              <Stat label="Netto omzet / order" value={eur(o.netRevenue)} sub={i.priceInclVat ? `btw ${eur(o.vatAmount)}` : "excl. btw"} />
              <Stat label="Variabele kosten" value={eur(o.variableCosts)} />
              <Stat label="Break-even ROAS" value={Number.isFinite(m.breakEvenRoas) ? `${numS(m.breakEvenRoas, 2)}×` : "—"} sub="min. om winst te maken" />
              <Stat label="Max. CAC (break-even)" value={eur(mode === "subscription" ? (Number.isFinite(m.ltv) ? m.ltv : NaN) : o.cm * i.ordersPerCustomer)} sub="op LTV-basis" />
              {mode === "subscription" ? (
                <>
                  <Stat label="Terugverdientijd" value={Number.isFinite(m.paybackMonths) ? `${numS(m.paybackMonths, 1)} mnd` : "—"} />
                  <Stat label="Gem. levensduur" value={Number.isFinite(m.lifetimeMonths) ? `${numS(m.lifetimeMonths, 1)} mnd` : "∞"} />
                  <Stat label="Marge / maand" value={eur(m.mrrCm)} sub={`${numS(m.deliveriesPerMonth, 2)} lev./mnd`} />
                </>
              ) : (
                <Stat label="Terugverdientijd" value={Number.isFinite(m.paybackOrders) ? `${numS(m.paybackOrders, 1)} orders` : "—"} sub="tot CAC terugverdiend" />
              )}
            </div>

            {/* breakdown bar */}
            <div className="card-soft p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Waar gaat elke euro naartoe?</h3>
                <span className="text-xs text-muted-foreground">van {eur(o.netRevenue)} netto omzet</span>
              </div>
              <div className="flex h-4 w-full rounded-full overflow-hidden bg-muted">
                {segs.map((s) => (
                  <div key={s.label} title={`${s.label}: ${eur(s.value)}`} style={{ width: `${(s.value / segTotal) * 100}%`, background: `hsl(var(--${s.v}))` }} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {segs.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="rounded-sm shrink-0" style={{ background: `hsl(var(--${s.v}))`, width: 9, height: 9 }} />
                    <span className="text-muted-foreground flex-1 truncate">{s.label}</span>
                    <span className="font-medium text-foreground tabular-nums">{eur(s.value)}</span>
                    <span className="text-muted-foreground tabular-nums w-10 text-right">{pctS(s.value / segTotal)}</span>
                  </div>
                ))}
              </div>
              {o.cm < 0 && <p className="mt-3 text-xs text-bad flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Negatieve marge — je verliest geld op elke order vóór acquisitie.</p>}
            </div>

            {/* health */}
            <div className="card-soft p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Info className="h-4 w-4 text-muted-foreground" /> Gezondheid</div>
              <Health ok={o.cmPct >= 0.35} label="Contributiemarge ≥ 35%" actual={pctS(o.cmPct)} />
              <Health ok={m.ltvCac >= 3} label="LTV : CAC ≥ 3×" actual={Number.isFinite(m.ltvCac) ? `${numS(m.ltvCac, 1)}×` : "∞"} warn={m.ltvCac >= 1.5 && m.ltvCac < 3} />
              <Health ok={m.profit >= 0} label="Winstgevend per klant" actual={eur(m.profit)} />
              {mode === "subscription" && <Health ok={Number.isFinite(m.paybackMonths) && m.paybackMonths <= 6} label="Terugverdientijd ≤ 6 mnd" actual={Number.isFinite(m.paybackMonths) ? `${numS(m.paybackMonths, 1)} mnd` : "—"} warn={Number.isFinite(m.paybackMonths) && m.paybackMonths > 6 && m.paybackMonths <= 12} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── pieces ─────────────────────────────────────────────────────────────── */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </motion.div>
  );
}

function Field({ label, value, onChange, suffix, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 relative">
        <input type="number" step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full h-9 px-2.5 pr-8 rounded-lg border border-border bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 tabular-nums" />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
      </div>
    </label>
  );
}

function Kpi({ label, value, sub, tone, accent, big }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" | "warn"; accent?: string; big?: boolean }) {
  const color = tone ? `hsl(var(--${tone}))` : accent ?? "hsl(var(--foreground))";
  return (
    <div className={`card-soft p-4 ${big ? "col-span-2" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="font-num font-bold leading-none tabular-nums" style={{ color, fontSize: big ? "2rem" : "1.5rem" }}>{value}</p>
        {sub && <span className="text-xs font-medium mb-0.5" style={{ color: tone ? color : "hsl(var(--muted-foreground))" }}>{sub}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[15px] font-semibold text-foreground tabular-nums leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Health({ ok, warn, label, actual }: { ok: boolean; warn?: boolean; label: string; actual: string }) {
  const v = ok ? "ok" : warn ? "warn" : "bad";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-full shrink-0" style={{ background: `hsl(var(--${v}))`, width: 8, height: 8 }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: `hsl(var(--${v}))` }}>{actual}</span>
    </div>
  );
}
