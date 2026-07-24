// Product-health case — everything ops needs to investigate and fix a product whose
// signals (stock, return rate, review score) are slipping: auto-computed severity,
// per-metric signals, remediation actions with a ready-to-copy message, internal
// notes, ownership and resolution. Stored client-side, keyed by product-health id,
// mirroring the returns/shipment/ticket case layers.
import { useEffect, useState } from "react";

export const EV = "gb:phcase";
const fire = () => { try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ } };

/* ─── generic keyed stores ───────────────────────────────────────────────── */
function readMap<T>(key: string): Record<string, T> { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } }
function writeMap<T>(key: string, m: Record<string, T>) { try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ } fire(); }
function useKeyed<T>(key: string, id: string, fallback: T): T {
  const read = () => (readMap<T>(key)[id] ?? fallback);
  const [v, setV] = useState<T>(read);
  useEffect(() => { const on = () => setV(read()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); /* eslint-disable-next-line */ }, [id]);
  return v;
}

export type Actor = { by?: string | null; byName?: string };
export const toneColor = (t: string) => ({ ok: "hsl(var(--ok))", sun: "hsl(var(--sun))", ember: "hsl(var(--ember))", bad: "hsl(var(--bad))", info: "hsl(var(--info))", warn: "hsl(var(--warn))", grape: "hsl(var(--grape))" } as Record<string, string>)[t] ?? "hsl(var(--muted-foreground))";

/* ─── status ─────────────────────────────────────────────────────────────── */
export type HealthStatus = "healthy" | "watch" | "at_risk" | "issue" | "critical" | "resolved";
export const HEALTH_STATUSES: { id: HealthStatus; label: string; tone: string; desc: string }[] = [
  { id: "healthy", label: "Gezond", tone: "ok", desc: "Alle signalen op norm." },
  { id: "watch", label: "In de gaten", tone: "sun", desc: "Eén signaal begint te zakken." },
  { id: "at_risk", label: "Risico", tone: "ember", desc: "Meerdere signalen onder de norm." },
  { id: "issue", label: "Probleem", tone: "bad", desc: "Actief kwaliteits- of voorraadprobleem." },
  { id: "critical", label: "Kritiek", tone: "bad", desc: "Ernstig — ingrijpen nodig." },
  { id: "resolved", label: "Opgelost", tone: "ok", desc: "Terug gezond — case afgesloten." },
];
export const statusMeta = (s: string) => HEALTH_STATUSES.find((x) => x.id === s) ?? { id: s as HealthStatus, label: s || "—", tone: "muted", desc: "" };

/* ─── per-metric signals — evaluated against thresholds ──────────────────── */
export type Signal = { tone: string; label: string; level: 0 | 1 | 2 | 3 };
export function stockSignal(stock?: number | null): Signal {
  const v = Number(stock ?? 0);
  if (v <= 0) return { tone: "bad", label: "Uitverkocht", level: 3 };
  if (v < 20) return { tone: "ember", label: "Lage voorraad", level: 2 };
  if (v < 50) return { tone: "sun", label: "Krap", level: 1 };
  return { tone: "ok", label: "Op voorraad", level: 0 };
}
export function returnSignal(rate?: number | null): Signal {
  const v = Number(rate ?? 0);
  if (v >= 15) return { tone: "bad", label: "Zeer hoog", level: 3 };
  if (v >= 10) return { tone: "ember", label: "Hoog", level: 2 };
  if (v >= 5) return { tone: "sun", label: "Verhoogd", level: 1 };
  return { tone: "ok", label: "Normaal", level: 0 };
}
export function reviewSignal(score?: number | null): Signal {
  const v = Number(score ?? 0);
  if (v <= 0) return { tone: "muted", label: "Geen data", level: 0 };
  if (v < 3) return { tone: "bad", label: "Slecht", level: 3 };
  if (v < 3.8) return { tone: "ember", label: "Matig", level: 2 };
  if (v < 4.2) return { tone: "sun", label: "Redelijk", level: 1 };
  return { tone: "ok", label: "Sterk", level: 0 };
}

