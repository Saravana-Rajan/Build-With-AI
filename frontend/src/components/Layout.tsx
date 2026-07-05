import { NavLink, Outlet } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  hint: string;
}

const NAV: NavItem[] = [
  { to: "/intake", label: "Intake", hint: "Live feed" },
  { to: "/priorities", label: "Priorities", hint: "Themes + ranked list" },
  { to: "/x-ray", label: "Constituency X-Ray", hint: "Coverage + ₹ owed" },
  { to: "/act", label: "Act", hint: "Letters + cart" },
  { to: "/forgotten", label: "Forgotten Villages", hint: "Silent areas" },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            CIE
          </div>
          <div className="brand-text">
            <strong>Constituency</strong>
            <span>Intelligence Engine</span>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link--active" : "nav-link"
              }
            >
              <span className="nav-link__label">{item.label}</span>
              <span className="nav-link__hint">{item.hint}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>MP dashboard</span>
          <span className="muted">Working title — name TBD</span>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
