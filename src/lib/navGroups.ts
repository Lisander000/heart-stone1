// Shared navigation structure — used by the sidebar AND the member home launcher.
import type { ElementType } from "react";
import {
  Home, Database, FolderOpen, Sparkles, Users, Swords, Tag,
  ShoppingCart, PackageOpen, Truck, RotateCcw, LifeBuoy, HeartPulse, Bot, Wallet,
  Activity, Terminal, Lightbulb, PenLine, FlaskConical, Clapperboard, TrendingUp,
} from "lucide-react";

export type NavItem = { title: string; url: string; icon: ElementType };

export type NavGroup =
  | { label: string; collapsible: false; devOnly?: boolean; items: NavItem[] }
  | { label: string; collapsible: true; devOnly?: boolean; pinnedItems: NavItem[]; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    collapsible: false,
    items: [{ title: "Home", url: "/", icon: Home }],
  },
  {
    label: "Finance",
    collapsible: true,
    pinnedItems: [],
    items: [
      { title: "Daily Tracker", url: "/daily-tracker", icon: Activity },
      { title: "Financial Overview", url: "/finance", icon: Wallet },
      { title: "Forecast vs Actual", url: "/finance/forecast", icon: TrendingUp },
    ],
  },
  {
    label: "Creative",
    collapsible: true,
    pinnedItems: [],
    items: [
      { title: "Concepts", url: "/creative/concepts", icon: Lightbulb },
      { title: "Ad Copies", url: "/creative/ad-copies", icon: PenLine },
      { title: "Testing Tracker", url: "/creative/testing", icon: FlaskConical },
      { title: "UGC / creators", url: "/creative/ugc", icon: Clapperboard },
    ],
  },
  {
    label: "Research",
    collapsible: true,
    pinnedItems: [],
    items: [
      { title: "Data Bank", url: "/bank", icon: Database },
      { title: "Collections", url: "/collections", icon: FolderOpen },
      { title: "Synthesis", url: "/synthesis", icon: Sparkles },
    ],
  },
  {
    label: "Strategy",
    collapsible: true,
    pinnedItems: [],
    items: [
      { title: "ICP", url: "/icp", icon: Users },
      { title: "Competitors", url: "/competitors", icon: Swords },
      { title: "Offers", url: "/offers", icon: Tag },
    ],
  },
  {
    label: "Operations",
    collapsible: true,
    pinnedItems: [],
    items: [
      { title: "Orders", url: "/orders", icon: ShoppingCart },
      { title: "Unfulfilled", url: "/unfulfilled", icon: PackageOpen },
      { title: "Shipments", url: "/shipments", icon: Truck },
      { title: "Returns", url: "/returns", icon: RotateCcw },
      { title: "Tickets", url: "/tickets", icon: LifeBuoy },
      { title: "Product Health", url: "/product-health", icon: HeartPulse },
    ],
  },
  {
    label: "Developer",
    collapsible: true,
    devOnly: true,
    pinnedItems: [],
    items: [
      { title: "Dev dashboard", url: "/developer", icon: Terminal },
      { title: "Agents", url: "/agents", icon: Bot },
    ],
  },
];
