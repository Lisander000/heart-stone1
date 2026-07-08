// Returns de-escalation step plan — the ladder a Customer Service rep follows
// (e.g. 10% → 25% → …). Editing the plan is super-user only (gated in the UI).
import { useEffect, useState } from "react";

export type ReturnStep = { label: string; note: string };

/* Payment-method group — the CS rep first picks one, then follows that ladder.
   Credit-card refunds are costlier (the % fee isn't recovered), so that plan can differ. */
export type MethodGroup = "creditcard" | "other";
export const METHOD_GROUPS: { id: MethodGroup; label: string; hint: string }[] = [
  { id: "creditcard", label: "Creditcard", hint: "Visa · Mastercard · Amex" },
  { id: "other", label: "Andere betaalmethode", hint: "Bancontact · iDEAL · PayPal · overschrijving" },
];
export const methodLabel = (g: MethodGroup) => METHOD_GROUPS.find((m) => m.id === g)?.label ?? g;

const LS = "gb_returns_steps";
const METHOD = "gb_return_method";
const EV = "gb:returnsteps";

const SEED: Record<MethodGroup, ReturnStep[]> = {
  creditcard: [
    { label: "15% korting aanbieden", note: "Klant houdt het product — kaartrefund is duur, dus iets guller." },
    { label: "30% korting aanbieden", note: "Als de klant nog twijfelt of aandringt." },
    { label: "50% korting of gratis retourlabel", note: "Laatste poging om een retour te vermijden." },
    { label: "Volledige terugbetaling", note: "Retour goedkeuren — let op: de kaartfee komt niet terug." },
  ],
  other: [
    { label: "10% korting aanbieden", note: "Klant houdt het product — kleine tegemoetkoming." },
    { label: "25% korting aanbieden", note: "Als de klant nog twijfelt of aandringt." },
    { label: "50% korting of gratis retourlabel", note: "Laatste poging om een retour te vermijden." },
    { label: "Volledige terugbetaling", note: "Retour goedkeuren en verwerken." },
  ],
};

