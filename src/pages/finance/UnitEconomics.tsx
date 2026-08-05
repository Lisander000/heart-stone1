import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calculator, RotateCcw, ShoppingBag, Repeat, HelpCircle, TrendingDown,
  CheckCircle2, AlertTriangle, XCircle, Package, Truck, Megaphone, Receipt,
  Sparkles, Gauge, Lightbulb, ArrowLeftRight,
} from "lucide-react";
import { fadeUp } from "@/lib/motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/* ─────────────────────────────────────────────────────────────────────────
   Unit Economics — contribution margin, CAC, LTV, payback & break-even ROAS
   for a single purchase or a subscription.
   ───────────────────────────────────────────────────────────────────────── */

const LS = "gb_unit_economics";
const eur = (v: number) =>
  !Number.isFinite(v) ? "—" : (v < 0 ? "−" : "") + "€" + Math.abs(v).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctS = (v: number) => (!Number.isFinite(v) ? "—" : (v * 100).toLocaleString("nl-BE", { maximumFractionDigits: 1 }) + "%");
const numS = (v: number, d = 1) => (!Number.isFinite(v) ? "∞" : v.toLocaleString("nl-BE", { maximumFractionDigits: d }));

type Mode = "single" | "subscription";
type Inputs = {
  name: string;
  price: number; vatPct: number;
  cogs: number; packaging: number; shippingCharged: number; fulfillment: number;
  paymentPct: number; paymentFixed: number; platformPct: number; discountPct: number;
  returnsPct: number; returnCost: number; otherVar: number;
  cac: number; ordersPerCustomer: number;
  subPrice: number; subEveryWeeks: number; churnPct: number;
};

const DEFAULTS: Inputs = {
  name: "Product",
  price: 39.95, vatPct: 21,
  cogs: 8.5, packaging: 1.2, shippingCharged: 0, fulfillment: 6.0,
  paymentPct: 2.4, paymentFixed: 0.25, platformPct: 0, discountPct: 0,
  returnsPct: 4, returnCost: 3.5, otherVar: 0,
  cac: 22, ordersPerCustomer: 1.8,
  subPrice: 33.95, subEveryWeeks: 4, churnPct: 8,
};