/* ─── severity — auto-computed, the most severe signal wins ──────────────── */
export type Severity = { level: 0 | 1 | 2 | 3; label: string; tone: string; reason: string; sla: string };
const SEV_META: Record<number, { label: string; tone: string; sla: string }> = {
  0: { label: "Gezond", tone: "ok", sla: "geen actie nodig" },
  1: { label: "In de gaten houden", tone: "sun", sla: "review deze week" },
  2: { label: "Risico", tone: "ember", sla: "plan actie binnen enkele dagen" },
  3: { label: "Kritiek", tone: "bad", sla: "ingrijpen nu" },
};
const statusLevel = (s: string) => (s === "critical" || s === "issue" ? 3 : s === "at_risk" ? 2 : s === "watch" ? 1 : 0);
export function computeSeverity(opts: { status: string; returnRate?: number | null; reviewScore?: number | null; stock?: number | null }): Severity {
  if (opts.status === "resolved") return { level: 0, ...SEV_META[0], reason: "opgelost" };
  const sigs = [
    { s: statusLevel(opts.status), why: `status ${statusMeta(opts.status).label.toLowerCase()}` },
    { s: returnSignal(opts.returnRate).level, why: `retour-ratio ${returnSignal(opts.returnRate).label.toLowerCase()}` },
    { s: reviewSignal(opts.reviewScore).level, why: `reviews ${reviewSignal(opts.reviewScore).label.toLowerCase()}` },
    { s: stockSignal(opts.stock).level, why: stockSignal(opts.stock).label.toLowerCase() },
  ];
  const top = sigs.reduce((a, b) => (b.s > a.s ? b : a), sigs[0]);
  const level = top.s as 0 | 1 | 2 | 3;
  const m = SEV_META[level];
  return { level, label: m.label, tone: m.tone, sla: m.sla, reason: level === 0 ? "alle signalen goed" : top.why };
}

/* ─── remediation actions — with a ready-to-copy supplier/internal message ── */
export type ActionId = "restock" | "supplier_qa" | "review_outreach" | "reformulate" | "pause_sales";
export type PHAction = { id: ActionId; label: string; desc: string; impact: string; urgent?: boolean; outcome: string; message: (c: { product?: string; sku?: string }) => string };
export const ACTIONS: PHAction[] = [
  { id: "restock", label: "Voorraad bijbestellen", desc: "Purchase order naar de leverancier om de voorraad aan te vullen.", impact: "Voorkomt gemiste verkoop", outcome: "Voorraad aangevuld",
    message: (c) => `Onderwerp: Nabestelling ${c.product || "product"}${c.sku ? ` (${c.sku})` : ""}\n\nBeste,\n\nGraag een nieuwe productie/levering inplannen voor ${c.product || "dit product"} — de voorraad is (bijna) uitgeput en we willen een verkooponderbreking vermijden. Kunnen jullie de eerstvolgende levertermijn en hoeveelheid bevestigen?\n\nAlvast bedankt,\nGooodboys Ops` },
  { id: "supplier_qa", label: "Kwaliteitscheck bij leverancier", desc: "Leverancier aanspreken over een verhoogde retour-/klachtenratio.", impact: "Pakt de oorzaak aan de bron aan", urgent: true, outcome: "Kwaliteit onderzocht",
    message: (c) => `Onderwerp: Kwaliteitsonderzoek ${c.product || "product"}${c.sku ? ` (${c.sku})` : ""}\n\nBeste,\n\nWe zien een verhoogde retour- en klachtenratio op ${c.product || "dit product"}. Graag een kwaliteitscontrole op de recentste batch(es) en terugkoppeling over mogelijke oorzaken (grondstof, verpakking, transport). We denken graag mee aan een oplossing.\n\nMet vriendelijke groet,\nGooodboys Ops` },
  { id: "review_outreach", label: "Reviews opvolgen", desc: "Ontevreden reviewers benaderen en terugkerende klachten verzamelen.", impact: "Herstelt reputatie & score", outcome: "Reviews aangepakt",
    message: (c) => `Interne actie — reviews ${c.product || "product"}\n\n• Recente 1–3★ reviews doornemen en de klant contacteren met een oplossing.\n• Terugkerende klacht identificeren (smaak, effect, verpakking).\n• Tevreden abonnees uitnodigen om een review achter te laten.` },
  { id: "reformulate", label: "Recept/formule herzien", desc: "Formulering of verpakking aanpassen bij een structureel probleem.", impact: "Lost de oorzaak structureel op", outcome: "Formule herzien",
    message: (c) => `Interne actie — formule review ${c.product || "product"}\n\n• Klachten clusteren en de oorzaak vaststellen.\n• Met leverancier/R&D een aanpassing aan formule of verpakking bespreken.\n• Nieuwe batch testen vóór brede uitrol.` },
  { id: "pause_sales", label: "Verkoop tijdelijk pauzeren", desc: "Laatste redmiddel — product offline halen tot het probleem opgelost is.", impact: "Stopt verdere schade", urgent: true, outcome: "Verkoop gepauzeerd",
    message: (c) => `Interne escalatie — verkoop pauzeren ${c.product || "product"}${c.sku ? ` (${c.sku})` : ""}\n\nVoorstel om ${c.product || "dit product"} tijdelijk offline te halen wegens een kwaliteits-/voorraadprobleem. Impact op abonnementen en omzet in kaart brengen en communicatie naar betrokken klanten voorbereiden.` },
];
export const actionMeta = (id?: string | null) => ACTIONS.find((a) => a.id === id);
export const PH_OUTCOMES = ["Voorraad aangevuld", "Kwaliteit onderzocht", "Reviews aangepakt", "Formule herzien", "Verkoop gepauzeerd", "Vals alarm"];

