import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Bell, BellRing, Plus, ExternalLink, Info, AlertTriangle, AlertOctagon, CheckCircle2, Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { fmtDate } from "@/components/ops/ResourcePage";
import { enableNotifications, sendTestNotification } from "@/lib/notify";

/* ─── types ──────────────────────────────────────────────────────────────── */
type Kind = "info" | "warning" | "critical" | "success";
type Notif = {
  id: string;
  title: string;
  body: string;
  kind: Kind;
  link?: string | null;
  created_at: string;
  system?: boolean;   // computed alert — cannot be deleted / edited
};
type NotifStatus = "unread" | "read" | "checked" | "important" | "not_important";
type UserState = { status: NotifStatus; comment: string };

/* ─── status catalogue (private, per user) ───────────────────────────────── */
const STATUS_META: { id: NotifStatus; label: string; tone: string }[] = [
  { id: "unread",        label: "Ongelezen",       tone: "warn" },
  { id: "read",          label: "Gelezen",         tone: "info" },
  { id: "checked",       label: "Gecontroleerd",   tone: "ok" },
  { id: "important",     label: "Belangrijk",      tone: "bad" },
  { id: "not_important", label: "Niet belangrijk", tone: "idle" },
];
const toneVar = (t: string) =>
  t === "ok" ? "ok" : t === "warn" ? "warn" : t === "bad" ? "bad" : t === "info" ? "info" : "muted-foreground";

const KIND_META: Record<Kind, { icon: React.ElementType; tone: string; label: string }> = {
  info:     { icon: Info,          tone: "info", label: "Info" },
  warning:  { icon: AlertTriangle, tone: "warn", label: "Waarschuwing" },
  critical: { icon: AlertOctagon,  tone: "bad",  label: "Kritiek" },
  success:  { icon: CheckCircle2,  tone: "ok",   label: "Succes" },
};

/* ─── per-user private state (localStorage, keyed by uid → never shared) ──── */
const stateKey = (uid: string) => `gb_notif_state_${uid || "local"}`;
const loadStates = (uid: string): Record<string, UserState> => {
  try { const raw = localStorage.getItem(stateKey(uid)); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};
const getState = (states: Record<string, UserState>, id: string): UserState =>
  states[id] ?? { status: "unread", comment: "" };

/* ─── shared notification content (hybrid: supabase | localStorage) ───────── */
const LS = "gb_notifications_inbox";
async function detectBackend(): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from("notifications_inbox").select("id").limit(1);
  return error ? "local" : "supabase";
}

