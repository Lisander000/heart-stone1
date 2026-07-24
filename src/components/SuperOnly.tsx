// Gate a route/page to super users (developers). While the signed-in email is still
// resolving we show a spinner; non-super users get a friendly access-denied card.
import type { ReactNode } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useCurrentUserEmail, useSuperUsers } from "@/lib/superuser";

export function SuperOnly({ children }: { children: ReactNode }) {
  const email = useCurrentUserEmail();
  const supers = useSuperUsers();

  if (email === null) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  const ok = supers.some((e) => e.toLowerCase() === email.toLowerCase());
  if (!ok) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card-soft p-8 max-w-sm text-center">
          <span className="h-12 w-12 rounded-2xl grid place-items-center bg-muted mx-auto mb-4"><Lock className="h-6 w-6 text-muted-foreground" /></span>
          <h1 className="font-display text-lg font-bold text-foreground mb-1.5">Alleen voor developers</h1>
          <p className="text-sm text-muted-foreground">Deze pagina is enkel toegankelijk voor super users. Vraag een developer om je toegang te geven via het Developer-dashboard.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
