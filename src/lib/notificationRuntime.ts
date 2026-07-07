// Background runtime for notifications: registers the service worker and
// periodically checks reminder conditions (e.g. Daily Tracker not filled today).
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify, registerServiceWorker } from "./notify";

const todayISO = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, local

async function dailyTrackerFilled(date: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any).from("daily_metrics").select("date").eq("date", date).limit(1);
    if (!error && data && data.length) return true;
  } catch { /* table may not exist */ }
  try { return (JSON.parse(localStorage.getItem("gb_daily_metrics") || "[]") as any[]).some((d) => d.date === date); } catch { return false; }
}

async function runChecks() {
  const date = todayISO();
  const hour = new Date().getHours();
  // Remind to fill the Daily Tracker (from 09:00), once per day.
  if (hour >= 9 && !(await dailyTrackerFilled(date))) {
    await notify({
      title: "Daily Tracker nog niet ingevuld",
      body: `Vul de cijfers van vandaag (${new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long" })}) nog in.`,
      kind: "warning",
      link: "/daily-tracker",
      dedupeKey: `daily-${date}`,
    });
  }
}

export function useNotificationRuntime() {
  useEffect(() => {
    registerServiceWorker();
    runChecks();
    const iv = setInterval(runChecks, 30 * 60 * 1000); // re-check every 30 min
    const onFocus = () => runChecks();
    const onVis = () => { if (document.visibilityState === "visible") runChecks(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}
