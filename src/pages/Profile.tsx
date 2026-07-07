import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp } from "@/lib/motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { useIsSuperUser } from "@/lib/superuser";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const iAmSuper = useIsSuperUser();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? "");
      setFullName(user?.user_metadata?.full_name ?? "");
      setAvatarUrl(user?.user_metadata?.avatar_url ?? "");
      setLoading(false);
    })();
  }, []);

  const initials = (fullName || email).slice(0, 2).toUpperCase();
  const signOut = async () => {
    setSigningOut(true);
    try { await supabase.auth.signOut(); window.location.href = "/auth"; }
    finally { setSigningOut(false); }
  };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">Account</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-primary">Mijn profiel</h1>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-2xl ring-2 ring-card shadow-sm">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName || email} />}
              <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground text-lg font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground truncate">{fullName || email.split("@")[0]}</p>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              {iAmSuper && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                  <ShieldCheck className="h-3 w-3" /> Super user
                </span>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card-soft p-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Gegevens</h2>
          <Row icon={User} label="Naam" value={fullName || "—"} />
          <Row icon={Mail} label="E-mail" value={email || "—"} />
        </motion.div>

        <button
          onClick={signOut}
          disabled={signingOut}
          className="h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-bad hover:border-bad/40 inline-flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {signingOut ? "Bezig…" : "Uitloggen"}
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="text-sm text-foreground truncate">{value}</span>
    </div>
  );
}
