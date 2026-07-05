import Page from "../components/Page";
import MapPlaceholder from "../components/MapPlaceholder";
import type { SchemeGap } from "../types";

// Placeholder — real totals come from api.schemeGaps().
const DEMO_GAPS: SchemeGap[] = [];

function formatInr(value: number): string {
  // Compact ₹ formatting for a headline (e.g. ₹5.2 Cr).
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function ConstituencyXRay() {
  const totalOwed = DEMO_GAPS.reduce((sum, g) => sum + g.gap_value, 0);
  const loading = DEMO_GAPS.length === 0;

  return (
    <Page
      title="Constituency X-Ray"
      subtitle="Village and ward coverage at a glance — and the entitlements still owed to your people."
    >
      <section className="headline" aria-label="Entitlements owed">
        <span className="headline__label">Entitlements owed to the constituency</span>
        <span className="headline__value">
          {loading ? "₹ —" : formatInr(totalOwed)}
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
          <MapPlaceholder />
        </div>

        <div className="card">
          <div className="card__head">
            <h2 className="section-title">Biggest gaps</h2>
          </div>
          {loading ? (
            <div className="state-block state-block--loading" role="status">
              <span className="state-block__title">Loading coverage data…</span>
            </div>
          ) : (
            <ul className="gap-list">
              {DEMO_GAPS.map((g) => (
                <li key={g.area_id + g.scheme} className="gap-list__item">
                  <div>
                    <strong>{g.place_name}</strong>
                    <span className="muted"> · {g.scheme}</span>
                  </div>
                  <div className="gap-list__value">{formatInr(g.gap_value)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Page>
  );
}
