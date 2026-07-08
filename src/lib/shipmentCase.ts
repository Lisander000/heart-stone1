// Shipment issue-handling case — everything a CS rep needs to resolve a shipping
// problem end to end: status, auto-computed phase/SLA, solutions with cost, customer
// communication, internal notes, ownership and resolution. Schema-independent
// (stored client-side, keyed by shipment id), mirroring the returns case layer.
import { useEffect, useState } from "react";

export const EV = "gb:shipmentcase";
const fire = () => { try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ } };
const DAY = 86_400_000;

/* ─── generic keyed stores ───────────────────────────────────────────────── */
function readMap<T>(key: string): Record<string, T> { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } }
function writeMap<T>(key: string, m: Record<string, T>) { try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ } fire(); }
function useKeyed<T>(key: string, id: string, fallback: T): T {
  const read = () => (readMap<T>(key)[id] ?? fallback);
  const [v, setV] = useState<T>(read);
  useEffect(() => { const on = () => setV(read()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); /* eslint-disable-next-line */ }, [id]);
  return v;
}
export function useAllKeyed<T>(key: string): Record<string, T> {
  const [v, setV] = useState<Record<string, T>>(() => readMap<T>(key));
  useEffect(() => { const on = () => setV(readMap<T>(key)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); /* eslint-disable-next-line */ }, []);
  return v;
}

export type Actor = { by?: string | null; byName?: string };
const who = (a?: Actor) => a?.byName || a?.by || "Onbekend";

/* ─── status (section 2) ─────────────────────────────────────────────────── */
export type ShipStatus = "info_received" | "in_transit" | "no_movement" | "returned_to_sender" | "lost" | "delivered_disputed" | "resolved";
export const SHIP_STATUSES: { id: ShipStatus; label: string; tone: string; desc: string }[] = [
  { id: "info_received", label: "Info ontvangen", tone: "muted", desc: "Label aangemaakt — pakket nog niet opgehaald." },
  { id: "in_transit", label: "Onderweg", tone: "info", desc: "Onderweg naar de klant." },
  { id: "no_movement", label: "Geen beweging", tone: "warn", desc: "Tracking staat al even stil." },
  { id: "returned_to_sender", label: "Retour afzender", tone: "ember", desc: "Pakket keert naar ons terug." },
  { id: "lost", label: "Verloren", tone: "bad", desc: "Kwijt in transit." },
  { id: "delivered_disputed", label: "Geleverd — betwist", tone: "bad", desc: "Tracking zegt geleverd, klant betwist ontvangst." },
  { id: "resolved", label: "Opgelost", tone: "ok", desc: "Case afgesloten." },
];
export const statusMeta = (s: string) => SHIP_STATUSES.find((x) => x.id === s) ?? { id: s as ShipStatus, label: s || "—", tone: "muted", desc: "" };
export const toneColor = (t: string) => ({ ok: "hsl(var(--ok))", sun: "hsl(var(--sun))", ember: "hsl(var(--ember))", bad: "hsl(var(--bad))", info: "hsl(var(--info))", warn: "hsl(var(--warn))", grape: "hsl(var(--grape))" } as Record<string, string>)[t] ?? "hsl(var(--muted-foreground))";

/* ─── phase / severity (section 3) — auto-computed ───────────────────────── */
export type Phase = { level: 0 | 1 | 2 | 3; label: string; sla: string; tone: string; reason: string; daysLate: number };
export function daysLate(expectedISO?: string | null, status?: string): number {
  if (!expectedISO || status === "resolved") return 0;
  const d = Math.floor((Date.now() - new Date(expectedISO).getTime()) / DAY);
  return d > 0 ? d : 0;
}
const PHASE_META: Record<number, { label: string; sla: string; tone: string }> = {
  0: { label: "Op schema", sla: "geen urgentie", tone: "ok" },
  1: { label: "Lichte vertraging", sla: "reageer binnen 24 u", tone: "sun" },
  2: { label: "Serieuze vertraging", sla: "reageer binnen 8 u", tone: "ember" },
  3: { label: "Kritiek", sla: "reageer binnen enkele uren", tone: "bad" },
};
/** Phase = the most severe of (days late) and (status type), so a lost/returned/disputed
    parcel or a chargeback threat escalates immediately regardless of the day count. */
