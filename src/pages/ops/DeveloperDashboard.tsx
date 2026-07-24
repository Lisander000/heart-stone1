// Developer dashboard — the one place for things a regular employee can't/shouldn't do:
// manage AI agents, super users and team members. Route is gated by <SuperOnly>.
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import { Terminal, Bot, UsersRound, ShieldCheck, Star, Plus, Trash2, ArrowRight } from "lucide-react";
import { useSuperUsers, setSuperUser, useCurrentUserEmail } from "@/lib/superuser";

const ROLES = ["owner", "admin", "member", "viewer"];
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const initials = (email: string) => email.split("@")[0].split(/[._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export default function DeveloperDashboard() {
  const supers = useSuperUsers();
  const myEmail = useCurrentUserEmail();

  /* ── super users ── */
  const [suEmail, setSuEmail] = useState("");
  const addSuper = () => {
    const e = suEmail.trim().toLowerCase();
    if (!emailOk(e)) { toast.error("Geef een geldig e-mailadres in."); return; }
    if (supers.some((x) => x.toLowerCase() === e)) { toast.error("Deze gebruiker is al super user."); return; }
    setSuperUser(e, true); setSuEmail("");
    toast.success(`${e} is nu super user.`);
  };
  const removeSuper = (e: string) => {
    if (supers.length <= 1) { toast.error("Er moet minstens één super user overblijven."); return; }
    setSuperUser(e, false);
    toast.success(`Super user verwijderd voor ${e}.`);
  };

  /* ── add team member ── */
  const [nm, setNm] = useState(""); const [em, setEm] = useState(""); const [role, setRole] = useState("member");
  const [adding, setAdding] = useState(false);
  const addMember = async () => {
    if (!nm.trim()) { toast.error("Geef een naam in."); return; }
    setAdding(true);
    const row = { id: crypto.randomUUID(), name: nm.trim(), email: em.trim() || null, role, status: "invited", invited_at: new Date().toISOString() };
    const { error: probe } = await (supabase as any).from("team_members").select("id").limit(1);
    if (probe) {
      const cur = (() => { try { return JSON.parse(localStorage.getItem("gb_team_members") || "[]"); } catch { return []; } })();
      localStorage.setItem("gb_team_members", JSON.stringify([...cur, row]));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("team_members").insert({ id: row.id, name: row.name, email: row.email, role: row.role, status: row.status, user_id: user?.id ?? null });
      if (error) { toast.error(error.message); setAdding(false); return; }
    }
    setNm(""); setEm(""); setRole("member"); setAdding(false);
    toast.success(`${row.name} toegevoegd — beheer verder op de Team-pagina.`);
  };

  const IN = "h-9 w-full px-3 rounded-lg border border-border bg-card text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition";

  return (
    <div className="min-h-screen">
      <div className="w-full max-w-[1100px] mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-2.5">
          <span className="h-10 w-10 rounded-2xl grid place-items-center bg-primary/10"><Terminal className="h-5 w-5 text-primary" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Developer</h1>
            <p className="text-sm text-muted-foreground">Beheer wat een gewone werknemer niet kan of hoeft — agents, super users &amp; gebruikers.</p>
          </div>
        </motion.div>

        <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* SUPER USERS */}
          <motion.div variants={fadeUp} className="card-soft p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-ok" />
              <h2 className="text-sm font-semibold text-foreground">Super users</h2>
              <span className="ml-auto text-[11px] font-medium text-muted-foreground tabular-nums">{supers.length}</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1.5">Super users kunnen beschermde instellingen aanpassen en dit dashboard openen.</p>
            <div className="space-y-1.5">
              {supers.map((e) => {
                const me = !!myEmail && e.toLowerCase() === myEmail.toLowerCase();
                return (
                  <div key={e} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2">
                    <span className="h-7 w-7 rounded-full bg-ok/12 text-ok grid place-items-center text-[10px] font-bold shrink-0">{initials(e)}</span>
                    <span className="text-[13px] text-foreground truncate">{e}</span>
                    {me && <span className="text-[10px] font-semibold text-ok bg-ok/12 rounded-full px-1.5 py-0.5 shrink-0">jij</span>}
                    <button onClick={() => removeSuper(e)} title="Super user verwijderen" className="ml-auto h-7 w-7 grid place-items-center rounded-lg text-muted-foreground/60 hover:!text-bad hover:bg-bad/8 transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input value={suEmail} onChange={(e) => setSuEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSuper(); }} placeholder="naam@gooodboys.com" className={IN} />
              <button onClick={addSuper} className="h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all shrink-0"><Star className="h-4 w-4" /> Maak super</button>
            </div>
          </motion.div>

          {/* ADD TEAM MEMBER */}
          <motion.div variants={fadeUp} className="card-soft p-5 space-y-4">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Gebruiker toevoegen</h2>
              <Link to="/team" className="ml-auto text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-0.5">Volledig teambeheer <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <p className="text-xs text-muted-foreground -mt-1.5">Voeg een nieuw teamlid toe. Rollen aanpassen en verwijderen doe je op de Team-pagina.</p>
            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Naam</label>
                <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Voornaam Achternaam" className={IN} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <input value={em} onChange={(e) => setEm(e.target.value)} placeholder="naam@gooodboys.com" className={IN} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rol</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className={`${IN} capitalize`}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              </div>
              <button onClick={addMember} disabled={adding || !nm.trim()} className="h-9 w-full px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all"><Plus className="h-4 w-4" /> Teamlid toevoegen</button>
            </div>
          </motion.div>

          {/* AGENTS */}
          <motion.div variants={fadeUp} className="lg:col-span-2">
            <Link to="/agents" className="group card-soft p-5 flex items-center gap-4 hover:shadow-md transition-all">
              <span className="h-11 w-11 rounded-2xl grid place-items-center bg-grape/12 shrink-0"><Bot className="h-5 w-5" style={{ color: "hsl(var(--grape))" }} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground">AI-agents</h2>
                <p className="text-xs text-muted-foreground">Configureer de automatische agents. Enkel zichtbaar voor developers.</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
