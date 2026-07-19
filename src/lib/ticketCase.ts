// Support-ticket handling case — everything a CS rep needs to resolve a ticket end
// to end: status lifecycle, priority-driven SLA/urgency, customer replies (with
// templates), internal notes, ownership and resolution. Stored client-side, keyed by
// ticket id, mirroring the returns/shipments case layers.
import { useEffect, useState } from "react";

export const EV = "gb:ticketcase";
const fire = () => { try { window.dispatchEvent(new CustomEvent(EV)); } catch { /* ignore */ } };
const HOUR = 3_600_000;

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

/* ─── status lifecycle ───────────────────────────────────────────────────── */
export const FLOW = ["open", "pending", "solved", "closed"] as const;
export type TicketStatus = typeof FLOW[number] | "resolved";
export const STATUS_LABEL: Record<string, string> = { open: "Open", pending: "Wacht op klant", solved: "Opgelost", resolved: "Opgelost", closed: "Gesloten" };
export const statusIndex = (s: string) => { const i = FLOW.indexOf((s === "resolved" ? "solved" : s) as any); return i < 0 ? 0 : i; };

/* ─── priority → SLA / urgency ───────────────────────────────────────────── */
export type Priority = "low" | "normal" | "medium" | "high" | "urgent";
export const PRIORITIES: { id: Priority; label: string; tone: string; slaH: number }[] = [
  { id: "urgent", label: "Urgent", tone: "bad", slaH: 2 },
  { id: "high", label: "Hoog", tone: "ember", slaH: 4 },
  { id: "medium", label: "Middel", tone: "sun", slaH: 8 },
  { id: "normal", label: "Normaal", tone: "info", slaH: 24 },
  { id: "low", label: "Laag", tone: "muted", slaH: 48 },
];
export const prioMeta = (p?: string | null) => PRIORITIES.find((x) => x.id === p) ?? PRIORITIES.find((x) => x.id === "normal")!;