export function computePhase(opts: { expected?: string | null; status: string; chargeback?: boolean }): Phase {
  const d = daysLate(opts.expected, opts.status);
  const byDays = d >= 14 ? 3 : d >= 7 ? 2 : d >= 3 ? 1 : 0;
  const byStatus = ["lost", "returned_to_sender", "delivered_disputed"].includes(opts.status) ? 3 : opts.status === "no_movement" ? 2 : 0;
  let level = Math.max(byDays, byStatus, opts.chargeback ? 3 : 0) as 0 | 1 | 2 | 3;
  if (opts.status === "resolved") level = 0;
  const m = PHASE_META[level];
  const reason = opts.chargeback && level === 3 ? "chargeback gedreigd"
    : byStatus >= byDays && byStatus > 0 ? statusMeta(opts.status).label.toLowerCase()
    : d > 0 ? `${d} dag${d === 1 ? "" : "en"} te laat` : "binnen verwachte levertijd";
  return { level, label: m.label, sla: m.sla, tone: m.tone, reason, daysLate: d };
}

/* ─── carrier transit estimate → expected delivery (section 2, from tracking) */
const CARRIER_DAYS: Record<string, number> = { bpost: 2, dpd: 2, postnl: 2, gls: 2, dhl: 3, ups: 3, colissimo: 3, mondial: 3 };
export function estimateExpected(shippedAt?: string | null, carrier?: string | null): string | null {
  if (!shippedAt) return null;
  const k = Object.keys(CARRIER_DAYS).find((x) => (carrier || "").toLowerCase().includes(x));
  return new Date(new Date(shippedAt).getTime() + (k ? CARRIER_DAYS[k] : 3) * DAY).toISOString();
}

/* ─── solutions (section 4) — cost, resolution outcome, ready-to-send email ── */
export type TplCtx = { name?: string; product?: string; tracking?: string; carrier?: string };
const firstName = (n?: string) => (n || "daar").split(" ")[0];
const SIGN = "\n\nWarme groet,\nHet Gooodboys-team";
export type SolutionId = "follow_up" | "expedite" | "partial_refund" | "full_refund" | "store_credit";
const COGS_RATIO = 0.35; // assumed product cost as share of order value
export type Solution = { id: SolutionId; label: string; desc: string; spoed?: boolean; recommendSub?: boolean; outcome: string; cost: (orderTotal: number, shipping: number) => number; email: (c: TplCtx) => string };
export const SOLUTIONS: Solution[] = [
  { id: "follow_up", label: "Follow-up bij carrier", desc: "Carrier contacteren en de klant geruststellen — nog geen kost.", outcome: "Opgelost door carrier", cost: () => 0,
    email: (c) => `Hoi ${firstName(c.name)},\n\nBedankt voor je geduld! We hebben ${c.carrier || "de vervoerder"} gecontacteerd over je pakket${c.tracking ? ` (${c.tracking})` : ""} en volgen het van dichtbij op. Zodra het weer beweegt of geleverd is, laten we je meteen iets weten. Nogmaals sorry voor het wachten — je goodboy verdient beter. 🐾${SIGN}` },
  { id: "expedite", label: "Spoedzending", spoed: true, recommendSub: true, desc: "Meteen een nieuw pakket met express-levering.", outcome: "Herverzonden (spoed)", cost: (t, s) => t * COGS_RATIO + s * 2,
    email: (c) => `Hoi ${firstName(c.name)},\n\nWe laten je niet langer wachten: we sturen vandaag nog met spoed een nieuw pakket met je bestelling — express en zonder extra kosten. Je ontvangt binnenkort een nieuwe tracking. Bedankt voor je vertrouwen! 🐾${SIGN}` },
  { id: "partial_refund", label: "Gedeeltelijke refund (verzendkosten)", desc: "Verzendkosten terug als compensatie, de klant houdt de levering.", outcome: "Gedeeltelijk gerefund", cost: (_t, s) => s,
    email: (c) => `Hoi ${firstName(c.name)},\n\nWat vervelend dat je levering niet vlot verliep. Als excuus betaalden we de verzendkosten volledig terug — die staan binnen enkele werkdagen terug op je rekening. Je mag je bestelling gewoon houden. Bedankt voor je begrip! 🐾${SIGN}` },
  { id: "full_refund", label: "Volledige refund", desc: "Laatste optie — je verliest de klant.", outcome: "Gerefund", cost: (t) => t,
    email: (c) => `Hoi ${firstName(c.name)},\n\nOnze oprechte excuses dat je bestelling niet goed is aangekomen. We hebben het volledige bedrag terugbetaald — dit staat binnen enkele werkdagen terug op je rekening. Mogen we het ooit goedmaken met een nieuwe bestelling? 🐾${SIGN}` },
  { id: "store_credit", label: "Store credit / korting volgende levering", desc: "Goodwill om de abonnee te behouden.", outcome: "Store credit gegeven", cost: (t) => Math.round(t * 0.15),
    email: (c) => `Hoi ${firstName(c.name)},\n\nBedankt voor je geduld met deze vervelende verzending. Als goedmakertje zetten we een tegoed op je account dat je bij je volgende levering kunt gebruiken. We zorgen dat het de volgende keer vlekkeloos verloopt! 🐾${SIGN}` },
];
export const solutionMeta = (id?: string | null) => SOLUTIONS.find((s) => s.id === id);
export const SHIP_OUTCOMES = ["Herverzonden (spoed)", "Gedeeltelijk gerefund", "Gerefund", "Store credit gegeven", "Opgelost door carrier", "Klant tevreden"];

