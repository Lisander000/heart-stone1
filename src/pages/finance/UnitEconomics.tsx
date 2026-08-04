import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calculator, RotateCcw, ShoppingBag, Repeat, HelpCircle, TrendingDown,
  CheckCircle2, AlertTriangle, XCircle, Package, Truck, Megaphone, Receipt,
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

  // overall verdict
  const healthy = m.profit >= 0 && m.ltvCac >= 3 && o.cmPct >= 0.35;
  const okay = m.profit >= 0 && m.ltvCac >= 1.5;
  const vTone = healthy ? "ok" : okay ? "warn" : "bad";
  const VIcon = healthy ? CheckCircle2 : okay ? AlertTriangle : XCircle;
  const vTitle = healthy ? "Gezonde unit economics" : okay ? "Krappe marges — kan beter" : (m.profit < 0 ? "Verlieslatend per klant" : "Te lage marge");

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

          {/* ── Results (sticky) ── */}
          <div className="space-y-4 lg:sticky lg:top-6">
            {/* verdict */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl border p-4 flex items-start gap-3"
              style={{ background: `hsl(var(--${vTone}) / 0.08)`, borderColor: `hsl(var(--${vTone}) / 0.3)` }}>
              <VIcon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: `hsl(var(--${vTone}))` }} />
              <div className="min-w-0">
                <p className="font-semibold text-foreground leading-tight">{vTitle}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {Number.isFinite(m.profit)
                    ? <>{eur(m.profit)} winst per klant · LTV:CAC {numS(m.ltvCac, 1)}× · marge {pctS(o.cmPct)}</>
                    : <>Marge {pctS(o.cmPct)} — vul CAC/churn in voor het volledige plaatje</>}
                </p>
              </div>
            </motion.div>

            {/* hero KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <Kpi big label={`Contributiemarge / ${perOrderLabel}`} value={eur(o.cm)} sub={pctS(o.cmPct)} tone={cmTone as Tone}
                info="Wat er per order overblijft na álle variabele kosten (COGS, verzending, fees, retouren). Dít betaalt je marketing en vaste kosten." />
              <Kpi label={mode === "subscription" ? "LTV (levenslang)" : "LTV / klant"} value={eur(m.ltv)} accent="hsl(var(--info))"
                info="Lifetime Value: totale contributiemarge die één klant over zijn hele leven oplevert." />
              <Kpi label="LTV : CAC" value={Number.isFinite(m.ltvCac) ? `${numS(m.ltvCac, 1)}×` : "∞"} tone={ratioTone as Tone}
                info="Verhouding tussen wat een klant opbrengt en wat hij kost om te werven. Gezond = 3× of meer." />
              <Kpi label="Winst per klant" value={eur(m.profit)} tone={(m.profit >= 0 ? "ok" : "bad") as Tone}
                info="LTV minus CAC — de netto winst die één nieuwe klant je uiteindelijk oplevert." />
            </div>

            {/* LTV vs CAC visual */}
            <div className="card-soft p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-foreground">LTV vs. CAC</h3>
                <span className="text-xs font-semibold" style={{ color: `hsl(var(--${ratioTone}))` }}>{Number.isFinite(m.ltvCac) ? `${numS(m.ltvCac, 1)}×` : "∞"}</span>
              </div>
              <MiniBar label="LTV" value={m.ltv} max={ltvCacMax} color="hsl(var(--info))" />
              <MiniBar label="CAC" value={i.cac} max={ltvCacMax} color="hsl(var(--muted-foreground))" />
            </div>

            {/* cost breakdown */}
            <div className="card-soft p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Waar gaat elke euro naartoe?</h3>
                <span className="text-xs text-muted-foreground">van {eur(o.netRevenue)} netto omzet</span>
              </div>
              <div className="flex h-4 w-full rounded-full overflow-hidden bg-muted">
                {segs.map((s) => (
                  <div key={s.label} title={`${s.label}: ${eur(s.value)}`} style={{ width: `${(s.value / segTotal) * 100}%`, background: `hsl(var(--${s.v}))` }} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {segs.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="rounded-sm shrink-0" style={{ background: `hsl(var(--${s.v}))`, width: 9, height: 9 }} />
                    <span className="text-muted-foreground flex-1 truncate">{s.label}</span>
                    <span className="font-medium text-foreground tabular-nums">{eur(s.value)}</span>
                    <span className="text-muted-foreground tabular-nums w-10 text-right">{pctS(s.value / segTotal)}</span>
                  </div>
                ))}
              </div>
              {o.cm < 0 && <p className="mt-3 text-xs text-bad flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Negatieve marge — je verliest geld op elke order, nog vóór acquisitie.</p>}
            </div>

            {/* secondary + health, side by side on wider screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-soft p-4 space-y-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kerncijfers</h3>
                <Row label="Brutomarge" value={`${pctS(o.grossPct)}`} sub={eur(o.grossMargin)} />
                <Row label="Netto omzet / order" value={eur(o.netRevenue)} />
                <Row label="Variabele kosten" value={eur(o.variableCosts)} />
                <Row label={<>Break-even ROAS <Tip text="De minimale ROAS (omzet ÷ ad spend) om quitte te spelen = 1 ÷ contributiemarge%." /></>} value={Number.isFinite(m.breakEvenRoas) ? `${numS(m.breakEvenRoas, 2)}×` : "—"} />
                {mode === "subscription" ? (
                  <>
                    <Row label="Terugverdientijd" value={Number.isFinite(m.paybackMonths) ? `${numS(m.paybackMonths, 1)} mnd` : "—"} />
                    <Row label="Gem. levensduur" value={Number.isFinite(m.lifetimeMonths) ? `${numS(m.lifetimeMonths, 1)} mnd` : "∞"} />
                    <Row label="Marge / maand" value={eur(m.mrrCm)} sub={`${numS(m.deliveriesPerMonth, 2)} lev./mnd`} />
                  </>
                ) : (
                  <Row label="Terugverdientijd" value={Number.isFinite(m.paybackOrders) ? `${numS(m.paybackOrders, 1)} orders` : "—"} />
                )}
              </div>

              <div className="card-soft p-4 space-y-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gezondheid</h3>
                <Health ok={o.cmPct >= 0.35} warn={o.cmPct >= 0.2 && o.cmPct < 0.35} label="Contributiemarge ≥ 35%" actual={pctS(o.cmPct)} />
                <Health ok={m.ltvCac >= 3} warn={m.ltvCac >= 1.5 && m.ltvCac < 3} label="LTV : CAC ≥ 3×" actual={Number.isFinite(m.ltvCac) ? `${numS(m.ltvCac, 1)}×` : "∞"} />
                <Health ok={m.profit >= 0} label="Winstgevend per klant" actual={eur(m.profit)} />
                {mode === "subscription"
                  ? <Health ok={Number.isFinite(m.paybackMonths) && m.paybackMonths <= 6} warn={Number.isFinite(m.paybackMonths) && m.paybackMonths > 6 && m.paybackMonths <= 12} label="Payback ≤ 6 mnd" actual={Number.isFinite(m.paybackMonths) ? `${numS(m.paybackMonths, 1)} mnd` : "—"} />
                  : <Health ok={o.grossPct >= 0.6} warn={o.grossPct >= 0.4 && o.grossPct < 0.6} label="Brutomarge ≥ 60%" actual={pctS(o.grossPct)} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── pieces ─────────────────────────────────────────────────────────────── */
type Tone = "ok" | "bad" | "warn";

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

function Kpi({ label, value, sub, tone, accent, big, info }: { label: string; value: string; sub?: string; tone?: Tone; accent?: string; big?: boolean; info?: string }) {
  const color = tone ? `hsl(var(--${tone}))` : accent ?? "hsl(var(--foreground))";
  return (
    <div className={`card-soft p-4 ${big ? "col-span-2" : ""}`}>
      <p className="text-xs text-muted-foreground flex items-center gap-1">{label}{info && <Tip text={info} />}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="font-num font-bold leading-none tabular-nums" style={{ color, fontSize: big ? "2.25rem" : "1.5rem" }}>{value}</p>
        {sub && <span className="text-sm font-semibold mb-1" style={{ color }}>{sub}</span>}
      </div>
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

function Row({ label, value, sub }: { label: React.ReactNode; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1">{label}</span>
      <span className="text-[13px] font-semibold text-foreground tabular-nums text-right">{value}{sub && <span className="text-[11px] font-normal text-muted-foreground ml-1">{sub}</span>}</span>
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