/** hours the customer has been waiting (since created), 0 once resolved/closed */
export function waitedHours(createdAt?: string | null, status?: string): number {
  if (!createdAt || status === "solved" || status === "resolved" || status === "closed") return 0;
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / HOUR);
}
export type Urgency = { label: string; tone: string; sla: string; waited: number; overSla: boolean };
export function computeUrgency(priority?: string | null, createdAt?: string | null, status?: string): Urgency {
  const pm = prioMeta(priority);
  const waited = waitedHours(createdAt, status);
  const overSla = waited > pm.slaH && (status === "open" || status === "pending");
  const fmt = pm.slaH >= 24 ? `${Math.round(pm.slaH / 24)} d` : `${pm.slaH} u`;
  return { label: pm.label, tone: overSla ? "bad" : pm.tone, sla: `eerste reactie binnen ${fmt}`, waited, overSla };
}
export const fmtWaited = (h: number) => (h <= 0 ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} u` : `${Math.round(h / 24)} d`);

/* ─── customer reply templates ───────────────────────────────────────────── */
export type TplCtx = { name?: string; subject?: string };
const firstName = (n?: string) => (n ? n.split("@")[0].split(/[ .]/)[0] : "daar");
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const SIGN = "\n\nWarme groet,\nHet Gooodboys-team";
export const TEMPLATES: { id: string; label: string; body: (c: TplCtx) => string }[] = [
  { id: "ack", label: "Ontvangst bevestigen", body: (c) => `Hoi ${cap(firstName(c.name))},\n\nBedankt voor je bericht! We hebben je vraag goed ontvangen en kijken er meteen naar. Je hoort snel van ons. 🐾${SIGN}` },
  { id: "info", label: "Extra info vragen", body: (c) => `Hoi ${cap(firstName(c.name))},\n\nOm je zo goed mogelijk te helpen, hebben we nog even wat extra info nodig. Kun je ons je ordernummer en een korte omschrijving doorsturen? Dan lossen we het meteen voor je op. 🐾${SIGN}` },
  { id: "solved", label: "Opgelost bevestigen", body: (c) => `Hoi ${cap(firstName(c.name))},\n\nGoed nieuws — we hebben dit voor je opgelost! Laat gerust weten als er nog iets is, we helpen je graag verder. 🐾${SIGN}` },
  { id: "apology", label: "Excuses + oplossing", body: (c) => `Hoi ${cap(firstName(c.name))},\n\nOnze oprechte excuses voor het ongemak. We nemen dit meteen in orde en zorgen dat het goedkomt. Bedankt voor je geduld! 🐾${SIGN}` },
];

/* ─── ownership ──────────────────────────────────────────────────────────── */
export type TicketOwner = { email: string; name: string; at: string };
const OWN = "gb_ticket_owner";
export const getTicketOwner = (id: string): TicketOwner | null => readMap<TicketOwner>(OWN)[id] ?? null;
export function setTicketOwner(id: string, o: { email: string; name: string }) { const m = readMap<TicketOwner>(OWN); m[id] = { email: o.email, name: o.name, at: new Date().toISOString() }; writeMap(OWN, m); }
export function clearTicketOwner(id: string) { const m = readMap<TicketOwner>(OWN); delete m[id]; writeMap(OWN, m); }
export const useTicketOwner = (id: string) => useKeyed<TicketOwner | null>(OWN, id, null);

/* ─── audit log ──────────────────────────────────────────────────────────── */
export type TicketLogKind = "status" | "priority" | "owner" | "resolution" | "reply";
export type TicketLog = { text: string; at: string; kind: TicketLogKind; by?: string | null; byName?: string };
const LOG = "gb_ticket_log";
export function addTicketLog(id: string, text: string, kind: TicketLogKind, actor?: Actor) { const m = readMap<TicketLog[]>(LOG); m[id] = [{ text, at: new Date().toISOString(), kind, by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(LOG, m); }
export const useTicketLog = (id: string) => useKeyed<TicketLog[]>(LOG, id, []);

/* ─── internal notes ─────────────────────────────────────────────────────── */
export type TicketNote = { text: string; at: string; by?: string | null; byName?: string };
const NOTES = "gb_ticket_notes";
export function addTicketNote(id: string, text: string, actor?: Actor) { const m = readMap<TicketNote[]>(NOTES); m[id] = [{ text: text.trim(), at: new Date().toISOString(), by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(NOTES, m); }
export function removeTicketNote(id: string, at: string) { const m = readMap<TicketNote[]>(NOTES); m[id] = (m[id] ?? []).filter((n) => n.at !== at); writeMap(NOTES, m); }
export const useTicketNotes = (id: string) => useKeyed<TicketNote[]>(NOTES, id, []);

/* ─── customer replies ───────────────────────────────────────────────────── */
export type CommDir = "out" | "in";
export type TicketComm = { text: string; at: string; dir: CommDir; by?: string | null; byName?: string };
const COMMS = "gb_ticket_comms";
export function addTicketComm(id: string, c: { text: string; dir: CommDir }, actor?: Actor) { const m = readMap<TicketComm[]>(COMMS); m[id] = [{ text: c.text.trim(), at: new Date().toISOString(), dir: c.dir, by: actor?.by ?? null, byName: actor?.byName }, ...(m[id] ?? [])]; writeMap(COMMS, m); }
export const useTicketComms = (id: string) => useKeyed<TicketComm[]>(COMMS, id, []);

/* ─── case meta — resolution ─────────────────────────────────────────────── */
export type TicketMeta = { resolvedAt?: string | null; outcome?: string; category?: string };
const META = "gb_ticket_meta";
export const getTicketMeta = (id: string): TicketMeta => readMap<TicketMeta>(META)[id] ?? {};
export function setTicketMeta(id: string, patch: TicketMeta) { const m = readMap<TicketMeta>(META); m[id] = { ...(m[id] ?? {}), ...patch }; writeMap(META, m); }
export const useTicketMeta = (id: string) => useKeyed<TicketMeta>(META, id, {});

export const RESOLUTIONS = ["Opgelost", "Doorverwezen", "Geen actie nodig", "Klant tevreden", "Refund/vervanging geregeld"];