/* ─── communication templates (section 5) ────────────────────────────────── */
export const TEMPLATES: { id: string; label: string; body: (c: TplCtx) => string }[] = [
  { id: "delay", label: "Vertraging — geruststellen", body: (c) => `Hoi ${firstName(c.name)},\n\nBedankt voor je geduld! We zien dat je ${c.product || "bestelling"} wat langer onderweg is dan gehoopt. We houden het pakket bij ${c.carrier || "de vervoerder"} in de gaten en laten je meteen iets weten zodra het beweegt. Sorry voor het wachten — je goodboy verdient beter. 🐾\n\nWarme groet,\nGooodboys` },
  { id: "reship", label: "Herverzending bevestigen", body: (c) => `Hoi ${firstName(c.name)},\n\nWe sturen vandaag nog een nieuw pakket met je ${c.product || "bestelling"} — geen kosten, geen gedoe. Je krijgt zo een nieuwe tracking. Bedankt voor je vertrouwen! 🐾\n\nWarme groet,\nGooodboys` },
  { id: "lost", label: "Verloren — excuses + oplossing", body: (c) => `Hoi ${firstName(c.name)},\n\nHet lijkt erop dat je pakket onderweg is zoekgeraakt — wat ontzettend vervelend. We lossen dit meteen voor je op met een gratis nieuwe zending. Je hoeft niks te doen. Nogmaals sorry voor het ongemak! 🐾\n\nWarme groet,\nGooodboys` },
  { id: "disputed", label: "Geleverd maar niet ontvangen", body: (c) => `Hoi ${firstName(c.name)},\n\nDe tracking van ${c.carrier || "de vervoerder"} toont je pakket als geleverd, maar we begrijpen dat je het niet hebt ontvangen. Kun je even checken bij buren of op een veilige plek rond je woning? We starten intussen een onderzoek bij de carrier en zorgen sowieso dat het goedkomt. 🐾\n\nWarme groet,\nGooodboys` },
];

