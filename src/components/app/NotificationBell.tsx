import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Info, AlertTriangle, AlertOctagon, CheckCircle2, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  NOTIF_EVENT, loadStored, computeSystemAlerts, loadReadState, isUnread,
  enableNotifications, notify, markRead, markAllRead, sendTestNotification, type NotifRow, type NotifKind,
} from "@/lib/notify";

const KIND_ICON: Record<NotifKind, any> = { info: Info, warning: AlertTriangle, critical: AlertOctagon, success: CheckCircle2 };
const KIND_TONE: Record<NotifKind, string> = { info: "info", warning: "warn", critical: "bad", success: "ok" };
const rel = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "nu"; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}u`;
  return `${Math.floor(s / 86400)}d`;
};

export function NotificationBell() {
  const [items, setItems] = useState<NotifRow[]>([]);
  const [states, setStates] = useState<Record<string, { status: string }>>({});
  const [uid, setUid] = useState("");
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const id = user?.id ?? "";
    setUid(id);
    setStates(loadReadState(id));
    const [sys, stored] = await Promise.all([computeSystemAlerts(), loadStored(30)]);
    setItems([...sys, ...stored].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
  }, []);

  useEffect(() => {
    load();
    const onNotif = () => load();
    window.addEventListener(NOTIF_EVENT, onNotif);
    window.addEventListener("focus", onNotif);
    return () => { window.removeEventListener(NOTIF_EVENT, onNotif); window.removeEventListener("focus", onNotif); };
  }, [load]);

  // Only the still-open (unread) notifications live in the bell. Read/opened ones drop out.
  const open = items.filter((n) => isUnread(states, n.id));
  const unread = open.length;

  const enable = async () => {
    const p = await enableNotifications();
    setPerm(p);
    if (p === "granted") await notify({ title: "🔔 Meldingen staan aan", body: "Je krijgt nu push-meldingen, ook buiten dit scherm.", kind: "success", link: "/notifications" });
    else if (p === "denied") toast.error("Meldingen zijn geblokkeerd. Zet ze aan via het slot-icoon in de adresbalk.");
  };

  return (
    <Popover onOpenChange={(o) => o && load()}>
      <PopoverTrigger asChild>
        <button aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
          {unread > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Openstaande meldingen</p>
          {unread > 0
            ? <button onClick={() => markAllRead(uid, open.map((n) => n.id))} className="text-[11px] font-medium text-muted-foreground hover:text-primary flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5" /> Alles gelezen</button>
            : <span className="text-[11px] text-muted-foreground">alles bij</span>}
        </div>

        {perm !== "granted" && perm !== "unsupported" && (
          <button onClick={enable}
            className="w-full flex items-center gap-2 border-b border-border bg-primary/[0.04] px-3 py-2.5 text-left hover:bg-primary/[0.08] transition-colors">
            <BellRing className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-foreground flex-1">Zet push-meldingen aan om alerts ook buiten het scherm te krijgen.</span>
            <span className="text-[11px] font-semibold text-primary shrink-0">Aanzetten</span>
          </button>
        )}

        <div className="max-h-80 overflow-y-auto">
          {open.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="h-6 w-6 text-ok mx-auto mb-1.5" />
              <p className="text-xs text-muted-foreground">Geen openstaande meldingen.</p>
            </div>
          ) : (
            open.slice(0, 12).map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Info;
              const c = `hsl(var(--${KIND_TONE[n.kind] ?? "info"}))`;
              return (
                <Link key={n.id} to={n.link || "/notifications"} onClick={() => markRead(uid, n.id)}
                  className="flex gap-2.5 border-b border-border last:border-0 px-3 py-2.5 hover:bg-muted/50 transition-colors">
                  <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0 mt-0.5" style={{ background: `${c}18` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: c }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <p className="text-[13px] font-medium text-foreground truncate">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{rel(n.created_at)}</span>
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>}
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border">
          <button onClick={async () => { const p = await sendTestNotification(); setPerm(p === "unsupported" ? perm : p); if (p === "denied") toast.error("Push geblokkeerd — de melding staat wel in de lijst."); }}
            className="px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-primary">Test</button>
          <Link to="/notifications" className="px-3 py-2.5 text-xs font-medium text-primary hover:bg-muted/50">Alle meldingen →</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
