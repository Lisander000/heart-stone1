import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Database, FolderOpen, Sparkles, Users, Swords, Tag, LogOut, Loader2,
  ShoppingCart, PackageOpen, Truck, RotateCcw, LifeBuoy, HeartPulse, Bot, Wallet,
  UsersRound, LayoutGrid, BarChart3, User, ChevronDown, Activity, Terminal,
  Lightbulb, PenLine, FlaskConical, Clapperboard, TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GbMark } from "@/components/app/GbMark";
import { useOpenReturnsCount } from "@/lib/returnsData";
import { useIsSuperUser } from "@/lib/superuser";

/* ── nav data ─────────────────────────────────────────────────────────── */

type NavItem = { title: string; url: string; icon: React.ElementType };

type NavGroup =
  | { label: string; collapsible: false; devOnly?: boolean; items: NavItem[] }
  | { label: string; collapsible: true; devOnly?: boolean; pinnedItems: NavItem[]; items: NavItem[] };

const navGroups: NavGroup[] = [
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
      { title: "UGC", url: "/creative/ugc", icon: Clapperboard },
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
    pinnedItems: [
      { title: "Ops overview", url: "/ops", icon: LayoutGrid },
    ],
    items: [
      { title: "Orders", url: "/orders", icon: ShoppingCart },
      { title: "Unfulfilled", url: "/unfulfilled", icon: PackageOpen },
      { title: "Shipments", url: "/shipments", icon: Truck },
      { title: "Returns", url: "/returns", icon: RotateCcw },
      { title: "Returns dashboard", url: "/returns/dashboard", icon: BarChart3 },
      { title: "Tickets", url: "/tickets", icon: LifeBuoy },
      { title: "Product Health", url: "/product-health", icon: HeartPulse },
      { title: "Team", url: "/team", icon: UsersRound },
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

/* ── user profile hook ───────────────────────────────────────────────── */

function useUserProfile() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      setFullName(user.user_metadata?.full_name ?? "");
      setAvatarUrl(user.user_metadata?.avatar_url ?? "");
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user;
      if (!user) return;
      setEmail(user.email ?? "");
      setFullName(user.user_metadata?.full_name ?? "");
      setAvatarUrl(user.user_metadata?.avatar_url ?? "");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return { email, fullName, avatarUrl, initials };
}

/* ── main component ──────────────────────────────────────────────────── */

const SIDEBAR_GROUPS_KEY = "gb_sidebar_groups";
const defaultGroupOpen = (label: string) => label === "Finance" || label === "Developer";

/** Collapsed-rail logo: uses /gb-mark.png if you drop it in public/, else the built-in SVG mark. */
function CollapsedLogo() {
  const [failed, setFailed] = useState(false);
  if (failed) return <GbMark className="h-8 w-auto" />;
  return (
    <img src="/gb-mark.png" alt="Gooodboys" draggable={false}
      className="h-11 w-auto object-contain select-none" onError={() => setFailed(true)} />
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const { email, fullName, avatarUrl, initials } = useUserProfile();
  const openReturns = useOpenReturnsCount();
  const iAmSuper = useIsSuperUser();

  // Per-category open state — persisted so a user's expand/collapse survives a refresh.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });
  const setGroupOpen = (label: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: open };
      try { localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const signOut = async () => {
    setSigningOut(true);
    try { await supabase.auth.signOut(); window.location.href = "/auth"; }
    finally { setSigningOut(false); }
  };

  // Highlight only the *most specific* matching item, so /finance/forecast doesn't
  // also light up /finance (a prefix). Longest matching url wins.
  const activeUrl = useMemo(() => {
    const urls = navGroups.flatMap((g) => [...("pinnedItems" in g ? g.pinnedItems : []), ...g.items]).map((i) => i.url);
    // a generic ops detail (/ops/<table>/<id|new|edit>) belongs to that resource's nav
    // item (e.g. /ops/tickets/123 → Tickets), not to the /ops "Ops overview" item.
    let matchPath = pathname;
    const m = pathname.match(/^\/ops\/([a-z_]+)\/.+/);
    if (m) {
      const cand = "/" + m[1].replace(/_/g, "-");
      if (urls.includes(cand)) matchPath = cand;
    }
    let best = "", bestLen = -1;
    for (const u of urls) {
      const hit = u === "/" ? matchPath === "/" : (matchPath === u || matchPath.startsWith(u + "/"));
      if (hit && u.length > bestLen) { best = u; bestLen = u.length; }
    }
    return best;
  }, [pathname]);
  const isActive = (url: string) => url === activeUrl;

  function renderNavItem(item: NavItem) {
    const active = isActive(item.url);
    const badge = item.url === "/returns" ? openReturns : 0;
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={badge > 0 ? `${item.title} · ${badge} open` : item.title}
          className="group/nav h-9 rounded-xl group-data-[collapsible=icon]:rounded-full px-2.5 !overflow-visible text-sidebar-foreground/70 transition-all duration-150
            hover:bg-sidebar-accent hover:text-sidebar-foreground
            data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm data-[active=true]:font-medium"
        >
          <NavLink to={item.url} className="flex items-center gap-2.5">
            <span className="relative shrink-0">
              <item.icon
                className={`h-[17px] w-[17px] transition-transform duration-150 group-hover/nav:scale-105 ${active ? "" : "text-sidebar-foreground/55"}`}
                strokeWidth={2}
              />
              {badge > 0 && collapsed && (
                <span className="absolute -top-2 -right-2 min-w-[14px] h-[14px] px-1 rounded-full grid place-items-center text-[9px] font-bold leading-none text-white bg-bad ring-2 ring-sidebar shadow-sm tabular-nums">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span className="text-[13px]">{item.title}</span>
            {badge > 0 && !collapsed && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1.5 rounded-full grid place-items-center text-[10px] font-bold text-white bg-bad tabular-nums group-data-[active=true]/nav:bg-white group-data-[active=true]/nav:text-primary">
                {badge}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">

      {/* ── Logo ── */}
      <SidebarHeader className="px-4 pt-4 pb-2 group-data-[collapsible=icon]:px-0">
        <NavLink to="/" className="flex items-center gap-2 group/logo group-data-[collapsible=icon]:justify-center">
          {collapsed ? (
            <CollapsedLogo />
          ) : (
            <>
              <img
                src="/gb-wordmark.png"
                alt="Gooodboys"
                className="h-7 w-auto select-none transition-transform duration-300 group-hover/logo:scale-[1.03]"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = "block";
                }}
              />
              <span className="font-brand font-black text-xl tracking-tighter text-primary hidden leading-none">
                Gooodboys
              </span>
            </>
          )}
        </NavLink>
      </SidebarHeader>

      {/* ── Nav groups ── */}
      <SidebarContent className="px-2 gap-0.5 py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        {navGroups.filter((g) => !g.devOnly || iAmSuper).map((group) => {
          if (!group.collapsible) {
            return (
              <SidebarGroup key={group.label} className="py-1">
                <SidebarGroupLabel className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {group.items.map(renderNavItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={group.label} className="py-1">
              <Collapsible
                open={openGroups[group.label] ?? defaultGroupOpen(group.label)}
                onOpenChange={(o) => setGroupOpen(group.label, o)}
                className="group/collapsible"
              >
                <SidebarGroupLabel
                  asChild
                  className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40"
                >
                  <CollapsibleTrigger className="flex w-full items-center rounded-md hover:text-sidebar-foreground/70 transition-colors duration-150">
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>

                {group.pinnedItems.length > 0 && (
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">{group.pinnedItems.map(renderNavItem)}</SidebarMenu>
                  </SidebarGroupContent>
                )}

                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">{group.items.map(renderNavItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* ── Footer: user + dropdown ── */}
      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`group/user flex items-center gap-2.5 w-full rounded-xl p-2
                border border-transparent bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors duration-150
                outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring text-left
                ${collapsed ? "justify-center bg-transparent" : ""}`}
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-full ring-2 ring-card shadow-sm">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName || email} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
                      {fullName || email.split("@")[0]}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate leading-tight flex items-center gap-1">
                      <span className="dot" style={{ background: "hsl(var(--ok))", width: 6, height: 6 }} /> Online
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover/user:text-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56 rounded-xl p-1.5">
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              <Avatar className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-border">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName || email} className="rounded-lg" />}
                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{fullName || email.split("@")[0]}</p>
                <p className="text-[11px] text-muted-foreground truncate">{email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer rounded-lg py-2 gap-2.5">
              <User className="h-4 w-4 shrink-0" />
              Mijn profiel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              disabled={signingOut}
              className="cursor-pointer rounded-lg py-2 gap-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              {signingOut
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                : <LogOut className="h-4 w-4 shrink-0" />}
              {signingOut ? "Bezig…" : "Uitloggen"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

    </Sidebar>
  );
}
