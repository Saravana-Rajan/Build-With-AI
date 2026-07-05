import Page from "../components/Page";
import MapPlaceholder from "../components/MapPlaceholder";
import type { AreaCell } from "../components/MapPlaceholder";
import StateBlock from "../components/StateBlock";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatCrore } from "../format";
import type { SchemeGap } from "../types";

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
  const gaps = useFetch(() => api.schemeGaps(100));

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
          <MapPlaceholder
            cells={gaps.status === "ready" ? gapsToCells(gaps.data) : undefined}
          />
        </div>

        <div className="card">
          <div className="card__head">
            <h2 className="section-title">Biggest gaps</h2>
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
            <ul className="gap-list">
              {gaps.data.map((g) => (
                <li key={`${g.area_id}-${g.scheme}`} className="gap-list__item">
                  <div>
                    <strong>{g.place_name}</strong>
                    <span className="muted"> · {g.scheme}</span>
                    <div className="muted gap-list__sub">
                      {g.covered.toLocaleString("en-IN")} /{" "}
                      {g.eligible.toLocaleString("en-IN")} covered
                      {g.data_source ? ` · ${g.data_source}` : ""}
                    </div>
                  </div>
                  <div className="gap-list__value">{formatCrore(g.gap_value)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Page>
  );
}
