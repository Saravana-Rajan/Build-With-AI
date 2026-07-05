import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatCrore, formatInr } from "../format";
import {
  loadDepartments,
  projectDepartment,
  departmentColor,
} from "../lib/departments";
import type { DepartmentsResult } from "../lib/departments";
import type { RankedProject } from "../types";

type Tab = "A" | "B";

const MPLADS_BUDGET = 5_00_00_000; // ₹5 crore annual allocation.

/** Group projects by owning department, sorted by group size (largest first). */
function groupByDept(rows: RankedProject[]): Array<[string, RankedProject[]]> {
  const map = new Map<string, RankedProject[]>();
  for (const p of rows) {
    const dept = projectDepartment(p);
    (map.get(dept) ?? map.set(dept, []).get(dept)!).push(p);
  }
  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
}

function DeptSection({
  name,
  count,
  owedLabel,
  defaultOpen,
  children,
}: {
  name: string;
  count: number;
  owedLabel: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const color = departmentColor(name);
  return (
    <div className="dept-section">
      <button
        type="button"
        className="dept-section__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight
          size={16}
          className={`dept-section__chevron${open ? " dept-section__chevron--open" : ""}`}
        />
        <span className="dept-section__dot" style={{ background: color }} />
        <span className="dept-section__name">{name}</span>
        <span className="dept-section__meta">
          <span className="chip chip--muted">{count} {count === 1 ? "item" : "items"}</span>
          {owedLabel && <span className="dept-section__owed">{owedLabel}</span>}
        </span>
      </button>
      {open && <div className="dept-section__body">{children}</div>}
    </div>
  );
}

export default function Act() {
  const [tab, setTab] = useState<Tab>("A");
  const [cart, setCart] = useState<Set<number>>(new Set());
  const projects = useFetch(() => api.rankedProjects(300));
  const depts = useFetch<DepartmentsResult>(
    () => loadDepartments(),
    (d) => d.data.length === 0,
  );

  const { trackA, trackB } = useMemo(() => {
    const rows = projects.status === "ready" ? projects.data : [];
    return {
      trackA: rows.filter((p) => p.track === "A"),
      trackB: rows.filter((p) => p.track === "B"),
    };
  }, [projects]);

  // Department -> ₹ owed (Track A entitlement value), from the departments roll-up.
  const owedByDept = useMemo(() => {
    const m = new Map<string, number>();
    if (depts.status === "ready") {
      for (const d of depts.data.data) m.set(d.department, d.total_gap_value);
    }
    return m;
  }, [depts]);

  const groupedA = useMemo(() => groupByDept(trackA), [trackA]);
  const groupedB = useMemo(() => groupByDept(trackB), [trackB]);

  const committed = useMemo(
    () =>
      trackB
        .filter((p) => cart.has(p.rank))
        .reduce((sum, p) => sum + (p.estimated_cost ?? 0), 0),
    [trackB, cart],
  );

  const toggle = (rank: number) =>
    setCart((prev) => {
      const next = new Set(prev);
      next.has(rank) ? next.delete(rank) : next.add(rank);
      return next;
    });

  const pct = Math.min(100, (committed / MPLADS_BUDGET) * 100);
  const remaining = MPLADS_BUDGET - committed;

  return (
    <Page
      title="Act"
      subtitle="Turn priorities into action, routed by department: unlock entitlements (Track A) or allocate MPLADS funds (Track B)."
    >
      <div className="tabs" role="tablist" aria-label="Action track">
        <button
          role="tab"
          aria-selected={tab === "A"}
          className={tab === "A" ? "tab tab--active" : "tab"}
          onClick={() => setTab("A")}
        >
          Track A · Letters ({trackA.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === "B"}
          className={tab === "B" ? "tab tab--active" : "tab"}
          onClick={() => setTab("B")}
        >
          Track B · ₹5 Cr cart ({trackB.length})
        </button>
      </div>

      {projects.status === "loading" && (
        <StateBlock variant="loading" title="Loading projects…" />
      )}
      {projects.status === "empty" && (
        <StateBlock variant="empty" title="No projects to act on yet" />
      )}
      {projects.status === "error" && (
        <StateBlock variant="error" title="Could not load projects" detail={projects.error} />
      )}

      {projects.status === "ready" && tab === "A" && (
        <section aria-label="Track A letters">
          <p className="muted" style={{ marginBottom: 14 }}>
            One official letter per department to unlock existing entitlements (JJM, PMAY-U,
            pensions). ₹0 of MPLADS required — grouped by the office accountable for delivery.
          </p>
          {groupedA.length === 0 ? (
            <StateBlock variant="empty" title="No Track A items" />
          ) : (
            groupedA.map(([dept, items], i) => (
              <DeptSection
                key={dept}
                name={dept}
                count={items.length}
                owedLabel={owedByDept.has(dept) ? formatCrore(owedByDept.get(dept)!) : null}
                defaultOpen={i === 0}
              >
                <ul className="ranked-list">
                  {items.map((p) => (
                    <li key={p.rank} className="ranked-item">
                      <div className="ranked-item__body">
                        <div className="ranked-item__head">
                          <strong>{p.title}</strong>
                          {p.matched_scheme && (
                            <span className="chip chip--muted">{p.matched_scheme}</span>
                          )}
                        </div>
                        <div className="muted ranked-item__meta">
                          {p.place_name} · {p.category}
                        </div>
                      </div>
                      <button className="btn btn--sm">Draft letter</button>
                    </li>
                  ))}
                </ul>
              </DeptSection>
            ))
          )}
        </section>
      )}

      {projects.status === "ready" && tab === "B" && (
        <section aria-label="Track B cart">
          <div className="budget-bar" aria-label="MPLADS budget">
            <div className="budget-bar__meta">
              <span>MPLADS allocated</span>
              <strong>{formatCrore(MPLADS_BUDGET)}</strong>
            </div>
            <div className="budget-bar__track">
              <div
                className={`budget-bar__fill${pct > 100 ? " budget-bar__fill--over" : ""}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="budget-bar__meta">
              <span className="muted">
                {formatCrore(committed)} committed · {formatInr(remaining)} remaining
              </span>
              {remaining < 0 && <span className="chip chip--critical">Over budget</span>}
            </div>
          </div>

          {groupedB.length === 0 ? (
            <StateBlock
              variant="empty"
              title="No Track B projects"
              detail="Nothing to allocate against the ₹5 Cr budget yet."
            />
          ) : (
            groupedB.map(([dept, items], i) => {
              const deptCost = items.reduce((s, p) => s + (p.estimated_cost ?? 0), 0);
              return (
                <DeptSection
                  key={dept}
                  name={dept}
                  count={items.length}
                  owedLabel={formatInr(deptCost)}
                  defaultOpen={i === 0}
                >
                  <ul className="cart-list">
                    {items.map((p) => {
                      const inCart = cart.has(p.rank);
                      return (
                        <li key={p.rank} className={inCart ? "cart-item cart-item--in" : "cart-item"}>
                          <label className="cart-item__pick">
                            <input
                              type="checkbox"
                              checked={inCart}
                              onChange={() => toggle(p.rank)}
                            />
                            <span>
                              <strong>{p.title}</strong>
                              <span className="muted"> · {p.place_name} · {p.category}</span>
                            </span>
                          </label>
                          <span className="num">{formatInr(p.estimated_cost)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </DeptSection>
              );
            })
          )}
        </section>
      )}
    </Page>
  );
}
