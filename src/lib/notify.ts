// Notification engine — creates in-app notifications (bell + Notifications page),
// pops a toast + plays a chime in-app, and fires a browser/OS notification when allowed.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type NotifKind = "info" | "warning" | "critical" | "success";
export type NotifRow = { id: string; title: string; body: string; kind: NotifKind; link: string | null; created_at: string; system?: boolean };

const LS = "gb_notifications_inbox";
const SEEN = "gb_notif_seen";
export const NOTIF_EVENT = "gb:notification";

let backendCache: "supabase" | "local" | null = null;
async function backend(): Promise<"supabase" | "local"> {
  if (backendCache) return backendCache;
  const { error } = await (supabase as any).from("notifications_inbox").select("id").limit(1);
  backendCache = error ? "local" : "supabase";
  return backendCache;
}

/* dedupe (e.g. one daily-tracker reminder per day) */
function alreadySeen(key?: string): boolean {
  if (!key) return false;
  try {
    const m = JSON.parse(localStorage.getItem(SEEN) || "{}");
    if (m[key]) return true;
    m[key] = Date.now();
    localStorage.setItem(SEEN, JSON.stringify(m));
    return false;
  } catch { return false; }
}

/** Create a notification: stored (in-app) + browser/OS push. */
export async function notify(opts: { title: string; body?: string; kind?: NotifKind; link?: string; dedupeKey?: string; silent?: boolean }): Promise<NotifRow | null> {
  const { title, body = "", kind = "info", link = null, dedupeKey, silent } = opts;
  if (alreadySeen(dedupeKey)) return null;
  const row: NotifRow = { id: crypto.randomUUID(), title, body, kind, link, created_at: new Date().toISOString() };

  const be = await backend();
  if (be === "supabase") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await (supabase as any).from("notifications_inbox").insert({ id: row.id, title, body, kind, link, user_id: user.id });
    } catch { /* fall through to event */ }
  } else {
    try { const arr = JSON.parse(localStorage.getItem(LS) || "[]"); arr.unshift(row); localStorage.setItem(LS, JSON.stringify(arr)); } catch { /* ignore */ }
  }

  if (!silent) { popInApp(row); showBrowserNotification(row); }
  try { window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: row })); } catch { /* ignore */ }
  return row;
}

/* In-app pop: a toast in the corner + a short chime, so you notice it even
 * without OS permission. */
function popInApp(row: NotifRow) {
  const fn = row.kind === "critical" ? toast.error : row.kind === "warning" ? toast.warning : row.kind === "success" ? toast.success : toast.info;
  try { fn(row.title, { description: row.body || undefined, duration: 6000 }); } catch { /* ignore */ }
  playChime();
}

let audioCtx: AudioContext | null = null;
export function playChime() {
  if (typeof window === "undefined") return;
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const beep = (freq: number, start: number, dur: number, vol = 0.32) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.type = "triangle"; o.frequency.value = freq;   // triangle carries further than sine
      o.connect(g); g.connect(audioCtx!.destination);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(vol, now + start + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.start(now + start); o.stop(now + start + dur + 0.02);
    };
    // clear rising 3-note chime, then a repeat — hard to miss
    beep(587.33, 0.00, 0.15);  // D5
    beep(880.00, 0.15, 0.15);  // A5
    beep(1174.66, 0.30, 0.34); // D6
    beep(587.33, 0.62, 0.13, 0.24);
    beep(1174.66, 0.75, 0.30, 0.28);
  } catch { /* ignore */ }
}

/** Fire an OS/browser notification (via the service worker if available). */
export function showBrowserNotification(row: NotifRow) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const opts = { body: row.body, icon: "/gb-mark.png", badge: "/gb-mark.png", tag: row.id, renotify: true, requireInteraction: true, vibrate: [200, 100, 200], data: { link: row.link || "/notifications" } } as NotificationOptions;
  try {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      if (reg) reg.showNotification(row.title, opts);
      else new Notification(row.title, opts);
    }).catch(() => { try { new Notification(row.title, opts); } catch { /* ignore */ } });
  } catch { /* ignore */ }
}

/** Ask the user for notification permission (must be called from a user gesture). */
export async function enableNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm === "granted") await registerServiceWorker();
  return perm;
}

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try { await navigator.serviceWorker.register("/sw.js"); } catch { /* ignore */ }
}

/* ─── reads used by the bell (stored + live system alerts + per-user read state) ─ */
export async function loadStored(limit = 30): Promise<NotifRow[]> {
  const be = await backend();
  if (be === "supabase") {
    const { data } = await (supabase as any).from("notifications_inbox").select("*").order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, body: r.body ?? "", kind: (r.kind ?? "info") as NotifKind, link: r.link, created_at: r.created_at }));
  }
  try { return (JSON.parse(localStorage.getItem(LS) || "[]") as NotifRow[]).slice(0, limit); } catch { return []; }
}

export async function computeSystemAlerts(): Promise<NotifRow[]> {
  const out: NotifRow[] = [];
  try {
    const { data: syn } = await supabase.from("syntheses").select("id, updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (syn && Date.now() - new Date((syn as any).updated_at).getTime() > 7 * 24 * 60 * 60 * 1000)
      out.push({ id: "sys-syn-old", title: "Synthesis ouder dan een week", body: "De laatste synthesis is meer dan 7 dagen oud.", kind: "warning", link: "/synthesis", created_at: (syn as any).updated_at, system: true });
  } catch { /* ignore */ }
  try {
    const { count } = await supabase.from("entries").select("id", { count: "exact", head: true }).is("collection_id", null);
    if ((count ?? 0) > 0) out.push({ id: "sys-orphans", title: `${count} entries zonder collectie`, body: "Sorteer ze in de juiste collectie.", kind: "info", link: "/bank", created_at: new Date().toISOString(), system: true });
  } catch { /* ignore */ }
  return out;
}

export function loadReadState(uid: string): Record<string, { status: string; comment?: string }> {
  try { return JSON.parse(localStorage.getItem(`gb_notif_state_${uid || "local"}`) || "{}"); } catch { return {}; }
}
export const isUnread = (states: Record<string, { status: string }>, id: string) => {
  const s = states[id];
  return !s || s.status === "unread";
};

/* Mark notifications read → they drop out of the "open" (unread) list. */
function writeState(uid: string, next: Record<string, { status: string; comment?: string }>) {
  try { localStorage.setItem(`gb_notif_state_${uid || "local"}`, JSON.stringify(next)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(NOTIF_EVENT)); } catch { /* ignore */ }
}
export function markRead(uid: string, id: string) {
  const m = loadReadState(uid);
  const cur = m[id] ?? { status: "unread", comment: "" };
  if (cur.status === "unread") { m[id] = { ...cur, status: "read" }; writeState(uid, m); }
}
export function markAllRead(uid: string, ids: string[]) {
  const m = loadReadState(uid);
  let changed = false;
  ids.forEach((id) => { const cur = m[id] ?? { status: "unread", comment: "" }; if (cur.status === "unread") { m[id] = { ...cur, status: "read" }; changed = true; } });
  if (changed) writeState(uid, m);
}

/* Fire a visible test notification (in-app + OS push). */
export async function sendTestNotification() {
  const perm = await enableNotifications();
  await notify({
    title: "🔔 Testmelding",
    body: perm === "granted" ? "Push werkt! Je ziet dit ook als systeemmelding." : "In-app melding werkt. Zet browser-meldingen aan voor push buiten het scherm.",
    kind: perm === "granted" ? "success" : "info",
    link: "/notifications",
  });
  return perm;
}
