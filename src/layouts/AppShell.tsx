import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { SidebarToggle } from "@/components/app/SidebarToggle";
import { CommandPalette, useCommandPalette } from "@/components/app/CommandPalette";
import { NotificationBell } from "@/components/app/NotificationBell";
import { useNotificationRuntime } from "@/lib/notificationRuntime";
import { Search } from "lucide-react";
import { pageTransition } from "@/lib/motion";

const ROUTE_TITLES: Record<string, { eyebrow: string; title: string }> = {
  "/":               { eyebrow: "Overview",   title: "Home" },
  "/daily-tracker":  { eyebrow: "Finance",     title: "Daily Tracker" },
  "/creative/concepts":  { eyebrow: "Creative", title: "Concepts" },
  "/creative/ad-copies": { eyebrow: "Creative", title: "Ad Copies" },
  "/creative/testing":   { eyebrow: "Creative", title: "Testing Tracker" },
  "/creative/ugc":       { eyebrow: "Creative", title: "UGC" },
  "/bank":           { eyebrow: "Research",   title: "Data Bank" },
  "/collections":    { eyebrow: "Research",   title: "Collections" },
  "/synthesis":      { eyebrow: "Research",   title: "Synthesis" },
  "/entries":        { eyebrow: "Research",   title: "Entries" },
  "/icp":            { eyebrow: "Strategy",   title: "ICP" },
  "/competitors":    { eyebrow: "Strategy",   title: "Competitors" },
  "/offers":         { eyebrow: "Strategy",   title: "Offers" },
  "/profile":        { eyebrow: "Account",    title: "Mijn profiel" },
  "/ops":            { eyebrow: "Operations", title: "Overview" },
  "/orders":         { eyebrow: "Operations", title: "Orders" },
  "/unfulfilled":    { eyebrow: "Operations", title: "Unfulfilled" },
  "/shipments":      { eyebrow: "Operations", title: "Shipments" },
  "/returns/dashboard": { eyebrow: "Operations", title: "Returns dashboard" },
  "/returns":        { eyebrow: "Operations", title: "Returns" },
  "/tickets":        { eyebrow: "Operations", title: "Tickets" },
  "/product-health": { eyebrow: "Operations", title: "Product Health" },
  "/agents":         { eyebrow: "Operations", title: "Agents" },
  "/finance":        { eyebrow: "Finance",     title: "Financial Overview" },
  "/finance/forecast": { eyebrow: "Finance",   title: "Forecast vs Actual" },
  "/notifications":  { eyebrow: "Operations", title: "Notifications" },
  "/team":           { eyebrow: "Operations", title: "Team" },
};

const OPS_TABLE_LABELS: Record<string, string> = {
  shipments: "Shipments", returns: "Returns", tickets: "Tickets",
  finance_entries: "Financial Overview", product_health: "Product Health", agents: "Agents",
  team_members: "Team", notifications_inbox: "Notifications", orders: "Orders",
};

function crumbFor(pathname: string) {
  // /ops/<table>/<...> → derive title from the table segment
  const opsMatch = pathname.match(/^\/ops\/([a-z_]+)(?:\/(.+))?$/);
  if (opsMatch) {
    const label = OPS_TABLE_LABELS[opsMatch[1]] ?? "Record";
    const rest = opsMatch[2] ?? "";
    const action = rest === "new" ? "Nieuw" : rest.endsWith("/edit") ? "Bewerken" : "Detail";
    return { eyebrow: `Operations · ${label}`, title: action };
  }
  const keys = Object.keys(ROUTE_TITLES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k === "/" ? pathname === "/" : pathname.startsWith(k)) return ROUTE_TITLES[k];
  }
  return { eyebrow: "Gooodboys", title: "Workspace" };
}

export default function AppShell() {
  const { pathname } = useLocation();
  const { open, setOpen } = useCommandPalette();
  const crumb = crumbFor(pathname);
  useNotificationRuntime();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-transparent">

          {/* ── Topbar — soft chrome ── */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur px-5">
            <SidebarToggle />

            {/* Breadcrumb */}
            <div className="hidden items-baseline gap-2 md:flex">
              <span className="text-xs font-medium text-muted-foreground">{crumb.eyebrow}</span>
              <span className="text-muted-foreground/30">·</span>
              <AnimatePresence mode="wait">
                <motion.span key={pathname}
                  initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.18 }}
                  className="text-sm font-semibold tracking-tight text-foreground">
                  {crumb.title}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Search pill */}
            <button
              onClick={() => setOpen(true)}
              aria-label="Command palette"
              className="ml-auto hidden h-10 w-72 items-center gap-2.5 rounded-full border border-border bg-card px-4 text-left text-sm text-muted-foreground shadow-xs transition-all hover:shadow-sm hover:border-ring/40 md:flex"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1">Zoek…</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
            </button>
            <button
              onClick={() => setOpen(true)}
              className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted md:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            <NotificationBell />
          </header>

          {/* ── Page content with transitions ── */}
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              variants={pageTransition}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 overflow-x-hidden"
            >
              <Outlet />
            </motion.main>
          </AnimatePresence>

        </SidebarInset>
      </div>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </SidebarProvider>
  );
}