function getAllStepPlans(): Record<MethodGroup, ReturnStep[]> {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return { creditcard: p, other: p }; // migrate old single ladder
      return { creditcard: p.creditcard ?? SEED.creditcard, other: p.other ?? SEED.other };
    }
  } catch { /* ignore */ }
  return SEED;
}
export function getSteps(group: MethodGroup): ReturnStep[] { return getAllStepPlans()[group] ?? SEED[group]; }
export function saveSteps(group: MethodGroup, steps: ReturnStep[]) {
  const all = getAllStepPlans(); all[group] = steps;
  try { localStorage.setItem(LS, JSON.stringify(all)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useSteps(group: MethodGroup): ReturnStep[] {
  const [s, setS] = useState<ReturnStep[]>(() => getSteps(group));
  useEffect(() => { const on = () => setS(getSteps(group)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [group]);
  return s;
}
export function useAllStepPlans(): Record<MethodGroup, ReturnStep[]> {
  const [p, setP] = useState<Record<MethodGroup, ReturnStep[]>>(getAllStepPlans);
  useEffect(() => { const on = () => setP(getAllStepPlans()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, []);
  return p;
}

/* per-return: which payment-method group the CS rep chose (drives which ladder shows) */
function allMethods(): Record<string, MethodGroup> { try { return JSON.parse(localStorage.getItem(METHOD) || "{}"); } catch { return {}; } }
export function getReturnMethod(id: string): MethodGroup | null { return allMethods()[id] ?? null; }
export function setReturnMethod(id: string, group: MethodGroup | null) {
  const m = allMethods();
  if (group === null) delete m[id]; else m[id] = group;
  try { localStorage.setItem(METHOD, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useReturnMethod(id: string): MethodGroup | null {
  const [g, setG] = useState<MethodGroup | null>(() => getReturnMethod(id));
  useEffect(() => { const on = () => setG(getReturnMethod(id)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [id]);
  return g;
}
export function useAllReturnMethods(): Record<string, MethodGroup> {
  const [m, setM] = useState<Record<string, MethodGroup>>(allMethods);
  useEffect(() => { const on = () => setM(allMethods()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, []);
  return m;
}

/* per-return, per-step outcome — did the customer accept that offer? */
export type Outcome = "accepted" | "rejected";
const OUT = "gb_return_outcomes";
function allOutcomes(): Record<string, Record<number, Outcome>> { try { return JSON.parse(localStorage.getItem(OUT) || "{}"); } catch { return {}; } }
export function getOutcomes(id: string): Record<number, Outcome> { return allOutcomes()[id] ?? {}; }
export function setOutcome(id: string, step: number, outcome: Outcome | null) {
  const m = allOutcomes();
  const cur: Record<number, Outcome> = { ...(m[id] ?? {}) };
  if (outcome === null) delete cur[step]; else cur[step] = outcome;
  m[id] = cur;
  try { localStorage.setItem(OUT, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useOutcome(id: string): Record<number, Outcome> {
  const [o, setO] = useState<Record<number, Outcome>>(() => getOutcomes(id));
  useEffect(() => { const on = () => setO(getOutcomes(id)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [id]);
  return o;
}
export function useAllOutcomes(): Record<string, Record<number, Outcome>> {
  const [o, setO] = useState<Record<string, Record<number, Outcome>>>(allOutcomes);
  useEffect(() => { const on = () => setO(allOutcomes()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, []);
  return o;
}
/** derive the ladder state: which step is current, and whether it's resolved */
export function ladderState(outcomes: Record<number, Outcome>, total: number) {
  const entries = Object.entries(outcomes).map(([k, v]) => [Number(k), v] as [number, Outcome]);
  const acceptedIdx = entries.find(([, v]) => v === "accepted")?.[0];
  const resolved = acceptedIdx != null;
  const currentIdx = resolved ? -1 : entries.length;   // rejections are sequential from 0
  const complete = resolved || currentIdx >= total;
  return { acceptedIdx, resolved, currentIdx, complete };
}

/** parse the discount % from a step label ("10% korting" → 10). No % (e.g. "Volledige terugbetaling") → 100. */
export function stepPct(label: string): number {
  const m = (label || "").match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? Math.min(100, parseFloat(m[1].replace(",", "."))) : 100;
}
/** the % of the amount that is actually refunded, given the accepted phase (full refund if none accepted). */
export function refundPct(outcomes: Record<number, Outcome>, steps: { label: string }[]): number {
  const acceptedIdx = Object.entries(outcomes).find(([, v]) => v === "accepted")?.[0];
  if (acceptedIdx == null) return 100; // no offer accepted → full refund
  return stepPct(steps[Number(acceptedIdx)]?.label ?? "");
}

export type Actor = { by?: string | null; byName?: string };

/* per-return manual notes (free text the rep leaves) — with author */
export type ReturnNote = { text: string; at: string; by?: string | null; byName?: string; step?: number };
const NOTES = "gb_return_notes";
function allNotes(): Record<string, ReturnNote[]> { try { return JSON.parse(localStorage.getItem(NOTES) || "{}"); } catch { return {}; } }
export function getNotes(id: string): ReturnNote[] { return allNotes()[id] ?? []; }
export function addNote(id: string, text: string, actor?: Actor) {
  const m = allNotes();
  m[id] = [{ text: text.trim(), at: new Date().toISOString(), by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])];
  try { localStorage.setItem(NOTES, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function removeNote(id: string, at: string) {
  const m = allNotes();
  m[id] = (m[id] ?? []).filter((n) => n.at !== at);
  try { localStorage.setItem(NOTES, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useNotes(id: string): ReturnNote[] {
  const [n, setN] = useState<ReturnNote[]>(() => getNotes(id));
  useEffect(() => { const on = () => setN(getNotes(id)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [id]);
  return n;
}

/* per-return audit log — system events (status change, step decision, ownership) */
export type LogKind = "status" | "step" | "owner";
export type ReturnLog = { text: string; at: string; kind: LogKind; by?: string | null; byName?: string };
const LOG = "gb_return_log";
function allLog(): Record<string, ReturnLog[]> { try { return JSON.parse(localStorage.getItem(LOG) || "{}"); } catch { return {}; } }
export function getLog(id: string): ReturnLog[] { return allLog()[id] ?? []; }
export function addLog(id: string, text: string, kind: LogKind, actor?: Actor) {
  const m = allLog();
  m[id] = [{ text, at: new Date().toISOString(), kind, by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])];
  try { localStorage.setItem(LOG, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useLog(id: string): ReturnLog[] {
  const [l, setL] = useState<ReturnLog[]>(() => getLog(id));
  useEffect(() => { const on = () => setL(getLog(id)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [id]);
  return l;
}

/* per-return owner — who is handling this refund case (so others don't step in) */
export type ReturnOwner = { email: string; name: string; at: string };
const OWN = "gb_return_owners";
function allOwners(): Record<string, ReturnOwner> { try { return JSON.parse(localStorage.getItem(OWN) || "{}"); } catch { return {}; } }
export function getOwner(id: string): ReturnOwner | null { return allOwners()[id] ?? null; }
export function getAllOwners(): Record<string, ReturnOwner> { return allOwners(); }
export function useAllOwners(): Record<string, ReturnOwner> {
  const [o, setO] = useState<Record<string, ReturnOwner>>(allOwners);
  useEffect(() => { const on = () => setO(allOwners()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, []);
  return o;
}
export function setOwner(id: string, owner: { email: string; name: string }) {
  const m = allOwners(); m[id] = { email: owner.email, name: owner.name, at: new Date().toISOString() };
  try { localStorage.setItem(OWN, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function clearOwner(id: string) {
  const m = allOwners(); delete m[id];
  try { localStorage.setItem(OWN, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useOwner(id: string): ReturnOwner | null {
  const [o, setO] = useState<ReturnOwner | null>(() => getOwner(id));
  useEffect(() => { const on = () => setO(getOwner(id)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [id]);
  return o;
}

/* per-return workflow meta — resolved date + confirmed refunded total (schema-free) */
export type CaseMeta = { resolvedAt?: string | null; refundedTotal?: number; refundedPct?: number };
const META = "gb_return_meta";
function allMeta(): Record<string, CaseMeta> { try { return JSON.parse(localStorage.getItem(META) || "{}"); } catch { return {}; } }
export function getMeta(id: string): CaseMeta { return allMeta()[id] ?? {}; }
export function setMeta(id: string, patch: CaseMeta) {
  const m = allMeta(); m[id] = { ...(m[id] ?? {}), ...patch };
  try { localStorage.setItem(META, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useMeta(id: string): CaseMeta {
  const [mt, setMt] = useState<CaseMeta>(() => getMeta(id));
  useEffect(() => { const on = () => setMt(getMeta(id)); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, [id]);
  return mt;
}
