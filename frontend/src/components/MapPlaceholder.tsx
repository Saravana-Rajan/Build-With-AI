/**
 * Map placeholder for the constituency coverage heatmap.
 *
 * ── Where the real map goes ──────────────────────────────────────────────────
 * Swap this component's body for a real map once a key is available. Options:
 *
 *   1. Google Maps  — @react-google-maps/api
 *        const { isLoaded } = useJsApiLoader({
 *          googleMapsApiKey: import.meta.env.VITE_MAPS_API_KEY,
 *        });
 *        Render <GoogleMap> and paint each ward/village polygon by coverage %.
 *
 *   2. react-map-gl (Mapbox / MapLibre)
 *        <Map mapboxAccessToken={import.meta.env.VITE_MAPS_API_KEY} ...>
 *          <Source type="geojson" data={wards}><Layer type="fill" .../></Source>
 *        </Map>
 *
 * DO NOT hardcode the key here — it lives in frontend/.env (gitignored) as
 * VITE_MAPS_API_KEY. Until then, we render a static grid stand-in below.
 */

export interface AreaCell {
  id: string;
  label: string;
  /** 0 (no coverage) .. 1 (full coverage) — drives the heat shade. */
  coverage: number;
}

// Placeholder cells; replaced by real geo features when the map is wired.
const DEMO_CELLS: AreaCell[] = [
  { id: "W-01", label: "Ward 1", coverage: 0.9 },
  { id: "W-04", label: "Ward 4", coverage: 0.72 },
  { id: "W-07", label: "Ward 7", coverage: 0.55 },
  { id: "W-12", label: "Ward 12", coverage: 0.3 },
  { id: "V-02", label: "Village 2", coverage: 0.61 },
  { id: "V-03", label: "Village 3", coverage: 0.18 },
  { id: "V-05", label: "Village 5", coverage: 0.44 },
  { id: "V-09", label: "Village 9", coverage: 0.08 },
  { id: "V-11", label: "Village 11", coverage: 0.5 },
  { id: "W-15", label: "Ward 15", coverage: 0.83 },
  { id: "V-14", label: "Village 14", coverage: 0.27 },
  { id: "W-18", label: "Ward 18", coverage: 0.66 },
];

function heatColor(coverage: number): string {
  // Low coverage = red (attention), high = green. Muted, government-friendly.
  const hue = Math.round(coverage * 120); // 0 red → 120 green
  return `hsl(${hue}, 45%, 82%)`;
}

interface MapPlaceholderProps {
  /** Real coverage cells (from scheme gaps). Falls back to demo cells. */
  cells?: AreaCell[];
}

export default function MapPlaceholder({ cells }: MapPlaceholderProps) {
  const data = cells && cells.length > 0 ? cells : DEMO_CELLS;
  const live = Boolean(cells && cells.length > 0);
  return (
    <div className="map-placeholder" aria-label="Constituency coverage heatmap">
      <div className="map-placeholder__banner">
        <span className="badge">{live ? "Coverage by gap" : "Map placeholder"}</span>
        <span className="muted">
          {live
            ? "Cells shaded red→green by scheme coverage (red = biggest gap)."
            : "Real heatmap renders here once VITE_MAPS_API_KEY is set."}
        </span>
      </div>

      <div className="map-grid" role="img" aria-label="Coverage by area">
        {data.map((cell) => (
          <div
            key={cell.id}
            className="map-cell"
            style={{ backgroundColor: heatColor(cell.coverage) }}
            title={`${cell.label} — ${Math.round(cell.coverage * 100)}% coverage`}
          >
            <span className="map-cell__label">{cell.label}</span>
            <span className="map-cell__value">
              {Math.round(cell.coverage * 100)}%
            </span>
          </div>
        ))}
      </div>

      <div className="map-legend" aria-hidden="true">
        <span>Low coverage</span>
        <div className="map-legend__bar" />
        <span>Full coverage</span>
      </div>
    </div>
  );
}
