import * as React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  ListChecks,
  Map as MapIcon,
  Building2,
  VolumeX,
  Megaphone,
  ScanLine,
  Search,
  Bell,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Languages,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "../lib/utils";

// ── Navigation model (single source of truth) ───────────────────────────────
interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: "workspace" | "intel" | "ops";
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "workspace" },
  { to: "/intake", label: "Intake", icon: Inbox, group: "workspace" },
  { to: "/priorities", label: "Priorities", icon: ListChecks, group: "workspace" },
  { to: "/x-ray", label: "Constituency X-Ray", icon: MapIcon, group: "intel" },
  { to: "/departments", label: "Departments", icon: Building2, group: "intel" },
  { to: "/forgotten", label: "Forgotten Villages", icon: VolumeX, group: "intel" },
  { to: "/act", label: "Act", icon: Megaphone, group: "ops" },
  { to: "/scan", label: "Scan Petition", icon: ScanLine, group: "ops" },
];

const GROUP_LABEL: Record<NavItem["group"], string> = {
  workspace: "Workspace",
  intel: "Intelligence",
  ops: "Operations",
};

const GROUP_ORDER: NavItem["group"][] = ["workspace", "intel", "ops"];

/** Per-route page title, used by the top bar breadcrumb + heading. */
export const ROUTE_TITLE: Record<string, string> = {
  "/": "Dashboard",
  "/intake": "Intake",
  "/priorities": "Priorities",
  "/x-ray": "Constituency X-Ray",
  "/departments": "Departments",
  "/forgotten": "Forgotten Villages",
  "/act": "Act",
  "/scan": "Scan Petition",
};

const LANGS = [
  { code: "en", short: "EN" },
  { code: "ta", short: "தமிழ்" },
  { code: "hi", short: "हिन्दी" },
] as const;

// ── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-[#f8f8fe] text-slate-700 lg:flex dark:bg-[hsl(240_16%_10%)] dark:text-slate-200",
        collapsed ? "w-[68px]" : "w-[252px]",
      )}
      role="navigation"
      aria-label="Primary"
    >
      {/* Brand */}
      <NavLink
        to="/"
        className="flex h-16 items-center gap-2.5 border-b border-border px-4 hover:bg-white/40 dark:hover:bg-white/[0.03]"
        aria-label="Sarvik AI — home"
      >
        <img
          src="/sarvik-logo.svg"
          alt=""
          aria-hidden="true"
          className="h-9 w-9 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="text-[22px] font-black tracking-tight text-slate-900 dark:text-white">
            Sarvik AI
          </span>
        )}
      </NavLink>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {GROUP_ORDER.map((g, gi) => {
          const items = NAV.filter((n) => n.group === g);
          return (
            <div key={g} className={gi > 0 ? "mt-5" : ""}>
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {GROUP_LABEL[g]}
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
                            isActive
                              ? "bg-white text-[#6872FF] shadow-[0_2px_8px_-2px_rgba(104,114,255,0.18)] dark:bg-white/10 dark:text-white"
                              : "text-[#7d8591] hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive
                                  ? "text-[#6872FF] dark:text-white"
                                  : "text-[#7d8591] group-hover:text-slate-700 dark:text-slate-400",
                              )}
                            />
                            {!collapsed && (
                              <span className="flex-1 truncate">{item.label}</span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User card + collapse */}
      <div className="border-t border-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-white p-2.5 shadow-sm dark:bg-white/5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#7c5cfa 0%,#4f46e5 100%)" }}
              aria-hidden="true"
            >
              MP
            </span>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                MP Office
              </span>
              <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                office@sarvik.local
              </span>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-white/10"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white/60 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-700 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <ChevronsLeft className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({
  search,
  onSearch,
  lang,
  onLang,
}: {
  search: string;
  onSearch: (v: string) => void;
  lang: string;
  onLang: (l: string) => void;
}) {
  const location = useLocation();
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const title = ROUTE_TITLE[location.pathname] ?? "Sarvik AI";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // "/" focuses the search box.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-5 backdrop-blur-xl"
      role="banner"
    >
      {/* Breadcrumb + greeting */}
      <div className="flex min-w-0 flex-col leading-tight">
        <nav
          className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex dark:text-slate-400"
          aria-label="Breadcrumb"
        >
          <span>Sarvik</span>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{title}</span>
        </nav>
        <span className="hidden truncate text-[11px] text-slate-500 sm:inline dark:text-slate-400">
          {greeting}, MP Office · Coimbatore
        </span>
      </div>

      {/* Search */}
      <form
        className="ml-auto hidden flex-1 max-w-md md:flex"
        onSubmit={(e) => e.preventDefault()}
        role="search"
      >
        <label className="relative w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 w-full rounded-full border border-border bg-white/80 pl-8 pr-8 text-xs placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-white/5 dark:text-slate-200"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-slate-50 px-1 text-[9px] font-medium text-slate-500 sm:inline-block dark:bg-white/5 dark:text-slate-400">
            /
          </kbd>
        </label>
      </form>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        {/* Language toggle */}
        <div
          className="hidden items-center gap-0.5 rounded-md border border-border bg-white p-0.5 sm:flex dark:bg-white/5"
          role="group"
          aria-label="Language"
        >
          <Languages className="ml-1 h-3.5 w-3.5 text-slate-400" />
          {LANGS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => onLang(opt.code)}
              aria-pressed={lang === opt.code}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all",
                lang === opt.code
                  ? "spark-gradient text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
              )}
            >
              {opt.short}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-all hover:border-slate-300 hover:shadow-sm dark:bg-white/5 dark:text-slate-300"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Notification</span>
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
        </button>

        {/* User chip */}
        <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs dark:border-white/10">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#7c5cfa 0%,#4f46e5 100%)" }}
            aria-hidden="true"
          >
            MP
          </span>
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="font-medium text-slate-700 dark:text-slate-200">MP Office</span>
            <span className="text-[9px] uppercase tracking-wide text-slate-400">MP Office</span>
          </span>
        </div>
      </div>
    </header>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
export interface OutletContext {
  search: string;
}

export default function Layout() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [lang, setLang] = React.useState("en");

  React.useEffect(() => {
    try {
      if (localStorage.getItem("sarvik-sidebar-collapsed") === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapse = () =>
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("sarvik-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapse} />
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          search={search}
          onSearch={setSearch}
          lang={lang}
          onLang={setLang}
        />
        <main className="mx-auto w-full min-w-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6 lg:px-8 xl:max-w-[1600px]">
          <Outlet context={{ search } satisfies OutletContext} />
        </main>
      </div>
    </div>
  );
}