/* ─── page ───────────────────────────────────────────────────────────────── */
export default function Notifications() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [states, setStates] = useState<Record<string, UserState>>({});
  const [uid, setUid] = useState("");
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotifStatus | "all">("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const enablePush = async () => {
    const p = await enableNotifications();
    setPerm(p);
    if (p === "denied") toast.error("Meldingen zijn geblokkeerd in je browser. Zet ze aan via het slot-icoon in de adresbalk.");
    else if (p === "granted") toast.success("Push-meldingen staan aan.");
  };
  const runTest = async () => {
    const p = await sendTestNotification();
    setPerm(p === "unsupported" ? perm : p);
    if (p === "granted") toast.success("Testmelding verstuurd — check je systeemmeldingen.");
    else if (p === "denied") toast.error("Push geblokkeerd. De melding staat wel in de lijst hieronder.");
    else toast("Testmelding toegevoegd aan de lijst hieronder.");
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const id = user?.id ?? "";
      setUid(id);
      setStates(loadStates(id));

      const be = await detectBackend();
      setBackend(be);

      // 1) stored notifications
      let stored: Notif[] = [];
      if (be === "supabase") {
        const { data } = await (supabase as any)
          .from("notifications_inbox").select("*").order("created_at", { ascending: false });
        stored = (data ?? []).map((r: any) => ({
          id: r.id, title: r.title, body: r.body ?? "", kind: (r.kind ?? "info") as Kind,
          link: r.link, created_at: r.created_at,
        }));
      } else {
        try { stored = JSON.parse(localStorage.getItem(LS) ?? "[]"); } catch { stored = []; }
      }

      // 2) live system alerts (same signals as the bell) — read-only
      const system = await computeSystemAlerts();

      setNotifs([...system, ...stored]);
      setLoading(false);
    })();
  }, []);

  const persistStored = (next: Notif[]) => {
    const userRows = next.filter((n) => !n.system);
    localStorage.setItem(LS, JSON.stringify(userRows));
  };

  /* — private state writers — */
  const setStatus = (id: string, status: NotifStatus) => {
    setStates((prev) => {
      const cur = getState(prev, id);
      const next = { ...prev, [id]: { ...cur, status } };
      localStorage.setItem(stateKey(uid), JSON.stringify(next));
      return next;
    });
  };
  const setComment = (id: string, comment: string) => {
    setStates((prev) => {
      const cur = getState(prev, id);
      const next = { ...prev, [id]: { ...cur, comment } };
      localStorage.setItem(stateKey(uid), JSON.stringify(next));
      return next;
    });
  };

  /* — compose a shared internal notification — */
  const addNotif = async (draft: { title: string; body: string; kind: Kind; link: string }) => {
    const row: Notif = {
      id: crypto.randomUUID(), title: draft.title.trim(), body: draft.body.trim(),
      kind: draft.kind, link: draft.link.trim() || null, created_at: new Date().toISOString(),
    };
    const next = [row, ...notifs];
    setNotifs(next);
    if (backend === "local") persistStored(next);
    else {
      const { error } = await (supabase as any).from("notifications_inbox")
        .insert({ id: row.id, title: row.title, body: row.body, kind: row.kind, link: row.link, user_id: uid });
      if (error) toast.error(error.message);
    }
    setComposeOpen(false);
  };

  const removeNotif = async (id: string) => {
    const next = notifs.filter((n) => n.id !== id);
    setNotifs(next);
    if (backend === "local") persistStored(next);
    else await (supabase as any).from("notifications_inbox").delete().eq("id", id);
  };

  /* — counts + filter — */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: notifs.length };
    STATUS_META.forEach((s) => (c[s.id] = 0));
    notifs.forEach((n) => { c[getState(states, n.id).status]++; });
    return c;
  }, [notifs, states]);

  const visible = useMemo(
    () => (filter === "all" ? notifs : notifs.filter((n) => getState(states, n.id).status === filter)),
    [notifs, states, filter]
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center"><Bell className="h-4.5 w-4.5 text-primary" /></span>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Interne meldingen & alerts. Zet je eigen status of notitie — <span className="font-medium text-foreground">alleen jij ziet dat</span>.
            </p>
          </motion.div>
          <div className="flex items-center gap-2">
            {perm !== "granted" && perm !== "unsupported" && (
              <button onClick={enablePush}
                className="h-9 px-3.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium flex items-center gap-1.5 hover:bg-primary/10 transition-all">
                <BellRing className="h-3.5 w-3.5" /> Push aanzetten
              </button>
            )}
            <button onClick={runTest}
              className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors">
              <BellRing className="h-3.5 w-3.5" /> Test melding
            </button>
            <button onClick={() => setComposeOpen(true)}
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
              <Plus className="h-4 w-4" /> Nieuw
            </button>
          </div>
        </div>

        {/* filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterPill label="Alle" n={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
          {STATUS_META.map((s) => (
            <FilterPill key={s.id} label={s.label} n={counts[s.id]} tone={s.tone}
              active={filter === s.id} onClick={() => setFilter(filter === s.id ? "all" : s.id)} />
          ))}
        </div>

        {/* list */}
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card-soft h-32 shimmer" />)}</div>
        ) : visible.length === 0 ? (
          <div className="card-soft py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3"><Bell className="h-5 w-5 text-muted-foreground" /></div>
            <p className="text-sm font-semibold text-foreground mb-1">{filter === "all" ? "Geen meldingen" : "Niets in dit filter"}</p>
            <p className="text-xs text-muted-foreground">{filter === "all" ? "Je bent helemaal bij." : "Wis het filter om alles te zien."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((n) => (
              <NotifCard key={n.id} n={n} state={getState(states, n.id)}
                onStatus={(s) => setStatus(n.id, s)} onComment={(c) => setComment(n.id, c)}
                onDelete={n.system ? undefined : () => setDeleteId(n.id)} />
            ))}
          </div>
        )}
      </div>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} onSubmit={addNotif} />
      <ConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => { if (deleteId) removeNotif(deleteId); setDeleteId(null); }}
        title="Melding verwijderen?" description="Deze melding wordt voor iedereen verwijderd. Je eigen notitie gaat mee verloren." />
    </div>
  );
}

/* ─── filter pill ────────────────────────────────────────────────────────── */
function FilterPill({ label, n, tone, active, onClick }: { label: string; n: number; tone?: string; active: boolean; onClick: () => void }) {
  const c = tone ? `hsl(var(--${toneVar(tone)}))` : undefined;
  return (
    <button onClick={onClick}
      className={`h-8 px-3 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${active ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs"}`}>
      {tone && <span className="dot" style={{ background: active ? "currentColor" : c, width: 6, height: 6 }} />}
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );
}

