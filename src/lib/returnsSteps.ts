// Returns de-escalation step plan — the ladder a Customer Service rep follows
// (e.g. 10% → 25% → …). Editing the plan is super-user only (gated in the UI).
import { useEffect, useState } from "react";

export type ReturnStep = { label: string; note: string };

const LS = "gb_returns_steps";
const PROG = "gb_return_progress";
const EV = "gb:returnsteps";

const SEED: ReturnStep[] = [
  { label: "10% korting aanbieden", note: "Klant houdt het product — kleine tegemoetkoming." },
  { label: "25% korting aanbieden", note: "Als de klant nog twijfelt of aandringt." },
  { label: "50% korting of gratis retourlabel", note: "Laatste poging om een retour te vermijden." },
  { label: "Volledige terugbetaling", note: "Retour goedkeuren en verwerken." },
];

export function getSteps(): ReturnStep[] {
  try { const raw = localStorage.getItem(LS); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return SEED;
}
export function saveSteps(steps: ReturnStep[]) {
  try { localStorage.setItem(LS, JSON.stringify(steps)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useSteps(): ReturnStep[] {
  const [s, setS] = useState<ReturnStep[]>(getSteps);
  useEffect(() => { const on = () => setS(getSteps()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, []);
  return s;
}

/* per-return progress: how far the rep has climbed the ladder (0 = none done) */
export function getProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(PROG) || "{}"); } catch { return {}; }
}
export function setProgress(id: string, done: number) {
  const m = getProgress();
  m[id] = done;
  try { localStorage.setItem(PROG, JSON.stringify(m)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ }
}
export function useProgress(): Record<string, number> {
  const [p, setP] = useState<Record<string, number>>(getProgress);
  useEffect(() => { const on = () => setP(getProgress()); window.addEventListener(EV, on); return () => window.removeEventListener(EV, on); }, []);
  return p;
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
