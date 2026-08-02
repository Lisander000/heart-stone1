import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fadeUp, stagger } from "@/lib/motion";
import { Plus, Shield, Star, RefreshCw, Trash2, UsersRound, Pencil, Check, SlidersHorizontal, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useIsSuperUser, useCurrentUser, isSuperUser, setSuperUser, useSuperUsers, SUPERUSER_BLOCK } from "@/lib/superuser";
import { CATEGORIES, DEFAULT_CATEGORIES, getUserAccess, setUserAccess, useAllAccess, useActiveMembers } from "@/lib/access";
import { authRedirectUrl } from "@/lib/siteUrl";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accessMember, setAccessMember] = useState<Member | null>(null);
  const skipSave = useRef(false);

  const iAmSuper = useIsSuperUser();
  const me = useCurrentUser();
  useSuperUsers(); // subscribe so the members table reflects super-user toggles live
  const accessMap = useAllAccess(); // subscribe so the access column updates live

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUid(user?.id ?? "");
    // Shared roster via the admin function so EVERY user sees the whole team — team_members
    // RLS otherwise limits rows to the ones a user created. Falls back to direct/local.
    try {
      const { data, error } = await supabase.functions.invoke("manage-access", { body: { action: "roster" } });
      const roster = (data as any)?.members;
      if (!error && Array.isArray(roster)) {
        setMembers(roster as Member[]);
        setBackend("supabase");
        setLoading(false);
        return;
      }
    } catch { /* fall through to direct/local */ }
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
    // Super users onboard a real login. A passwordless magic link also provisions the
    // account (shouldCreateUser) — no server/edge function needed. The person clicks the
    // emailed link, lands on /auth and is forced to set their own permanent password.
    if (iAmSuper && row.email) {
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: row.email,
          options: {
            shouldCreateUser: true,
            data: { full_name: row.name, must_change_password: true },
            emailRedirectTo: authRedirectUrl(),
          },
        });
        if (error) throw error;
        toast.success(`Inloglink verstuurd naar ${row.email}.`);
      } catch (e: any) {
        toast.error(`Teamlid toegevoegd, maar de e-mail is niet verstuurd: ${e.message || e}`);
      }
    }
  };
  const removeMember = async (id: string) => {
    const next = members.filter((m) => m.id !== id);
    setMembers(next);
    if (backend === "local") persistLocal(next);
    else await (supabase as any).from("team_members").delete().eq("id", id);
  };

  const saveRole = async (id: string, value: string) => {
    setEditingId(null);
    const cur = members.find((m) => m.id === id);
    const role = value.trim();
    if (!cur || !role || role === cur.role) return;
    const next = members.map((m) => (m.id === id ? { ...m, role } : m));
    setMembers(next);
    if (backend === "local") persistLocal(next);
    else { const { error } = await (supabase as any).from("team_members").update({ role }).eq("id", id); if (error) { toast.error(error.message); return; } }
    toast.success(`Rol bijgewerkt naar "${role}".`);
  };

  const toggleSuper = (email: string | null) => {
    if (!email) { toast.error("Dit teamlid heeft geen e-mail — voeg er een toe."); return; }
    if (!iAmSuper) { toast.error(SUPERUSER_BLOCK); return; }
    const on = !isSuperUser(email);
    setSuperUser(email, on);
    toast.success(on ? `${email} is nu super user.` : `Super user verwijderd voor ${email}.`);
  };

  const [resetMember, setResetMember] = useState<Member | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const resetMfa = async (m: Member | null) => {
    if (!m) return;
    if (!iAmSuper) { toast.error(SUPERUSER_BLOCK); return; }
    if (!m.email) { toast.error("Dit teamlid heeft geen e-mail."); return; }
    setResetting(m.id);
    try {
      const { data, error } = await supabase.functions.invoke("reset-mfa", { body: { email: m.email } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Authenticator gereset voor ${m.email}. Ze stellen bij de volgende login een nieuwe in.`);
    } catch (e: any) {
      toast.error(`Reset mislukt: ${e.message || e}. Is de reset-mfa functie gedeployed?`);
    } finally {
      setResetting(null);
    }
  };

  const [blockOpen, setBlockOpen] = useState(false);
  const activeMap = useActiveMembers();
  const GRID = "minmax(150px,1.4fr) minmax(190px,2fr) minmax(110px,0.85fr) 110px minmax(150px,1fr) 84px";

  return (
    <div className="min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-7 space-y-5">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <div className="flex items-center gap-2.5">
              <span className="h-10 w-10 rounded-2xl grid place-items-center bg-primary/10"><UsersRound className="h-5 w-5 text-primary" /></span>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Operations</p>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Team</h1>
              </div>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Ververs</button>
            <button onClick={() => { if (!iAmSuper) { setBlockOpen(true); return; } setAddOpen(true); }} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all"><Plus className="h-4 w-4" /> Teamlid</button>
          </div>
        </div>

        {/* members table */}
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="grid bg-muted border-b border-border" style={{ gridTemplateColumns: GRID }}>
                {["Naam", "E-mail", "Rol", "Status", "Toegang", ""].map((h, i) => <div key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</div>)}
              </div>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 shimmer m-px" />)
              ) : members.length === 0 ? (
                <div className="py-16 text-center"><p className="text-sm font-semibold text-foreground mb-1">Nog geen teamleden</p><p className="text-xs text-muted-foreground">Voeg er een toe met 'Teamlid'.</p></div>
              ) : (
                <motion.div variants={stagger(0.02)} initial="hidden" animate="visible" className="divide-y divide-border/50">
                  {members.map((m) => {
                    const su = isSuperUser(m.email);
                    const isMe = !!m.email && !!me.email && m.email.toLowerCase() === me.email.toLowerCase();
                    const shownStatus = (m.status === "invited" && activeMap[(m.email || "").toLowerCase()]) ? "active" : m.status;
                    return (
                      <motion.div key={m.id} variants={fadeUp} className="group grid items-center hover:bg-muted/40 transition-colors" style={{ gridTemplateColumns: GRID }}>
                        <div className="px-4 py-3 flex items-center gap-1.5 min-w-0">
                          <span className="text-[13px] font-medium text-foreground truncate">{isMe && me.name ? me.name : (m.name || "—")}</span>
                          {isMe && <span className="text-[10px] font-semibold text-primary/70 shrink-0">(jij)</span>}
                          <button onClick={() => toggleSuper(m.email)} disabled={!iAmSuper}
                            title={su ? (iAmSuper ? "Super user — klik om te verwijderen" : "Super user") : iAmSuper ? "Maak super user" : ""}
                            className={`shrink-0 transition-colors disabled:cursor-default ${su ? "text-ok" : iAmSuper ? "text-transparent group-hover:text-muted-foreground/40 hover:!text-ok cursor-pointer" : "hidden"}`}>
                            <Star className={`h-3.5 w-3.5 ${su ? "fill-current" : ""}`} />
                          </button>
                        </div>
                        <div className="px-4 py-3 text-[13px] text-muted-foreground break-words">{m.email || "—"}</div>
                        <div className="px-4 py-3">
                          {editingId === m.id ? (
                            <input
                              autoFocus
                              defaultValue={m.role}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={(e) => { if (skipSave.current) { skipSave.current = false; setEditingId(null); } else saveRole(m.id, e.currentTarget.value); }}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } else if (e.key === "Escape") { e.preventDefault(); skipSave.current = true; e.currentTarget.blur(); } }}
                              className="h-7 w-full max-w-[150px] px-2 rounded-lg border border-primary/40 bg-card text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary/25"
                            />
                          ) : (
                            <button type="button" onClick={() => { if (!iAmSuper) { setBlockOpen(true); return; } setEditingId(m.id); }} title={iAmSuper ? "Klik om de rol te wijzigen" : "Alleen super users kunnen dit aanpassen"} className="group/role inline-flex items-center gap-1 rounded-full hover:ring-2 hover:ring-primary/20 transition cursor-text">
                              <Pill value={m.role} tone={roleTone(m.role)} />
                              <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover/role:text-muted-foreground/60 transition-colors shrink-0" />
                            </button>
                          )}
                        </div>
                        <div className="px-4 py-3"><Pill value={shownStatus} tone={statusTone(shownStatus)} /></div>
                        <div className="px-4 py-3">
                          {su ? (
                            <span className="text-[11px] text-muted-foreground">Alle categorieën</span>
                          ) : (
                            <button onClick={() => setAccessMember(m)} disabled={!iAmSuper || !m.email}
                              title={!m.email ? "Voeg eerst een e-mail toe" : iAmSuper ? "Toegang bewerken" : SUPERUSER_BLOCK}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors">
                              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" /> {(accessMap[(m.email || "").toLowerCase()] ?? DEFAULT_CATEGORIES).length}/{CATEGORIES.length} categorieën
                            </button>
                          )}
                        </div>
                        <div className="px-2 flex items-center justify-end gap-0.5">
                          {iAmSuper && m.email && (
                            <button onClick={() => setResetMember(m)} disabled={resetting === m.id}
                              title="Authenticator (MFA) resetten — bij verloren authenticator" aria-label="Reset MFA"
                              className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-primary disabled:opacity-50 transition-colors">
                              {resetting === m.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            </button>
                          )}
                          <button onClick={() => { if (!iAmSuper) { setBlockOpen(true); return; } setDeleteId(m.id); }} aria-label="Verwijderen" className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-bad transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
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
      <AccessDialog member={accessMember} onClose={() => setAccessMember(null)} canEdit={iAmSuper} />
      <ConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} onConfirm={() => { if (deleteId) removeMember(deleteId); setDeleteId(null); }} title="Teamlid verwijderen?" description="Dit teamlid wordt permanent verwijderd." />
      <ConfirmDelete open={!!resetMember} onOpenChange={(o) => !o && setResetMember(null)} onConfirm={() => { const m = resetMember; setResetMember(null); resetMfa(m); }} title="Authenticator resetten?" description="De MFA-authenticator van dit teamlid wordt verwijderd. Bij de volgende login stellen ze een nieuwe in. Gebruik dit als iemand zijn authenticator kwijt is." />
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-sm">
          <div className="text-center space-y-3 py-1">
            <div className="mx-auto h-12 w-12 rounded-2xl grid place-items-center bg-primary/10"><Shield className="h-6 w-6 text-primary" /></div>
            <DialogHeader><DialogTitle className="font-display text-lg text-center">Alleen voor super users</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground leading-relaxed">Je kan zelf geen teamleden toevoegen of aanpassen. Ga naar je directe leidinggevende om dit te laten regelen.</p>
            <button onClick={() => setBlockOpen(false)} className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Begrepen</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pill({ value, tone }: { value: string; tone: string }) {
  const v = toneVar(tone);
  const c = `hsl(var(--${v}))`;
  return <span className="inline-flex items-center gap-1.5 rounded-full border pl-2 pr-2.5 py-1 text-[11px] font-semibold capitalize" style={{ background: `hsl(var(--${v}) / 0.1)`, color: c, borderColor: `hsl(var(--${v}) / 0.35)`, boxShadow: `0 1px 1.5px hsl(var(--${v}) / 0.08)` }}><span className="dot" style={{ background: c, width: 6, height: 6 }} />{value}</span>;
}

function AccessDialog({ member, onClose, canEdit }: { member: Member | null; onClose: () => void; canEdit: boolean }) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (member) setSel(getUserAccess(member.email)); }, [member]);
  if (!member) return null;
  const su = isSuperUser(member.email);
  const toggle = (c: string) => setSel((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const save = async () => {
    if (member.email) {
      try { await setUserAccess(member.email, sel); toast.success(`Toegang bijgewerkt voor ${member.name || member.email}.`); }
      catch (e: any) { toast.error(`Kon toegang niet opslaan: ${e.message || e}. Is de manage-access functie gedeployed?`); return; }
    }
    onClose();
  };
  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display text-lg">Toegang · {member.name || member.email || "teamlid"}</DialogTitle></DialogHeader>
        {!member.email ? (
          <p className="text-sm text-muted-foreground">Dit teamlid heeft nog geen e-mail — voeg er een toe om de toegang per categorie te bepalen.</p>
        ) : su ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-ok/20 bg-ok/[0.06] px-3 py-2.5"><Star className="h-4 w-4 text-ok shrink-0 mt-0.5" /><p className="text-[13px] text-foreground">Dit is een <span className="font-semibold">super user</span> — die ziet altijd alle categorieën, inclusief Development.</p></div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Vink de categorieën aan die {member.name || "deze gebruiker"} in de app ziet. De rest verdwijnt uit hun navigatie.</p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {CATEGORIES.map((c) => {
                const on = sel.includes(c);
                return (
                  <button key={c} type="button" onClick={() => canEdit && toggle(c)} disabled={!canEdit}
                    className="flex items-center gap-2.5 h-11 px-3 rounded-xl border text-[13px] font-medium transition-colors disabled:opacity-70"
                    style={on ? { borderColor: "hsl(var(--primary) / 0.5)", background: "hsl(var(--primary) / 0.06)", color: "hsl(var(--foreground))" } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                    <span className="h-4 w-4 rounded-md grid place-items-center border shrink-0" style={on ? { background: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" } : { borderColor: "hsl(var(--border))" }}>{on && <Check className="h-3 w-3 text-white" />}</span>
                    {c}
                  </button>
                );
              })}
            </div>
            {!canEdit && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 shrink-0" /> {SUPERUSER_BLOCK}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={onClose} className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">{canEdit ? "Annuleer" : "Sluit"}</button>
              {canEdit && <button onClick={save} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium">Opslaan</button>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
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
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Met een e-mailadres krijgt de persoon een uitnodigingsmail om in te loggen en zelf een vast wachtwoord in te stellen.</p>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">Annuleer</button>
          <button disabled={!name.trim()} onClick={() => onAdd({ name, email, role, status })} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"><Plus className="h-4 w-4" /> Toevoegen</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
