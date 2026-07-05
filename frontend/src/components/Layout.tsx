import { NavLink, Outlet } from "react-router-dom";
import {
  ScanLine,
  Inbox,
  ListChecks,
  Map as MapIcon,
  Megaphone,
  VolumeX,
} from "lucide-react";
import type { ComponentType } from "react";

interface NavItem {
  to: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: "/scan", label: "Scan Petition", hint: "AI reads a letter", icon: ScanLine },
  { to: "/intake", label: "Intake", hint: "Live feed", icon: Inbox },
  { to: "/priorities", label: "Priorities", hint: "Themes + ranked list", icon: ListChecks },
  { to: "/x-ray", label: "Constituency X-Ray", hint: "Coverage + ₹ owed", icon: MapIcon },
  { to: "/act", label: "Act", hint: "Letters + cart", icon: Megaphone },
  { to: "/forgotten", label: "Forgotten Villages", hint: "Silent areas", icon: VolumeX },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/scan" className="brand" aria-label="Sarvik AI — home">
          <img className="brand-logo" src="/sarvik-logo.svg" alt="" aria-hidden="true" />
          <div className="brand-text">
            <strong>Sarvik AI</strong>
          </div>
        </NavLink>

        <nav className="nav" aria-label="Primary">
          <div className="nav-group-label">Workspace</div>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "nav-link nav-link--active" : "nav-link"
                }
              >
                <Icon />
                <span className="nav-link__label">
                  {item.label}
                  <span className="nav-link__hint" style={{ display: "block" }}>
                    {item.hint}
                  </span>
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
            MP dashboard
          </span>
          <span className="muted">Sarvik AI</span>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