/* ─── ownership (all sections) ───────────────────────────────────────────── */
export type ShipOwner = { email: string; name: string; at: string };
const OWN = "gb_shipment_owner";
export const getShipOwner = (id: string): ShipOwner | null => readMap<ShipOwner>(OWN)[id] ?? null;
export function setShipOwner(id: string, o: { email: string; name: string }) { const m = readMap<ShipOwner>(OWN); m[id] = { email: o.email, name: o.name, at: new Date().toISOString() }; writeMap(OWN, m); }
export function clearShipOwner(id: string) { const m = readMap<ShipOwner>(OWN); delete m[id]; writeMap(OWN, m); }
export const useShipOwner = (id: string) => useKeyed<ShipOwner | null>(OWN, id, null);

/* ─── audit log (section 6 trail) ────────────────────────────────────────── */
export type ShipLogKind = "status" | "phase" | "solution" | "owner" | "resolution" | "comm";
export type ShipLog = { text: string; at: string; kind: ShipLogKind; by?: string | null; byName?: string };
const LOG = "gb_shipment_log";
export function addShipLog(id: string, text: string, kind: ShipLogKind, actor?: Actor) { const m = readMap<ShipLog[]>(LOG); m[id] = [{ text, at: new Date().toISOString(), kind, by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(LOG, m); }
export const useShipLog = (id: string) => useKeyed<ShipLog[]>(LOG, id, []);

/* ─── internal notes (section 5) ─────────────────────────────────────────── */
export type ShipNote = { text: string; at: string; by?: string | null; byName?: string };
const NOTES = "gb_shipment_notes";
export function addShipNote(id: string, text: string, actor?: Actor) { const m = readMap<ShipNote[]>(NOTES); m[id] = [{ text: text.trim(), at: new Date().toISOString(), by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(NOTES, m); }
export function removeShipNote(id: string, at: string) { const m = readMap<ShipNote[]>(NOTES); m[id] = (m[id] ?? []).filter((n) => n.at !== at); writeMap(NOTES, m); }
export const useShipNotes = (id: string) => useKeyed<ShipNote[]>(NOTES, id, []);

/* ─── customer communication log (section 5) ─────────────────────────────── */
export type CommDir = "out" | "in";
export type ShipComm = { text: string; at: string; dir: CommDir; channel: string; by?: string | null; byName?: string };
const COMMS = "gb_shipment_comms";
export function addShipComm(id: string, c: { text: string; dir: CommDir; channel: string }, actor?: Actor) { const m = readMap<ShipComm[]>(COMMS); m[id] = [{ text: c.text.trim(), at: new Date().toISOString(), dir: c.dir, channel: c.channel, by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(COMMS, m); }
export const useShipComms = (id: string) => useKeyed<ShipComm[]>(COMMS, id, []);

/* ─── case meta — context + resolution (sections 1, 2, 4, 6) ─────────────── */
export type ShipMeta = {
  // section 1 — context
  shippingAddress?: string;
  isSubscription?: boolean;
  deliveryNumber?: number;   // Nth subscription delivery
  priorIssues?: number;      // earlier issues for this customer
  customerSince?: string;    // loyalty
  // section 2 — dates the record may not hold
  orderedAt?: string;
  expectedDelivery?: string;
  // section 3
  chargebackThreat?: boolean;
  // section 4
  solution?: SolutionId;
  solutionStartedAt?: string;
  shippingCost?: number;     // assumed shipping cost for cost estimates
  // section 6
  resolvedAt?: string;
  outcome?: string;          // e.g. "Herverzonden", "Gerefund", "Opgelost door carrier"
};
const META = "gb_shipment_meta";
export const getShipMeta = (id: string): ShipMeta => readMap<ShipMeta>(META)[id] ?? {};
export function setShipMeta(id: string, patch: ShipMeta) { const m = readMap<ShipMeta>(META); m[id] = { ...(m[id] ?? {}), ...patch }; writeMap(META, m); }
export const useShipMeta = (id: string) => useKeyed<ShipMeta>(META, id, {});
export const useAllShipMeta = () => useAllKeyed<ShipMeta>(META);
