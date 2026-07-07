import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Status = "loading" | "authenticated" | "unauthenticated";

async function checkAAL(): Promise<Status> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "unauthenticated";
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return aal?.currentLevel === "aal2" ? "authenticated" : "unauthenticated";
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const location = useLocation();

  useEffect(() => {
    // Single AAL check on mount
    checkAAL().then(setStatus);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Only re-evaluate on sign-in/sign-out — not on TOKEN_REFRESHED or USER_UPDATED,
      // which would kick the user out mid-session.
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        setStatus("unauthenticated");
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        checkAAL().then(setStatus);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    const returnTo = location.pathname + location.search + location.hash;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
}
