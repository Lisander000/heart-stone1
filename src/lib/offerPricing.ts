// Supplement pricing per offer. At creation you pick a model — single buy or a
// subscription — and each has its own price fields. Everything is stored client-side
// keyed by offer id (the offers table has no columns for this).
import { useEffect, useState } from "react";

export type OfferModel = "single" | "subscription";

export type OfferPricing = {
  model?: OfferModel;        // "single" | "subscription" (default single)
  gramsPerUnit?: number;     // gram per stuk
  perDay?: number;           // aantal per dag (dosering)
  // ── single buy ──
  total?: number;            // prijs totaal
  units?: number;            // aantal stuks in de verpakking
  bundleDiscount?: number;   // korting bij bundel (%)
  // ── subscription (duration-priced tiers) ──
  price30?: number;          // abonnement prijs per 30 dagen
  price90?: number;          // abonnement prijs per 90 dagen
  price180?: number;         // abonnement prijs per 180 dagen
  // single buy referentieprijzen per periode (geen berekening, enkel ter vergelijking)
  singleRef30?: number;
  singleRef90?: number;
  singleRef180?: number;
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

export const isSub = (p: OfferPricing): boolean => p.model === "subscription";

/* ─── single buy ─────────────────────────────────────────────────────────── */
/** how many days a single-buy pack lasts (stuks ÷ per dag) */
export const singleDays = (p: OfferPricing): number => { const u = p.units ?? 0, d = p.perDay || 1; return d > 0 ? u / d : 0; };
/** single-buy price per day (totaal ÷ dagen) */
export const singleDayPrice = (p: OfferPricing): number => { const days = singleDays(p); return days > 0 && p.total ? p.total / days : 0; };
/** single-buy price per day after bundle discount */
export const singleDayPriceBundle = (p: OfferPricing): number => singleDayPrice(p) * (1 - (p.bundleDiscount ?? 0) / 100);
/** single-buy price per piece (totaal ÷ stuks) */
export const singlePerUnit = (p: OfferPricing): number => { const u = p.units ?? 0; return u > 0 && p.total ? p.total / u : 0; };

/* ─── subscription (duration tiers) ──────────────────────────────────────── */
export const SUB_TIERS = [
  { days: 30, key: "price30" as const, label: "30 dagen" },
  { days: 90, key: "price90" as const, label: "90 dagen" },
  { days: 180, key: "price180" as const, label: "180 dagen" },
];
/** price per day for a tier (tierprijs ÷ tierdagen) */
export const tierDayPrice = (price: number | null | undefined, days: number): number => (days > 0 && price ? price / days : 0);
/** best (cheapest) subscription price per day across the tiers */
export const subBestDayPrice = (p: OfferPricing): number => {
  const vals = SUB_TIERS.map((t) => tierDayPrice(p[t.key], t.days)).filter((v) => v > 0);
  return vals.length ? Math.min(...vals) : 0;
};

/** the comparable price per day for either model */
export const dayPrice = (p: OfferPricing): number => (isSub(p) ? subBestDayPrice(p) : singleDayPrice(p));
/** the representative total to mirror into offers.price (for the DB / card headline) */
export const headlinePrice = (p: OfferPricing): number | null => {
  if (isSub(p)) return p.price90 ?? p.price30 ?? p.price180 ?? p.singleRef90 ?? null;
  return p.total ?? null;
};
