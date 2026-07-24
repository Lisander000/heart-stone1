import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  ShoppingCart, PackageOpen, Truck, RotateCcw, LifeBuoy, HeartPulse,
  Bot, UsersRound, BarChart3, Loader2,
} from "lucide-react";

const tiles = [
  { title: "Orders", url: "/orders", icon: ShoppingCart, table: "orders" },
  { title: "Unfulfilled", url: "/unfulfilled", icon: PackageOpen, table: "orders", filter: { status: "unfulfilled" } },
  { title: "Shipments", url: "/shipments", icon: Truck, table: "shipments" },
  { title: "Returns", url: "/returns", icon: RotateCcw, table: "returns" },
  { title: "Returns dashboard", url: "/returns/dashboard", icon: BarChart3, table: "returns" },
  { title: "Tickets", url: "/tickets", icon: LifeBuoy, table: "tickets" },
  { title: "Product Health", url: "/product-health", icon: HeartPulse, table: "product_health" },
  { title: "Team", url: "/team", icon: UsersRound, table: "team_members" },
];

export default function OpsOverview() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const c: Record<string, number> = {};
      await Promise.all(tiles.map(async (t) => {
        try {
          let q: any = (supabase as any).from(t.table).select("*", { count: "exact", head: true });
          if (t.filter) for (const [k, v] of Object.entries(t.filter)) q = q.eq(k, v);
          const { count } = await q;
          c[t.url] = count ?? 0;
        } catch { c[t.url] = 0; }
      }));
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">Operations</div>
        <h1 className="font-display text-3xl text-primary">Ops overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle Order Hero modules op één plek. Klik door voor CRUD, timelines en dashboards.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.url} to={t.url} className="group">
            <Card className="p-5 h-full transition-colors group-hover:border-primary/40">
              <div className="flex items-center justify-between">
                <t.icon className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : (counts[t.url] ?? 0)}
                </span>
              </div>
              <div className="mt-3 font-display text-lg">{t.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t.url}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
