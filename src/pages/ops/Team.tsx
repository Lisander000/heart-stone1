import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp, stagger } from "@/lib/motion";
import { Plus, Shield, ShieldCheck, Star, RefreshCw, Trash2, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useIsSuperUser, useCurrentUserEmail, isSuperUser, setSuperUser, useSuperUsers, SUPERUSER_BLOCK } from "@/lib/superuser";

type Member = { id: string; name: string; email: string | null; role: string; status: string; invited_at?: string };
const ROLES = ["owner", "admin", "member", "viewer"];
const STATUSES = ["invited", "active", "suspended"];
const LS = "gb_team_members";

async function detectBackend(): Promise<"supabase" | "local"> {
  const { error } = await (supabase as any).from("team_members").select("id").limit(1);
  return error ? "local" : "supabase";
}
const roleTone = (r: string) => r === "owner" ? "grape" : r === "admin" ? "info" : r === "viewer" ? "idle" : "ok";
const statusTone = (s: string) => s === "active" ? "ok" : s === "suspended" ? "bad" : "warn";
const toneVar = (t: string) => t === "ok" ? "ok" : t === "bad" ? "bad" : t === "warn" ? "warn" : t === "info" ? "info" : t === "grape" ? "grape" : "muted-foreground";

export default function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "local">("local");
  const [uid, setUid] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const iAmSuper = useIsSuperUser();
  const myEmail = useCurrentUserEmail();
  const superList = useSuperUsers();

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUid(user?.id ?? "");
    const be = await detectBackend();
    setBackend(be);
    if (be === "supabase") {
      const { data } = await (supabase as any).from("team_members").select("*").order("created_at", { ascending: true });
      setMembers((data ?? []) as Member[]);
    } else {
      try { setMembers(JSON.parse(localStorage.getItem(LS) || "[]")); } catch { setMembers([]); }
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const persistLocal = (next: Member[]) => localStorage.setItem(LS, JSON.stringify(next));

  const addMember = async (draft: { name: string; email: string; role: string; status: string }) => {
    const row: Member = { id: crypto.randomUUID(), name: draft.name.trim(), email: draft.email.trim() || null, role: draft.role, status: draft.status, invited_at: new Date().toISOString() };
    const next = [...members, row];
    setMembers(next);
    if (backend === "local") persistLocal(next);
    else { const { error } = await (supabase as any).from("team_members").insert({ id: row.id, name: row.name, email: row.email, role: row.role, status: row.status, user_id: uid }); if (error) toast.error(error.message); }
    setAddOpen(false);
  };
  const removeMember = async (id: string) => {
    const next = members.filter((m) => m.id !== id);
    setMembers(next);
    if (backend === "local") persistLocal(next);
    else await (supabase as any).from("team_members").delete().eq("id", id);
  };

  const toggleSuper = (email: string | null) => {
    if (!email) { toast.error("Dit teamlid heeft geen e-mail — voeg er een toe."); return; }
    if (!iAmSuper) { toast.error(SUPERUSER_BLOCK); return; }
    const on = !isSuperUser(email);
    setSuperUser(email, on);
    toast.success(on ? `${email} is nu super user.` : `Super user verwijderd voor ${email}.`);
  };

  const superCount = useMemo(() => members.filter((m) => isSuperUser(m.email)).length, [members, superList]);
  const GRID = "minmax(140px,1.4fr) minmax(200px,2.2fr) 120px 120px 130px 44px";

  return (
    <div className="min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <div className="flex items-center gap-2.5">
              <span className="h-10 w-10 rounded-2xl grid place-items-center bg-primary/10"><UsersRound className="h-5 w-5 text-primary" /></span>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Team</h1>
                <p className="text-sm text-muted-foreground">Teamleden, rollen &amp; super users</p>
              </div>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Ververs</button>
            <button onClick={() => setAddOpen(true)} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all"><Plus className="h-4 w-4" /> Teamlid</button>
          </div>
        </div>

        {/* your status */}
        <div className="card-soft p-4 flex items-center gap-3">
          <span className="h-10 w-10 rounded-2xl grid place-items-center" style={{ background: iAmSuper ? "hsl(var(--ok)/0.14)" : "hsl(var(--muted))" }}>
            {iAmSuper ? <ShieldCheck className="h-5 w-5 text-ok" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{iAmSuper ? "Jij bent super user" : "Jij bent een standaard gebruiker"}</p>
            <p className="text-xs text-muted-foreground">{myEmail || "—"} · {iAmSuper ? "je kunt beschermde instellingen aanpassen (zoals het returns-stappenplan)" : "beschermde instellingen zijn alleen-lezen voor jou"}</p>
          </div>
          <span className="ml-auto text-xs text-muted-foreground shrink-0">{superCount} super user{superCount === 1 ? "" : "s"}</span>
        </div>

        {/* members table */}
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="grid bg-muted border-b border-border" style={{ gridTemplateColumns: GRID }}>
                {["Naam", "E-mail", "Rol", "Status", "Super user", ""].map((h, i) => <div key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</div>)}
              </div>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 shimmer m-px" />)
              ) : members.length === 0 ? (
                <div className="py-16 text-center"><p className="text-sm font-semibold text-foreground mb-1">Nog geen teamleden</p><p className="text-xs text-muted-foreground">Voeg er een toe met 'Teamlid'.</p></div>
              ) : (
                <motion.div variants={stagger(0.02)} initial="hidden" animate="visible" className="divide-y divide-border/50">
                  {members.map((m) => {
                    const su = isSuperUser(m.email);
                    return (
                      <motion.div key={m.id} variants={fadeUp} className="group grid items-center hover:bg-muted/40 transition-colors" style={{ gridTemplateColumns: GRID }}>
                        <div className="px-4 py-3 text-[13px] font-medium text-foreground break-words">{m.name || "—"}</div>
                        <div className="px-4 py-3 text-[13px] text-muted-foreground break-words">{m.email || "—"}</div>
                        <div className="px-4 py-3"><Pill value={m.role} tone={roleTone(m.role)} /></div>
                        <div className="px-4 py-3"><Pill value={m.status} tone={statusTone(m.status)} /></div>
                        <div className="px-4 py-3">
                          <button onClick={() => toggleSuper(m.email)}
                            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium transition-all ${su ? "text-ok" : "text-muted-foreground hover:text-foreground"}`}
                            style={su ? { background: "hsl(var(--ok)/0.14)" } : { background: "hsl(var(--muted))" }}
                            title={iAmSuper ? "Klik om super user aan/uit te zetten" : SUPERUSER_BLOCK}>
                            <Star className={`h-3.5 w-3.5 ${su ? "fill-current" : ""}`} /> {su ? "Super user" : "Standaard"}
                          </button>
                        </div>
                        <button onClick={() => setDeleteId(m.id)} className="px-2 grid place-items-center text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-bad transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </div>
        </div>
        {!iAmSuper && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 shrink-0" /> {SUPERUSER_BLOCK}</p>}
      </div>

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addMember} />
      <ConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} onConfirm={() => { if (deleteId) removeMember(deleteId); setDeleteId(null); }} title="Teamlid verwijderen?" description="Dit teamlid wordt permanent verwijderd." />
    </div>
  );
}

function Pill({ value, tone }: { value: string; tone: string }) {
  const v = toneVar(tone);
  const c = `hsl(var(--${v}))`;
  return <span className="inline-flex items-center gap-1.5 rounded-full border pl-2 pr-2.5 py-1 text-[11px] font-semibold capitalize" style={{ background: `hsl(var(--${v}) / 0.1)`, color: c, borderColor: `hsl(var(--${v}) / 0.35)`, boxShadow: `0 1px 1.5px hsl(var(--${v}) / 0.08)` }}><span className="dot" style={{ background: c, width: 6, height: 6 }} />{value}</span>;
}

function AddMemberDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (d: { name: string; email: string; role: string; status: string }) => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState("member"); const [status, setStatus] = useState("invited");
  useEffect(() => { if (open) { setName(""); setEmail(""); setRole("member"); setStatus("invited"); } }, [open]);
  const IN = "mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-ring/50";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display text-lg">Nieuw teamlid</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-muted-foreground">Naam</label><input value={name} onChange={(e) => setName(e.target.value)} className={IN} placeholder="Voornaam Achternaam" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">E-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={IN} placeholder="naam@gooodboys.com" /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="text-xs font-medium text-muted-foreground">Rol</label><select value={role} onChange={(e) => setRole(e.target.value)} className={`${IN} capitalize`}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className="flex-1"><label className="text-xs font-medium text-muted-foreground">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={`${IN} capitalize`}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">Annuleer</button>
          <button disabled={!name.trim()} onClick={() => onAdd({ name, email, role, status })} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"><Plus className="h-4 w-4" /> Toevoegen</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
