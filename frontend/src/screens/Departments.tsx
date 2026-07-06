import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, ArrowRight, Landmark, Send } from "lucide-react";
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
import { schemeInfo, siblingSchemes } from "../lib/schemeMeta";
import type { SchemeInfo } from "../lib/schemeMeta";
import type { SchemeGap } from "../types";
import { api } from "../api";

/**
 * Prominent, highlighted badge for a central scheme the MP should push. Solid,
 * scheme-colored tile so the "which scheme" answer jumps out of the panel.
 */
function SchemeBadge({ info }: { info: SchemeInfo }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: 148,
        flex: "1 1 148px",
        padding: "9px 11px",
        borderRadius: 10,
        background: info.color,
        boxShadow: `0 6px 16px -8px ${info.color}`,
        color: "#fff",
      }}
    >
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 8.5,
          fontWeight: 800,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          padding: "1px 6px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.22)",
          color: "#fff",
        }}
      >
        Central scheme
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
        {info.code}
      </span>
      <span style={{ fontSize: 11, lineHeight: 1.25, color: "rgba(255,255,255,0.9)" }}>
        {info.name}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.78)" }}>
        {info.ministry}
      </span>
    </div>
  );
}

/** Muted, outlined badge for a well-known sibling scheme shown only as context. */
function SiblingBadge({ info }: { info: SchemeInfo }) {
  return (
    <span
      title={`${info.name} · ${info.ministry}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        border: `1px dashed ${info.color}`,
        color: info.color,
        background: "hsl(var(--card))",
      }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: 999, background: info.color }}
      />
      {info.code}
    </span>
  );
}

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
      subtitle="Whose job is it? Every rupee owed, routed to the central line department accountable — and the exact scheme to push to release it."
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
              Each department below is a central portfolio. Push the highlighted scheme with a
              consolidated letter to unlock it.
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
              {filtered.map((d, i) => {
                const color = departmentColor(d.department);
                const primary = d.schemes.map(schemeInfo);
                const siblings = siblingSchemes(d.schemes);
                const ministry = primary[0]?.ministry ?? d.department;
                const share = totalOwed > 0 ? d.total_gap_value / totalOwed : 0;
                const pct = Math.round(share * 100);
                return (
                  <article key={d.department} className="dept-panel" id={departmentSlug(d.department)}>
                    <div className="dept-panel__head">
                      <span className="dept-panel__icon" style={{ background: `${color}1a`, color }}>
                        <Landmark size={18} />
                      </span>
                      <div className="dept-panel__title" style={{ flex: 1, minWidth: 0 }}>
                        <h3>{d.department}</h3>
                        <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {ministry}
                        </span>
                      </div>
                      <span
                        aria-label={`Rank ${i + 1} by amount owed`}
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          fontVariantNumeric: "tabular-nums",
                          color,
                          background: `${color}14`,
                          borderRadius: 999,
                          padding: "2px 8px",
                        }}
                      >
                        #{i + 1}
                      </span>
                    </div>

                    <div className="dept-panel__owed" style={{ flexWrap: "wrap" }}>
                      <span className="dept-panel__owed-val" style={{ color }}>
                        {formatCrore(d.total_gap_value)}
                      </span>
                      <span className="muted">owed · {d.issue_count.toLocaleString("en-IN")} open issues</span>
                      <div style={{ flexBasis: "100%", marginTop: 8 }}>
                        <div
                          role="img"
                          aria-label={`${pct}% of all entitlements owed`}
                          style={{
                            height: 6,
                            borderRadius: 999,
                            background: "hsl(var(--muted))",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(share * 100, 2)}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: color,
                            }}
                          />
                        </div>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {pct}% of all ₹ owed
                        </span>
                      </div>
                    </div>

                    {/* KEY ASK: prominent, highlighted central schemes to push. */}
                    <div
                      className="dept-panel__section"
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: "hsl(var(--secondary) / 0.5)",
                        border: "1px solid hsl(var(--border))",
                      }}
                    >
                      <span className="dept-panel__label" style={{ color: "hsl(var(--foreground))" }}>
                        ★ Central schemes to push
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                        {primary.length === 0 && <span className="muted">No matched scheme</span>}
                        {primary.map((s) => (
                          <SchemeBadge key={s.code} info={s} />
                        ))}
                      </div>
                      {siblings.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <span className="muted" style={{ fontSize: 11 }}>
                            Related central schemes (context):
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                            {siblings.map((s) => (
                              <SiblingBadge key={s.code} info={s} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="dept-panel__section">
                      <span className="dept-panel__label">Top areas · ₹ owed</span>
                      <ul className="dept-panel__areas">
                        {d.top_areas.length === 0 && <li className="muted">—</li>}
                        {[...d.top_areas]
                          .sort(
                            (a, b) =>
                              (areaValue.get(b) ?? 0) - (areaValue.get(a) ?? 0),
                          )
                          .map((a) => (
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

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        marginTop: "auto",
                        paddingTop: 12,
                        borderTop: "1px solid hsl(var(--border))",
                      }}
                    >
                      <span className="muted" style={{ fontSize: 12, lineHeight: 1.3, minWidth: 0 }}>
                        Push <strong style={{ color: "hsl(var(--foreground))" }}>{ministry}</strong> — one
                        letter covers every area above.
                      </span>
                      <Link
                        to="/act"
                        className="dept-panel__act"
                        style={{ flexShrink: 0 }}
                        aria-label={`Send consolidated letter for ${d.department}`}
                      >
                        <Send size={13} /> Send letter <ArrowRight size={13} />
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
