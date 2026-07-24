import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Home, Activity, Wallet, TrendingUp, Lightbulb, PenLine, FlaskConical, Clapperboard,
  Database, FolderOpen, Sparkles, Users, Swords, Tag, ShoppingCart, PackageOpen, Truck,
  RotateCcw, BarChart3, LifeBuoy, HeartPulse, Bot, UsersRound, LayoutGrid, User,
} from "lucide-react";

type Dest = { label: string; to: string; icon: React.ElementType; group: string };

const DESTS: Dest[] = [
  { label: "Home", to: "/", icon: Home, group: "Overview" },
  { label: "Daily Tracker", to: "/daily-tracker", icon: Activity, group: "Finance" },
  { label: "Financial Overview", to: "/finance", icon: Wallet, group: "Finance" },
  { label: "Forecast vs Actual", to: "/finance/forecast", icon: TrendingUp, group: "Finance" },
  { label: "Concepts", to: "/creative/concepts", icon: Lightbulb, group: "Creative" },
  { label: "Ad Copies", to: "/creative/ad-copies", icon: PenLine, group: "Creative" },
  { label: "Testing Tracker", to: "/creative/testing", icon: FlaskConical, group: "Creative" },
  { label: "UGC", to: "/creative/ugc", icon: Clapperboard, group: "Creative" },
  { label: "Data Bank", to: "/bank", icon: Database, group: "Research" },
  { label: "Collections", to: "/collections", icon: FolderOpen, group: "Research" },
  { label: "Synthesis", to: "/synthesis", icon: Sparkles, group: "Research" },
  { label: "ICP", to: "/icp", icon: Users, group: "Strategy" },
  { label: "Competitors", to: "/competitors", icon: Swords, group: "Strategy" },
  { label: "Offers", to: "/offers", icon: Tag, group: "Strategy" },
  { label: "Ops overview", to: "/ops", icon: LayoutGrid, group: "Operations" },
  { label: "Orders", to: "/orders", icon: ShoppingCart, group: "Operations" },
  { label: "Unfulfilled", to: "/unfulfilled", icon: PackageOpen, group: "Operations" },
  { label: "Shipments", to: "/shipments", icon: Truck, group: "Operations" },
  { label: "Returns", to: "/returns", icon: RotateCcw, group: "Operations" },
  { label: "Returns dashboard", to: "/returns/dashboard", icon: BarChart3, group: "Operations" },
  { label: "Tickets", to: "/tickets", icon: LifeBuoy, group: "Operations" },
  { label: "Product Health", to: "/product-health", icon: HeartPulse, group: "Operations" },
  { label: "Team", to: "/team", icon: UsersRound, group: "Operations" },
  { label: "Mijn profiel", to: "/profile", icon: User, group: "Account" },
];

const GROUPS = ["Overview", "Finance", "Creative", "Research", "Strategy", "Operations", "Account"];

/** Global ⌘K / Ctrl+K command-palette toggle. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const go = (to: string) => { onOpenChange(false); navigate(to); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Zoek een pagina…" />
      <CommandList>
        <CommandEmpty>Niets gevonden.</CommandEmpty>
        {GROUPS.map((group, gi) => {
          const items = DESTS.filter((d) => d.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((d) => (
                  <CommandItem key={d.to} value={`${d.label} ${d.to}`} onSelect={() => go(d.to)}>
                    <d.icon className="mr-2 h-4 w-4" />
                    <span>{d.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
