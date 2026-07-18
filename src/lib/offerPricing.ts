// Supplement pricing for offers — units, grams, dosing and subscription options,
// used to compute a normalized price-per-day so offers can be compared fairly.
// Stored client-side keyed by offer id (the offers table has no columns for this).
import { useEffect, useState } from "react";

export type SubOption = { label: string; price: number };
export type OfferPricing = {
  usesSub?: boolean;     // false = enkel single buy (geen abonnement) — default abonnement
  units?: number;        // aantal stuks (chews per pack)
  gramsPerUnit?: number; // gram per stuk
  unitsPerDay?: number;  // dosering — stuks per dag (default 1)
  subOptions?: SubOption[]; // verschillende abonnement-opties (prijs per levering)
};

const LS = "gb_offer_pricing";
const EV = "gb:offerpricing";
function all(): Record<string, OfferPricing> { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } }
export function getPricing(id: string): OfferPricing { return all()[id] ?? {}; }
export function setPricing(id: string, p: OfferPricing) {
  const m = all(); m[id] = { ...(m[id] ?? {}), ...p };
  try { localStorage.setItem(LS, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function usePricing(id: string): OfferPricing {
  const [p, setP] = useState<OfferPricing>(() => getPricing(id));
  useEffect(() => { const on = () => setP(getPricing(id)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [id]);
  return p;
}
export function useAllPricing(): Record<string, OfferPricing> {
  const [m, setM] = useState<Record<string, OfferPricing>>(all);
  useEffect(() => { const on = () => setM(all()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, []);
  return m;
}

/* ─── computed metrics ───────────────────────────────────────────────────── */
/** how many days one pack lasts (units ÷ dose per day) */
export const supplyDays = (p: OfferPricing): number => { const u = p.units ?? 0, d = p.unitsPerDay || 1; return d > 0 ? u / d : 0; };
/** price per day for a given total pack price */
export const perDay = (total: number | null | undefined, p: OfferPricing): number => { const d = supplyDays(p); return d > 0 && total ? total / d : 0; };
/** price for a 90-day supply at that price-per-day */
export const per90 = (total: number | null | undefined, p: OfferPricing): number => perDay(total, p) * 90;
/** price per single piece (single buy price ÷ units) — the key metric when there's no subscription */
export const perUnit = (total: number | null | undefined, p: OfferPricing): number => { const u = p.units ?? 0; return u > 0 && total ? total / u : 0; };
/** does this offer use a subscription model? (default yes, unless explicitly turned off) */
export const usesSubscription = (p: OfferPricing): boolean => p.usesSub !== false;
/** the cheapest-per-day subscription option (best value) */
export const bestSub = (p: OfferPricing): SubOption | undefined => {
  const opts = (p.subOptions ?? []).filter((o) => o.price > 0);
  if (!opts.length) return undefined;
  return opts.reduce((a, b) => (perDay(b.price, p) < perDay(a.price, p) ? b : a));
};
