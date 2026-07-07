import { Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen grid place-items-center bg-background px-6 text-center">
      <div>
        <p className="font-display text-6xl font-bold text-primary">404</p>
        <p className="mt-2 text-lg font-semibold text-foreground">Pagina niet gevonden</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{pathname}</span> bestaat niet (meer).
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:shadow-md transition-all"
        >
          <Home className="h-4 w-4" /> Terug naar Home
        </Link>
      </div>
    </div>
  );
}