/* ─── ownership ──────────────────────────────────────────────────────────── */
export type PHOwner = { email: string; name: string; at: string };
const OWN = "gb_ph_owner";
export function setPHOwner(id: string, o: { email: string; name: string }) { const m = readMap<PHOwner>(OWN); m[id] = { email: o.email, name: o.name, at: new Date().toISOString() }; writeMap(OWN, m); }
export function clearPHOwner(id: string) { const m = readMap<PHOwner>(OWN); delete m[id]; writeMap(OWN, m); }
export const usePHOwner = (id: string) => useKeyed<PHOwner | null>(OWN, id, null);

/* ─── audit log ──────────────────────────────────────────────────────────── */
export type PHLogKind = "status" | "signal" | "action" | "owner" | "resolution" | "note";
export type PHLog = { text: string; at: string; kind: PHLogKind; by?: string | null; byName?: string };
const LOG = "gb_ph_log";
export function addPHLog(id: string, text: string, kind: PHLogKind, actor?: Actor) { const m = readMap<PHLog[]>(LOG); m[id] = [{ text, at: new Date().toISOString(), kind, by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(LOG, m); }
export const usePHLog = (id: string) => useKeyed<PHLog[]>(LOG, id, []);

/* ─── internal notes ─────────────────────────────────────────────────────── */
export type PHNote = { text: string; at: string; by?: string | null; byName?: string };
const NOTES = "gb_ph_notes";
export function addPHNote(id: string, text: string, actor?: Actor) { const m = readMap<PHNote[]>(NOTES); m[id] = [{ text: text.trim(), at: new Date().toISOString(), by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(NOTES, m); }
export function removePHNote(id: string, at: string) { const m = readMap<PHNote[]>(NOTES); m[id] = (m[id] ?? []).filter((n) => n.at !== at); writeMap(NOTES, m); }
export const usePHNotes = (id: string) => useKeyed<PHNote[]>(NOTES, id, []);

/* ─── case meta — root cause, chosen action, resolution ──────────────────── */
export type PHMeta = { rootCause?: string; action?: ActionId; actionStartedAt?: string; resolvedAt?: string | null; outcome?: string };
const META = "gb_ph_meta";
export function setPHMeta(id: string, patch: PHMeta) { const m = readMap<PHMeta>(META); m[id] = { ...(m[id] ?? {}), ...patch }; writeMap(META, m); }
export const usePHMeta = (id: string) => useKeyed<PHMeta>(META, id, {});