/* ─── notification card ──────────────────────────────────────────────────── */
function NotifCard({ n, state, onStatus, onComment, onDelete }: {
  n: Notif; state: UserState; onStatus: (s: NotifStatus) => void; onComment: (c: string) => void; onDelete?: () => void;
}) {
  const k = KIND_META[n.kind] ?? KIND_META.info;
  const KIcon = k.icon;
  const kc = `hsl(var(--${toneVar(k.tone)}))`;
  const important = state.status === "important";
  const muted = state.status === "read" || state.status === "not_important";

  return (
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }}
      className={`card-soft p-5 relative overflow-hidden ${muted ? "opacity-75" : ""}`}>
      {important && <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: "hsl(var(--bad))" }} />}

      {/* header */}
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${kc}18` }}>
          <KIcon className="h-4.5 w-4.5" style={{ color: kc }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground leading-tight">{n.title}</p>
            {n.system && (
              <span className="inline-flex items-center gap-1 rounded-full bg-grape/10 text-grape px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "hsl(var(--info)/0.12)", color: "hsl(var(--info))" }}>
                <Sparkles className="h-3 w-3" /> Systeem
              </span>
            )}
            {state.status !== "unread" && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                style={{ background: `hsl(var(--${toneVar(STATUS_META.find((s) => s.id === state.status)!.tone)})/0.14)`,
                         color: `hsl(var(--${toneVar(STATUS_META.find((s) => s.id === state.status)!.tone)}))` }}>
                {STATUS_META.find((s) => s.id === state.status)!.label}
              </span>
            )}
          </div>
          {n.body && <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">{n.body}</p>}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] text-muted-foreground">{fmtDate(n.created_at)} · {k.label}</span>
            {n.link && (
              n.link.startsWith("/")
                ? <Link to={n.link} className="text-[11px] text-info font-medium hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open</Link>
                : <a href={n.link} target="_blank" rel="noreferrer" className="text-[11px] text-info font-medium hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open</a>
            )}
          </div>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="text-muted-foreground/40 hover:text-bad text-sm shrink-0 px-1">✕</button>
        )}
      </div>

      {/* private controls */}
      <div className="mt-4 pt-3 border-t border-border/60 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Status</span>
          {STATUS_META.map((s) => {
            const on = state.status === s.id;
            const c = `hsl(var(--${toneVar(s.tone)}))`;
            return (
              <button key={s.id} onClick={() => onStatus(s.id)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 border ${on ? "shadow-xs" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                style={on ? { background: `${c}18`, color: c, borderColor: `${c}55` } : undefined}>
                <span className="dot" style={{ background: c, width: 6, height: 6 }} /> {s.label}
              </button>
            );
          })}
        </div>
        <textarea
          defaultValue={state.comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder="Jouw notitie (privé) — alleen jij ziet dit…"
          rows={2}
          className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] text-foreground outline-none focus:border-ring/50 focus:bg-card resize-none transition-colors"
        />
      </div>
    </motion.div>
  );
}

/* ─── compose dialog ─────────────────────────────────────────────────────── */
function ComposeDialog({ open, onOpenChange, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (d: { title: string; body: string; kind: Kind; link: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Kind>("info");
  const [link, setLink] = useState("");
  useEffect(() => { if (open) { setTitle(""); setBody(""); setKind("info"); setLink(""); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display text-lg">Nieuwe melding</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Titel</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Korte titel…"
              className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-ring/50" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bericht</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Wat moet het team weten?"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring/50 resize-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Soort</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-ring/50 capitalize">
                {(Object.keys(KIND_META) as Kind[]).map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Link (optioneel)</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/orders of https://…"
                className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-ring/50" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">Annuleer</button>
          <button disabled={!title.trim()} onClick={() => onSubmit({ title, body, kind, link })}
            className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Toevoegen
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── system alerts (mirror of the bell's signals) ───────────────────────── */
async function computeSystemAlerts(): Promise<Notif[]> {
  const out: Notif[] = [];
  try {
    const { data: syn } = await supabase.from("syntheses").select("id, updated_at")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (syn && Date.now() - new Date((syn as any).updated_at).getTime() > 7 * 24 * 60 * 60 * 1000) {
      out.push({ id: "sys-syn-old", title: "Synthesis ouder dan een week", body: "De laatste synthesis is meer dan 7 dagen oud. Overweeg om opnieuw te runnen.", kind: "warning", link: "/synthesis", created_at: (syn as any).updated_at, system: true });
    }
  } catch { /* table may not exist */ }
  try {
    const { count } = await supabase.from("entries").select("id", { count: "exact", head: true }).is("collection_id", null);
    if ((count ?? 0) > 0) {
      out.push({ id: "sys-orphans", title: `${count} entries zonder collectie`, body: "Er staan entries in de Data Bank die nog niet in een collectie zitten. Sorteer ze in de juiste collectie.", kind: "info", link: "/bank", created_at: new Date().toISOString(), system: true });
    }
  } catch { /* ignore */ }
  return out;
}