function computeOrder(price: number, i: Inputs) {
  const vatF = 1 + i.vatPct / 100;               // prijs wordt altijd incl. btw ingegeven
  const chargedProduct = price * (1 - i.discountPct / 100);
  const chargedTotal = chargedProduct + i.shippingCharged;
  const paymentFee = (chargedTotal * i.paymentPct) / 100 + i.paymentFixed;
  const platformFee = (chargedTotal * i.platformPct) / 100;
  const netRevenue = chargedTotal / vatF;         // omzet excl. btw
  const priceExVat = price / vatF;                // verkoopprijs excl. btw
  const vatAmount = chargedTotal - netRevenue;
  const returnsCost = (i.returnsPct / 100) * i.returnCost;
  const cogsTotal = i.cogs + i.packaging;
  const fees = paymentFee + platformFee;
  const variableCosts = cogsTotal + i.fulfillment + fees + i.otherVar + returnsCost;
  const cm = netRevenue - variableCosts;
  const cmPct = netRevenue > 0 ? cm / netRevenue : 0;
  const grossMargin = netRevenue - cogsTotal;
  const grossPct = netRevenue > 0 ? grossMargin / netRevenue : 0;
  return { chargedTotal, netRevenue, priceExVat, vatAmount, cogsTotal, fulfillment: i.fulfillment, fees, returnsCost, other: i.otherVar, variableCosts, cm, cmPct, grossMargin, grossPct };
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
    const ltvSingle = o.cm * i.ordersPerCustomer;
    const paybackOrders = o.cm > 0 ? i.cac / o.cm : Infinity;
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

  // ── auto insights ──────────────────────────────────────────────────────
  const ins = useMemo(() => {
    const price = mode === "subscription" ? i.subPrice : i.price;
    const cmOf = (patch: Partial<Inputs>, priceOverride?: number) => computeOrder(priceOverride ?? price, { ...i, ...patch }).cm;
    const base = o.cm;
    const levers = [
      { label: "Prijs +10%", delta: cmOf({}, price * 1.1) - base },
      { label: "COGS −10%", delta: cmOf({ cogs: i.cogs * 0.9 }) - base },
      { label: "Fulfillment −10%", delta: cmOf({ fulfillment: i.fulfillment * 0.9 }) - base },
      { label: "Betaalkost −10%", delta: cmOf({ paymentPct: i.paymentPct * 0.9 }) - base },
      { label: "Retouren −10%", delta: cmOf({ returnsPct: i.returnsPct * 0.9 }) - base },
      { label: "Verpakking −10%", delta: cmOf({ packaging: i.packaging * 0.9 }) - base },
    ].filter((l) => l.delta > 0.0001).sort((a, b) => b.delta - a.delta);
    const leverMax = Math.max(...levers.map((l) => l.delta), 0.01);

    const maxCac3 = Number.isFinite(m.ltv) ? m.ltv / 3 : Infinity;
    const breakEvenCac = m.ltv;
    let maxDiscount = Infinity;
    if (o.cm > 0) { let lo = i.discountPct, hi = 100; for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (computeOrder(price, { ...i, discountPct: mid }).cm > 0) lo = mid; else hi = mid; } maxDiscount = lo; }
    const maxReturns = i.returnCost > 0 && o.cm > 0 ? i.returnsPct + (o.cm * 100) / i.returnCost : Infinity;
    const maxChurn = mode === "subscription" && i.cac > 0 && o.cm > 0 ? (o.cm * 100 * m.deliveriesPerMonth) / (3 * i.cac) : null;
    const minOrders = mode === "single" && o.cm > 0 ? (3 * i.cac) / o.cm : null;

    const single = computeOrder(i.price, i);
    const sub = computeOrder(i.subPrice, i);
    const singleLtv = single.cm * i.ordersPerCustomer;
    const subDeliv = i.subEveryWeeks > 0 ? 4.345 / i.subEveryWeeks : 0;
    const subLife = i.churnPct > 0 ? 100 / i.churnPct : Infinity;
    const subLtv = subLife === Infinity ? Infinity : sub.cm * subLife * subDeliv;
    const singleRatio = i.cac > 0 ? singleLtv / i.cac : Infinity;
    const subRatio = i.cac > 0 ? subLtv / i.cac : Infinity;

    const costs = [
      { label: "COGS + verpakking", value: o.cogsTotal },
      { label: "Fulfillment", value: o.fulfillment },
      { label: "Fees", value: o.fees },
      { label: "Retouren", value: o.returnsCost },
    ].sort((a, b) => b.value - a.value);
    const bullets: { tone: string; text: string }[] = [];
    if (costs[0] && o.netRevenue > 0) bullets.push({ tone: "info", text: `${costs[0].label} is je grootste kost — ${pctS(costs[0].value / o.netRevenue)} van de omzet.` });
    if (o.cmPct < 0.35 && levers[0]) bullets.push({ tone: "bad", text: `Marge ${pctS(o.cmPct)} ligt onder de gezonde 35%. Grootste hefboom: ${levers[0].label} (+${eur(levers[0].delta)}).` });
    else if (o.cmPct >= 0.35 && m.ltvCac < 3) bullets.push({ tone: "warn", text: "Marge is gezond maar LTV:CAC is krap — retentie verhogen loont meer dan CAC verlagen." });
    if (m.ltvCac >= 3 && Number.isFinite(maxCac3)) bullets.push({ tone: "ok", text: `Ruimte om te schalen: je kan tot ${eur(maxCac3)} CAC betalen en nog 3:1 halen (nu ${eur(i.cac)}).` });
    if (Number.isFinite(maxReturns) && maxReturns < 100) bullets.push({ tone: "warn", text: `Boven ${pctS(maxReturns / 100)} retouren verdwijnt je marge volledig.` });
    else if (Number.isFinite(maxDiscount) && maxDiscount < 100 && maxDiscount > i.discountPct + 0.5) bullets.push({ tone: "info", text: `Je kan tot ${pctS(maxDiscount / 100)} korting geven vóór je per order verlies maakt.` });
    if (mode === "subscription" && Number.isFinite(m.paybackMonths) && m.paybackMonths > 6) bullets.push({ tone: "warn", text: `Een abonnee is pas na ${numS(m.paybackMonths, 1)} mnd terugverdiend — dat is lang.` });
    if (Number.isFinite(subRatio) && Number.isFinite(singleRatio)) bullets.push({ tone: "ok", text: `${subRatio >= singleRatio ? "Abonnement" : "Eenmalig"} is winstgevender: LTV:CAC ${numS(Math.max(subRatio, singleRatio), 1)}× vs ${numS(Math.min(subRatio, singleRatio), 1)}×.` });

    // net margin: before vs after ad spend (CAC)
    const lifetimeRevenue = mode === "subscription"
      ? (subLife === Infinity ? Infinity : o.netRevenue * subLife * subDeliv)
      : o.netRevenue * i.ordersPerCustomer;
    const netPerCustomer = m.profit; // LTV − CAC
    const netPerCustomerPct = lifetimeRevenue === Infinity ? o.cmPct : (lifetimeRevenue > 0 ? netPerCustomer / lifetimeRevenue : 0);
    const netFirstSale = o.cm - i.cac;
    const netFirstSalePct = o.netRevenue > 0 ? netFirstSale / o.netRevenue : 0;
    // max creator payout (as acquisition cost) to keep payback < 3 months (sub) / stay profitable (single)
    const maxCreator = mode === "subscription" ? 3 * m.mrrCm : o.cm;
    const priceBase = mode === "subscription" ? i.subPrice : i.price;
    const maxCreatorPct = priceBase > 0 ? maxCreator / priceBase : 0;

    return { levers, leverMax, maxCac3, breakEvenCac, maxDiscount, maxReturns, maxChurn, minOrders, singleLtv, subLtv, singleRatio, subRatio, bullets, netPerCustomer, netPerCustomerPct, netFirstSale, netFirstSalePct, maxCreator, maxCreatorPct };
  }, [o, i, m, mode]);


  const segs = [
    { label: "COGS + verpakking", value: o.cogsTotal, v: "grape" },
    { label: "Fulfillment", value: o.fulfillment, v: "info" },
    { label: "Fees (betaal + platform)", value: o.fees, v: "warn" },
    { label: "Retouren (verwacht)", value: o.returnsCost, v: "bad" },
    { label: "Overige", value: o.other, v: "muted-foreground" },
    { label: "Contributiemarge", value: Math.max(o.cm, 0), v: "ok" },
  ].filter((s) => s.value > 0.0001);
  const segTotal = segs.reduce((s, x) => s + x.value, 0) || 1;

  const ltvCacMax = Math.max(Number.isFinite(m.ltv) ? m.ltv : 0, i.cac, 1);
  const perOrderLabel = mode === "subscription" ? "levering" : "order";

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-6">
        {/* ── header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--ok) / 0.12)" }}><Calculator className="h-5 w-5" style={{ color: "hsl(var(--ok))" }} /></span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Finance</p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Unit Economics</h1>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-card p-0.5 shadow-xs">
              {([["single", "Eenmalig", ShoppingBag], ["subscription", "Abonnement", Repeat]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setMode(id)}
                  className={`h-8 px-3.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all ${mode === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <button onClick={() => setI(DEFAULTS)} title="Terug naar standaardwaarden" className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-xs transition-colors"><RotateCcw className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Inputs ── */}
          <div className="space-y-4">
            <Section icon={Receipt} title="Product & prijs" accent="ok">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium text-muted-foreground">Naam</span>
                <input value={i.name} onChange={(e) => set("name", e.target.value)}
                  className="mt-1 w-full h-9 px-2.5 rounded-lg border border-border bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              {mode === "single" ? (
                <Field label="Verkoopprijs (incl. btw)" value={i.price} onChange={(v) => set("price", v)} unit="€" />
              ) : (
                <>
                  <Field label="Prijs / levering (incl. btw)" value={i.subPrice} onChange={(v) => set("subPrice", v)} unit="€" />
                  <Field label="Levering elke" value={i.subEveryWeeks} onChange={(v) => set("subEveryWeeks", v)} unit="wkn" step={1} />
                </>
              )}
              <Field label="Btw" value={i.vatPct} onChange={(v) => set("vatPct", v)} unit="%" step={1} />
              <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">Prijs excl. btw</span>
                <span className="text-[13px] font-semibold text-foreground tabular-nums">{eur(o.priceExVat)}</span>
              </div>
            </Section>

            <Section icon={Package} title="Kostprijs & fulfilment" accent="grape">
              <Field label="COGS / stuk" value={i.cogs} onChange={(v) => set("cogs", v)} unit="€" info="Wat het product jou kost om in te kopen of te maken." />
              <Field label="Verpakking" value={i.packaging} onChange={(v) => set("packaging", v)} unit="€" />
              <Field label="Fulfillment" value={i.fulfillment} onChange={(v) => set("fulfillment", v)} unit="€" info="Pick & pack + de verzendkost die jij betaalt, samen." />
              <Field label="Verzending aangerekend" value={i.shippingCharged} onChange={(v) => set("shippingCharged", v)} unit="€" info="Wat je de klant aanrekent voor verzending (telt als extra omzet)." />
            </Section>

            <Section icon={Truck} title="Fees, korting & retouren" accent="warn">
              <Field label="Betaalkost" value={i.paymentPct} onChange={(v) => set("paymentPct", v)} unit="%" info="Transactiekost van je betaalprovider (bv. Mollie, Stripe)." />
              <Field label="Betaalkost vast" value={i.paymentFixed} onChange={(v) => set("paymentFixed", v)} unit="€" />
              <Field label="Platform / marktplaats" value={i.platformPct} onChange={(v) => set("platformPct", v)} unit="%" />
              <Field label="Korting" value={i.discountPct} onChange={(v) => set("discountPct", v)} unit="%" step={1} />
              <Field label="Retourpercentage" value={i.returnsPct} onChange={(v) => set("returnsPct", v)} unit="%" step={1} info="Hoeveel % van de orders retour komt." />
              <Field label="Kost per retour" value={i.returnCost} onChange={(v) => set("returnCost", v)} unit="€" />
              <Field label="Overige variabele kost" value={i.otherVar} onChange={(v) => set("otherVar", v)} unit="€" />
            </Section>

            <Section icon={Megaphone} title="Acquisitie & herhaling" accent="info">
              <Field label="CAC" value={i.cac} onChange={(v) => set("cac", v)} unit="€" info="Customer Acquisition Cost: marketingkost om één nieuwe klant binnen te halen (spend ÷ nieuwe klanten)." />
              {mode === "single" ? (
                <Field label="Gem. orders per klant" value={i.ordersPerCustomer} onChange={(v) => set("ordersPerCustomer", v)} unit="×" step={0.1} info="Hoeveel keer een klant gemiddeld koopt over zijn hele leven. 1 = eenmalig." />
              ) : (
                <Field label="Maandelijkse churn" value={i.churnPct} onChange={(v) => set("churnPct", v)} unit="%" step={0.5} info="Hoeveel % van de abonnees per maand opzegt. Levensduur = 1 ÷ churn." />
              )}
            </Section>
          </div>

          {/* ── Results ── */}
          <div className="space-y-4">

            {/* ── PER ORDER ── */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Per {perOrderLabel}</h3>
              <div className="flex items-end justify-between gap-3 pb-4 mb-4 border-b border-border/60">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">Contributiemarge <Tip text="Wat er per order overblijft na álle variabele kosten (COGS, fulfillment, fees, retouren). Dít betaalt je marketing en vaste kosten." /></p>
                  <p className="font-num font-bold leading-none tabular-nums mt-1.5" style={{ color: `hsl(var(--${cmTone}))`, fontSize: "2.5rem" }}>{eur(o.cm)}</p>
                </div>
                <span className="text-2xl font-bold tabular-nums mb-1" style={{ color: `hsl(var(--${cmTone}))` }}>{pctS(o.cmPct)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <StatBox label="Brutomarge" value={pctS(o.grossPct)} sub={eur(o.grossMargin)} />
                <StatBox label="Variabele kosten" value={eur(o.variableCosts)} />
                <StatBox label="Prijs excl. btw" value={eur(o.priceExVat)} />
                <StatBox label="Break-even ROAS" value={Number.isFinite(m.breakEvenRoas) ? `${numS(m.breakEvenRoas, 2)}×` : "—"} info="De minimale ROAS (omzet ÷ ad spend) om quitte te spelen = 1 ÷ contributiemarge%." />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Waar gaat elke euro naartoe?</p>
              <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-muted">
                {segs.map((s) => (
                  <div key={s.label} title={`${s.label}: ${eur(s.value)}`} style={{ width: `${(s.value / segTotal) * 100}%`, background: `hsl(var(--${s.v}))` }} />
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {segs.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="rounded-sm shrink-0" style={{ background: `hsl(var(--${s.v}))`, width: 9, height: 9 }} />
                    <span className="text-muted-foreground flex-1 truncate">{s.label}</span>
                    <span className="font-medium text-foreground tabular-nums">{eur(s.value)}</span>
                    <span className="text-muted-foreground tabular-nums w-11 text-right">{pctS(s.value / segTotal)}</span>
                  </div>
                ))}
              </div>
              {o.cm < 0 && <p className="mt-3 text-xs text-bad flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Negatieve marge — je verliest geld op elke order, nog vóór acquisitie.</p>}
            </motion.div>

            {/* ── PER KLANT ── */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Per klant · levenslang</h3>
              <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-border/60">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">Winst per klant <Tip text="LTV minus CAC — de netto winst die één nieuwe klant je uiteindelijk oplevert." /></p>
                  <p className="font-num font-bold leading-none tabular-nums mt-1.5" style={{ color: `hsl(var(--${m.profit >= 0 ? "ok" : "bad"}))`, fontSize: "2rem" }}>{eur(m.profit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">LTV : CAC <Tip text="Verhouding tussen wat een klant opbrengt en wat hij kost om te werven. Gezond = 3× of meer." /></p>
                  <p className="font-num font-bold leading-none tabular-nums mt-1.5" style={{ color: `hsl(var(--${ratioTone}))`, fontSize: "2rem" }}>{Number.isFinite(m.ltvCac) ? `${numS(m.ltvCac, 1)}×` : "∞"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <StatBox label="LTV" value={eur(m.ltv)} info="Lifetime Value: totale contributiemarge die één klant over zijn hele leven oplevert." />
                <StatBox label="CAC" value={eur(i.cac)} />
                {mode === "subscription" ? (
                  <>
                    <StatBox label="Terugverdientijd" value={Number.isFinite(m.paybackMonths) ? `${numS(m.paybackMonths, 1)} mnd` : "—"} />
                    <StatBox label="Gem. levensduur" value={Number.isFinite(m.lifetimeMonths) ? `${numS(m.lifetimeMonths, 1)} mnd` : "∞"} />
                    <StatBox label="Marge / maand" value={eur(m.mrrCm)} sub={`${numS(m.deliveriesPerMonth, 2)} lev./mnd`} />
                  </>
                ) : (
                  <StatBox label="Terugverdientijd" value={Number.isFinite(m.paybackOrders) ? `${numS(m.paybackOrders, 1)} orders` : "—"} sub="tot CAC terugverdiend" />
                )}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">LTV vs. CAC</p>
              <MiniBar label="LTV" value={m.ltv} max={ltvCacMax} color="hsl(var(--info))" />
              <MiniBar label="CAC" value={i.cac} max={ltvCacMax} color="hsl(var(--muted-foreground))" />
            </motion.div>
          </div>
        </div>

        {/* ══════════════ NETTO MARGE · volledige breedte ══════════════ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="card-soft p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Netto marge · met vs. zonder ad spend</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={{ background: "hsl(var(--ok) / 0.06)" }}>
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">Zónder ad spend <Tip text="Contributiemarge: wat je per order overhoudt vóór marketing/acquisitie. Dít is de bekende marge (bv. 57%)." /></p>
              <p className="text-[10px] text-muted-foreground mb-2">contributiemarge / {perOrderLabel}</p>
              <p className="font-num text-2xl font-bold tabular-nums leading-none" style={{ color: "hsl(var(--ok))" }}>{pctS(o.cmPct)}</p>
              <p className="text-xs text-muted-foreground mt-1">{eur(o.cm)} / {perOrderLabel}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: `hsl(var(--${ins.netPerCustomer >= 0 ? "info" : "bad"}) / 0.06)` }}>
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">Mét ad spend <Tip text="Netto marge ná aftrek van de acquisitiekost (CAC), over de hele klant. Dít houd je écht over." /></p>
              <p className="text-[10px] text-muted-foreground mb-2">na CAC · over de hele klant</p>
              <p className="font-num text-2xl font-bold tabular-nums leading-none" style={{ color: `hsl(var(--${ins.netPerCustomer >= 0 ? "info" : "bad"}))` }}>{pctS(ins.netPerCustomerPct)}</p>
              <p className="text-xs text-muted-foreground mt-1">{eur(ins.netPerCustomer)} / klant</p>
            </div>
            <div className="rounded-xl p-4 bg-muted/40">
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">Netto / 1e sale <Tip text="Contributiemarge van de eerste aankoop mín de volledige CAC — wat een nieuwe klant je meteen netto oplevert." /></p>
              <p className="text-[10px] text-muted-foreground mb-2">na CAC</p>
              <p className="font-num text-2xl font-bold tabular-nums leading-none text-foreground">{eur(ins.netFirstSale)}</p>
              <p className="text-xs text-muted-foreground mt-1">{pctS(ins.netFirstSalePct)} van de omzet</p>
            </div>
            <div className="rounded-xl p-4 bg-muted/40">
              <p className="text-[11px] font-semibold text-foreground">Netto / klant</p>
              <p className="text-[10px] text-muted-foreground mb-2">LTV − CAC</p>
              <p className="font-num text-2xl font-bold tabular-nums leading-none text-foreground">{eur(ins.netPerCustomer)}</p>
              <p className="text-xs text-muted-foreground mt-1">over de hele klant</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "hsl(var(--grape) / 0.08)" }}>
            <Megaphone className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--grape))" }} />
            <p className="text-xs text-foreground leading-snug">
              <span className="font-semibold">Creator-budget:</span> max <span className="font-semibold tabular-nums">{pctS(ins.maxCreatorPct)}</span> van de prijs ({eur(ins.maxCreator)}) {mode === "subscription" ? "om payback < 3 mnd te houden" : "en nog winstgevend per sale"}.
            </p>
          </div>
        </motion.div>

        {/* ══════════════ INZICHTEN (auto dashboard) ══════════════ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Inzichten</h2>
            <span className="text-xs text-muted-foreground">— automatisch uit je cijfers</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Hefbomen */}
            <div className="card-soft p-5">
              <div className="flex items-center gap-2 mb-1"><Gauge className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">Grootste hefbomen</h3></div>
              <p className="text-[11px] text-muted-foreground mb-3">10% verbetering per knop → extra marge / {perOrderLabel}</p>
              <div className="space-y-2">
                {ins.levers.slice(0, 5).map((l) => (
                  <div key={l.label} className="flex items-center gap-2.5">
                    <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{l.label}</span>
                    <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden"><div className="h-full rounded-md transition-all" style={{ width: `${(l.delta / ins.leverMax) * 100}%`, background: "hsl(var(--ok))" }} /></div>
                    <span className="text-xs font-semibold text-foreground tabular-nums w-14 text-right">+{eur(l.delta)}</span>
                  </div>
                ))}
                {ins.levers.length === 0 && <p className="text-xs text-muted-foreground">Vul kosten in om hefbomen te zien.</p>}
              </div>
            </div>

            {/* Grenzen */}
            <div className="card-soft p-5">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">Je grenzen</h3></div>
              <div className="grid grid-cols-2 gap-2.5">
                <StatBox label="Max. CAC (3:1)" value={eur(ins.maxCac3)} info="Het maximum dat je per nieuwe klant mag betalen om nog een gezonde 3:1 LTV:CAC te halen." />
                <StatBox label="Break-even CAC" value={eur(ins.breakEvenCac)} sub="1:1 — kop noch staart" />
                <StatBox label="Max. korting" value={Number.isFinite(ins.maxDiscount) ? pctS(ins.maxDiscount / 100) : "—"} sub="voor verlies / order" />
                <StatBox label="Max. retouren" value={Number.isFinite(ins.maxReturns) && ins.maxReturns < 100 ? pctS(ins.maxReturns / 100) : "—"} sub="voor marge = 0" />
                {mode === "subscription"
                  ? <StatBox label="Max. churn (3:1)" value={ins.maxChurn != null && Number.isFinite(ins.maxChurn) ? `${pctS(ins.maxChurn / 100)}/mnd` : "—"} />
                  : <StatBox label="Min. orders (3:1)" value={ins.minOrders != null ? `${numS(ins.minOrders, 1)}×` : "—"} sub="per klant" />}
              </div>
            </div>

          </div>

          {/* Eenmalig vs abonnement */}
          <div className="card-soft p-5">
            <div className="flex items-center gap-2 mb-1"><ArrowLeftRight className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">Eenmalig vs. abonnement</h3></div>
            <p className="text-[11px] text-muted-foreground mb-4">zelfde product · beide modellen naast elkaar</p>
            <div className="grid grid-cols-2 gap-3">
              {([["Eenmalig", ins.singleLtv, ins.singleRatio, ins.singleRatio >= ins.subRatio], ["Abonnement", ins.subLtv, ins.subRatio, ins.subRatio > ins.singleRatio]] as const).map(([title, ltv, ratio, win]) => (
                <div key={title} className="rounded-xl p-4 border" style={win ? { borderColor: "hsl(var(--ok) / 0.4)", background: "hsl(var(--ok) / 0.05)" } : { borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.3)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    {win && <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "hsl(var(--ok))" }}>beter</span>}
                  </div>
                  <p className="text-2xl font-num font-bold tabular-nums mt-2" style={{ color: `hsl(var(--${ratio >= 3 ? "ok" : ratio >= 1.5 ? "warn" : "bad"}))` }}>{Number.isFinite(ratio) ? `${numS(ratio, 1)}×` : "∞"}</p>
                  <p className="text-[11px] text-muted-foreground">LTV:CAC · LTV {eur(ltv)}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── pieces ─────────────────────────────────────────────────────────────── */

function Tip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" tabIndex={-1} className="inline-grid place-items-center text-muted-foreground/45 hover:text-muted-foreground align-middle"><HelpCircle className="h-3.5 w-3.5" /></button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[230px] text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function Section({ icon: Icon, title, accent, children }: { icon: React.ElementType; title: string; accent: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0" style={{ background: `hsl(var(--${accent}) / 0.12)` }}><Icon className="h-4 w-4" style={{ color: `hsl(var(--${accent}))` }} /></span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </motion.div>
  );
}

function Field({ label, value, onChange, unit, step = 0.01, info }: { label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; info?: string }) {
  const isEuro = unit === "€";
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">{label}{info && <Tip text={info} />}</span>
      <div className="mt-1 relative">
        {isEuro && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>}
        <input type="number" step={step} inputMode="decimal" value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full h-9 rounded-lg border border-border bg-card text-sm text-foreground text-right tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 ${isEuro ? "pl-6 pr-2.5" : "pl-2.5 pr-8"}`} />
        {!isEuro && unit && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{unit}</span>}
      </div>
    </label>
  );
}

function StatBox({ label, value, sub, info }: { label: string; value: string; sub?: string; info?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">{label}{info && <Tip text={info} />}</p>
      <p className="text-[15px] font-semibold text-foreground tabular-nums mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = Number.isFinite(value) ? Math.max(2, (value / max) * 100) : 100;
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="text-[11px] font-medium text-muted-foreground w-8 shrink-0">{label}</span>
      <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden">
        <div className="h-full rounded-md transition-all duration-300" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-foreground tabular-nums w-16 text-right">{eur(value)}</span>
    </div>
  );
}


function Health({ ok, warn, label, actual }: { ok: boolean; warn?: boolean; label: string; actual: string }) {
  const v = ok ? "ok" : warn ? "warn" : "bad";
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(var(--${v}))` }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: `hsl(var(--${v}))` }}>{actual}</span>
    </div>
  );
}
