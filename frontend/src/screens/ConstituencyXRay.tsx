import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Page from "../components/Page";
import AreaMap from "../components/AreaMap";
import type { AreaCell } from "../components/MapPlaceholder";
import StateBlock from "../components/StateBlock";
import Pagination, { usePagination } from "../components/Pagination";
import HBarChart from "../components/HBarChart";
import ProvenanceChip from "../components/Provenance";
import ComplaintsModal from "../components/ComplaintsModal";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatCrore, formatCroreShort } from "../format";
import { departmentFor, departmentColor } from "../lib/departments";
import type { SchemeGap } from "../types";

const PAGE_SIZE = 12;
const ALL = "__all__";

/** Turn scheme gaps into map cells: coverage ratio drives the red→green shade. */
function gapsToCells(gaps: SchemeGap[]): AreaCell[] {
  return gaps.slice(0, 12).map((g) => ({
    id: `${g.area_id}-${g.scheme}`,
    label: g.place_name,
    coverage: g.eligible > 0 ? Math.max(0, Math.min(1, g.covered / g.eligible)) : 0,
  }));
}

export default function ConstituencyXRay() {
  const stats = useFetch(() => api.stats(), () => false);
  const gaps = useFetch(() => api.schemeGaps(300));
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>(ALL);
  const [selectedGap, setSelectedGap] = useState<SchemeGap | null>(null);

  const rows: SchemeGap[] = gaps.status === "ready" ? gaps.data : [];

  // Distinct departments present in the data, for the filter dropdown.
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const g of rows) set.add(departmentFor(g.scheme, g.department));
    return Array.from(set).sort();
  }, [rows]);

  // Filter by department + free text, then sort by gap value (largest owed first).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = rows.filter((g) => {
      if (dept !== ALL && departmentFor(g.scheme, g.department) !== dept) return false;
      if (!q) return true;
      return (
        g.scheme.toLowerCase().includes(q) || g.place_name.toLowerCase().includes(q)
      );
    });
    return [...matched].sort((a, b) => b.gap_value - a.gap_value);
  }, [rows, query, dept]);

  // Heatmap cells respect the department filter so the gradient reflects the view.
  const cells = useMemo(() => gapsToCells(filtered), [filtered]);

  // Top 10 gaps by ₹ for the bar chart.
  const chartData = useMemo(
    () =>
      filtered.slice(0, 10).map((g) => ({
        name: `${g.place_name} · ${g.scheme}`,
        value: g.gap_value,
        color: departmentColor(departmentFor(g.scheme, g.department)),
      })),
    [filtered],
  );

  const { page, pageCount, pageItems, total, from, to, setPage } =
    usePagination(filtered, PAGE_SIZE);

  return (
    <Page
      title="Constituency X-Ray"
      subtitle="Village and ward coverage at a glance — and the entitlements still owed to your people."
    >
      <section className="headline" aria-label="Entitlements owed">
        <span className="headline__label">Entitlements owed to the constituency</span>
        <span className="headline__value">
          {stats.status === "ready"
            ? formatCrore(stats.data.rupees_owed)
            : stats.status === "error"
              ? "₹—"
              : "₹…"}
        </span>
        <span className="headline__note">
          Sum of unclaimed scheme value across all areas (Track A — ₹0 of MPLADS
          to unlock).
        </span>
      </section>

      <section className="xray-grid">
        <div className="card card--map">
          <div className="card__head">
            <h2 className="section-title">Coverage heatmap</h2>
            <span className="muted">By ward (urban) and village (rural)</span>
          </div>
          <AreaMap
            gaps={gaps.status === "ready" ? filtered : []}
            fallbackCells={gaps.status === "ready" ? cells : undefined}
          />
        </div>

        <div className="card">
          <div className="card__head">
            <h2 className="section-title">
              Biggest gaps
              {gaps.status === "ready" && (
                <span className="count-badge">
                  {filtered.length.toLocaleString("en-IN")}
                </span>
              )}
            </h2>
          </div>

          {gaps.status === "loading" && (
            <StateBlock variant="loading" title="Loading coverage data…" />
          )}
          {gaps.status === "empty" && (
            <StateBlock variant="empty" title="No coverage gaps found" />
          )}
          {gaps.status === "error" && (
            <StateBlock variant="error" title="Could not load gaps" detail={gaps.error} />
          )}

          {gaps.status === "ready" && (
            <>
              <div className="toolbar">
                <div className="search-box">
                  <Search className="search-box__icon" size={15} />
                  <input
                    className="search-box__input"
                    type="search"
                    placeholder="Filter by scheme or place…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Filter scheme gaps"
                  />
                </div>
                <select
                  className="scan-select"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  aria-label="Filter by department"
                >
                  <option value={ALL}>All departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {filtered.length === 0 ? (
                <StateBlock
                  variant="empty"
                  title="No matching gaps"
                  detail="Nothing matches the current filters."
                />
              ) : (
                <>
                  <ul className="gap-list">
                    {pageItems.map((g) => (
                      <li
                        key={`${g.area_id}-${g.scheme}`}
                        className="gap-list__item"
                        role="button"
                        tabIndex={0}
                        aria-label={`View citizen complaints from ${g.place_name}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedGap(g)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedGap(g);
                          }
                        }}
                      >
                        <div>
                          <strong>{g.place_name}</strong>
                          <span className="muted"> · {g.scheme}</span>
                          <div className="muted gap-list__sub">
                            {g.covered.toLocaleString("en-IN")} /{" "}
                            {g.eligible.toLocaleString("en-IN")} covered{" "}
                            <ProvenanceChip kind={g.data_source === "real" ? "real" : "modelled"} />
                          </div>
                        </div>
                        <div className="gap-list__value">{formatCrore(g.gap_value)}</div>
                      </li>
                    ))}
                  </ul>

                  <Pagination
                    page={page}
                    pageCount={pageCount}
                    from={from}
                    to={to}
                    total={total}
                    onPageChange={setPage}
                    noun="gaps"
                  />
                </>
              )}
            </>
          )}
        </div>
      </section>

      {gaps.status === "ready" && filtered.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card__head">
            <h2 className="section-title">Top gaps by ₹ owed</h2>
            <span className="muted">
              {dept === ALL ? "All departments" : dept} · top {chartData.length}
            </span>
          </div>
          <HBarChart data={chartData} format={formatCroreShort} labelWidth={210} />
        </div>
      )}

      <ComplaintsModal
        open={selectedGap !== null}
        onClose={() => setSelectedGap(null)}
        placeName={selectedGap?.place_name}
        title={
          selectedGap ? `${selectedGap.place_name} · ${selectedGap.scheme}` : "Citizen complaints"
        }
        subtitle={
          selectedGap
            ? `Complaints behind the ${selectedGap.scheme} gap in ${selectedGap.place_name}`
            : undefined
        }
      />
    </Page>
  );
}
