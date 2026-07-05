import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, ArrowRight, Building2 } from "lucide-react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import HBarChart from "../components/HBarChart";
import { useFetch } from "../useFetch";
import { formatCrore, formatCroreShort } from "../format";
import {
  loadDepartments,
  departmentColor,
  departmentSlug,
} from "../lib/departments";
import type { DepartmentsResult } from "../lib/departments";
import type { SchemeGap } from "../types";
import { api } from "../api";

export default function Departments() {
  const depts = useFetch<DepartmentsResult>(
    () => loadDepartments(),
    (d) => d.data.length === 0,
  );
  // Per-area ₹ owed, to enrich each department's "top areas" with values.
  const gaps = useFetch<SchemeGap[]>(() => api.schemeGaps(300));
  const [query, setQuery] = useState("");

  const rows = depts.status === "ready" ? depts.data.data : [];
  const derived = depts.status === "ready" && depts.data.derived;

  // area name -> ₹ owed (summed), for the per-area value column.
  const areaValue = useMemo(() => {
    const m = new Map<string, number>();
    if (gaps.status === "ready") {
      for (const g of gaps.data) {
        m.set(g.place_name, (m.get(g.place_name) ?? 0) + (g.gap_value || 0));
      }
    }
    return m;
  }, [gaps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (d) =>
        d.department.toLowerCase().includes(q) ||
        d.schemes.some((s) => s.toLowerCase().includes(q)) ||
        d.top_areas.some((a) => a.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const chartData = useMemo(
    () =>
      filtered.slice(0, 10).map((d) => ({
        name: d.department,
        value: d.total_gap_value,
        color: departmentColor(d.department),
      })),
    [filtered],
  );

  const totalOwed = rows.reduce((s, d) => s + d.total_gap_value, 0);

  return (
    <Page
      title="Departments"
      subtitle="Whose job is it? Every rupee owed, routed to the line department accountable for delivering it."
      actions={
        depts.status === "ready" ? (
          <span className="count-badge">{rows.length} departments</span>
        ) : undefined
      }
    >
      {depts.status === "loading" && (
        <StateBlock variant="loading" title="Routing entitlements to departments…" />
      )}
      {depts.status === "empty" && (
        <StateBlock
          variant="empty"
          title="No departments yet"
          detail="The /api/departments rollup returned nothing to route."
        />
      )}
      {depts.status === "error" && (
        <StateBlock variant="error" title="Could not load departments" detail={depts.error} />
      )}

      {depts.status === "ready" && (
        <>
          <section className="headline" aria-label="Total owed">
            <span className="headline__label">Total entitlements owed · across all departments</span>
            <span className="headline__value">{formatCrore(totalOwed)}</span>
            <span className="headline__note">
              Track A unlocks this with letters (₹0 of MPLADS). Track B funds the rest from the
              ₹5&nbsp;cr constituency budget.
              {derived && " Figures derived from scheme gaps until the departments API is live."}
            </span>
          </section>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card__head">
              <h2 className="section-title">₹ owed by department</h2>
              <span className="muted">Top {chartData.length}, largest first</span>
            </div>
            <HBarChart data={chartData} format={formatCroreShort} labelWidth={190} />
          </div>

          <div className="toolbar">
            <div className="search-box">
              <Search className="search-box__icon" size={15} />
              <input
                className="search-box__input"
                type="search"
                placeholder="Filter by department, scheme, or area…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter departments"
              />
            </div>
            <span className="count-badge">{filtered.length} shown</span>
          </div>

          {filtered.length === 0 ? (
            <StateBlock variant="empty" title="No matching departments" detail={`Nothing matches “${query}”.`} />
          ) : (
            <div className="dept-grid">
              {filtered.map((d) => {
                const color = departmentColor(d.department);
                const track = /pension|social|health|jjm|water|housing|road/i.test(
                  d.schemes.join(" "),
                )
                  ? "A"
                  : "B";
                return (
                  <article key={d.department} className="dept-panel" id={departmentSlug(d.department)}>
                    <div className="dept-panel__head">
                      <span className="dept-panel__icon" style={{ background: `${color}1a`, color }}>
                        <Building2 size={18} />
                      </span>
                      <div className="dept-panel__title">
                        <h3>{d.department}</h3>
                        <span className="muted">{d.issue_count.toLocaleString("en-IN")} open issues</span>
                      </div>
                    </div>

                    <div className="dept-panel__owed">
                      <span className="dept-panel__owed-val" style={{ color }}>
                        {formatCrore(d.total_gap_value)}
                      </span>
                      <span className="muted">owed to constituents</span>
                    </div>

                    <div className="dept-panel__section">
                      <span className="dept-panel__label">Schemes involved</span>
                      <div className="dept-panel__chips">
                        {d.schemes.length === 0 && <span className="muted">—</span>}
                        {d.schemes.map((s) => (
                          <span key={s} className="chip chip--muted">{s}</span>
                        ))}
                      </div>
                    </div>

                    <div className="dept-panel__section">
                      <span className="dept-panel__label">Top areas</span>
                      <ul className="dept-panel__areas">
                        {d.top_areas.length === 0 && <li className="muted">—</li>}
                        {d.top_areas.map((a) => (
                          <li key={a}>
                            <span className="dept-panel__area-name">
                              <MapPin size={12} /> {a}
                            </span>
                            {areaValue.has(a) && (
                              <span className="dept-panel__area-val">
                                {formatCroreShort(areaValue.get(a)!)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="dept-panel__foot">
                      <span className={`chip chip--track-${track}`}>
                        {track === "A"
                          ? "Track A · draft a letter to unlock"
                          : "Track B · fund from MPLADS"}
                      </span>
                      <Link to="/act" className="dept-panel__act">
                        Act <ArrowRight size={13} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
