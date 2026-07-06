/**
 * AreaMap — real Google Maps coverage heatmap, hero of the Constituency X-Ray.
 *
 * Fills the left column vertically (no dead space) and paints one circle per
 * area, shaded red → amber → green by scheme-coverage severity (red = biggest
 * gap), sized by ₹ owed. Coordinates come from the bundled geo files
 * (src/data/*.json, geo only — no credentials). The Maps key is read from
 * import.meta.env.VITE_MAPS_API_KEY and is NEVER hardcoded. A compact grid view
 * is kept as a secondary toggle. If the key is missing or the map fails to load,
 * we fall back to the static grid (MapPlaceholder) so the screen never crashes.
 */
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APIProvider,
  Map as GoogleMap,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import MapPlaceholder, { type AreaCell } from "./MapPlaceholder";
import { formatCrore } from "../format";
import type { SchemeGap } from "../types";
import urbanWards from "../data/urban_wards.json";
import fringeVillages from "../data/fringe_villages.json";

// ── Geo lookup: area_id → { name, lat, lng } from the bundled geo files ──────
interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

const COIMBATORE = { lat: 11.0168, lng: 76.9558 };

const AREA_COORDS: Record<string, GeoPoint> = (() => {
  const map: Record<string, GeoPoint> = {};
  const rows = [...urbanWards, ...fringeVillages] as Array<{
    id: string;
    name: string;
    approx_lat: number;
    approx_lng: number;
  }>;
  for (const r of rows) {
    map[r.id] = { name: r.name, lat: r.approx_lat, lng: r.approx_lng };
  }
  return map;
})();

// ── Aggregate scheme gaps → one weighted point per area ──────────────────────
interface AreaAgg {
  areaId: string;
  name: string;
  lat: number;
  lng: number;
  eligible: number;
  covered: number;
  coverage: number; // 0..1
  gapValue: number; // ₹
  topScheme: string;
  topSchemeGap: number;
  schemeCount: number;
}

function aggregate(gaps: SchemeGap[]): AreaAgg[] {
  const byArea = new Map<string, AreaAgg>();
  for (const g of gaps) {
    const geo = AREA_COORDS[g.area_id];
    if (!geo) continue; // no coordinates → skip gracefully
    let a = byArea.get(g.area_id);
    if (!a) {
      a = {
        areaId: g.area_id,
        name: geo.name || g.place_name,
        lat: geo.lat,
        lng: geo.lng,
        eligible: 0,
        covered: 0,
        coverage: 0,
        gapValue: 0,
        topScheme: g.scheme,
        topSchemeGap: -Infinity,
        schemeCount: 0,
      };
      byArea.set(g.area_id, a);
    }
    a.eligible += g.eligible;
    a.covered += g.covered;
    a.gapValue += g.gap_value;
    a.schemeCount += 1;
    if (g.gap_value > a.topSchemeGap) {
      a.topSchemeGap = g.gap_value;
      a.topScheme = g.scheme;
    }
  }
  const list = Array.from(byArea.values());
  for (const a of list) {
    a.coverage = a.eligible > 0 ? Math.max(0, Math.min(1, a.covered / a.eligible)) : 0;
  }
  return list;
}

// ── Sabha palette: read theme tokens so colours track light/dark mode ────────
interface Palette {
  red: string;
  amber: string;
  green: string;
}

function cssHsl(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
}

function readPalette(): Palette {
  return {
    red: cssHsl("--destructive", "hsl(4 68% 46%)"),
    amber: cssHsl("--saffron", "hsl(38 92% 50%)"),
    green: cssHsl("--success", "hsl(158 64% 30%)"),
  };
}

/** Low coverage → red (attention), mid → amber, well covered → green. */
function severityColor(coverage: number, p: Palette): string {
  if (coverage < 0.34) return p.red;
  if (coverage < 0.67) return p.amber;
  return p.green;
}

/** Bigger ₹ gap → bigger circle (sqrt scale so area ~ value). */
function radiusFor(gapValue: number, maxGap: number): number {
  const t = maxGap > 0 ? Math.sqrt(Math.max(0, gapValue) / maxGap) : 0;
  return 500 + 2200 * t; // metres
}

// ── A single coverage circle, drawn via the core Maps API ────────────────────
function GapCircle({
  area,
  color,
  radius,
  onSelect,
}: {
  area: AreaAgg;
  color: string;
  radius: number;
  onSelect: (a: AreaAgg) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({
      map,
      center: { lat: area.lat, lng: area.lng },
      radius,
      fillColor: color,
      fillOpacity: 0.5,
      strokeColor: color,
      strokeOpacity: 0.95,
      strokeWeight: 1.5,
      clickable: true,
    });
    const onClick = circle.addListener("click", () => onSelect(area));
    const onHover = circle.addListener("mouseover", () => onSelect(area));
    return () => {
      onClick.remove();
      onHover.remove();
      circle.setMap(null);
    };
  }, [map, area, color, radius, onSelect]);
  return null;
}

// ── The Google Map itself (mounts only once the Maps JS has an API key) ───────
function MapCanvas({ gaps }: { gaps: SchemeGap[] }) {
  const areas = useMemo(() => aggregate(gaps), [gaps]);
  const palette = useMemo(readPalette, []);
  const maxGap = useMemo(
    () => areas.reduce((m, a) => Math.max(m, a.gapValue), 0),
    [areas],
  );
  const [selected, setSelected] = useState<AreaAgg | null>(null);
  const onSelect = useCallback((a: AreaAgg) => setSelected(a), []);

  return (
    <GoogleMap
      defaultCenter={COIMBATORE}
      defaultZoom={11}
      gestureHandling="greedy"
      disableDefaultUI={false}
      clickableIcons={false}
      style={{ width: "100%", height: "100%" }}
    >
      {areas.map((a) => (
        <GapCircle
          key={a.areaId}
          area={a}
          color={severityColor(a.coverage, palette)}
          radius={radiusFor(a.gapValue, maxGap)}
          onSelect={onSelect}
        />
      ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.lat, lng: selected.lng }}
          onCloseClick={() => setSelected(null)}
          pixelOffset={[0, -4]}
        >
          <div style={{ minWidth: 180, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2733" }}>
              {selected.name}
            </div>
            <div style={{ fontSize: 12, color: "#33404b", marginTop: 4 }}>
              Coverage: <strong>{Math.round(selected.coverage * 100)}%</strong>
            </div>
            <div style={{ fontSize: 12, color: "#33404b" }}>
              ₹ gap: <strong>{formatCrore(selected.gapValue)}</strong>
            </div>
            <div style={{ fontSize: 12, color: "#33404b" }}>
              Scheme: <strong>{selected.topScheme}</strong>
              {selected.schemeCount > 1 ? ` (+${selected.schemeCount - 1} more)` : ""}
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

// ── Compact grid view (secondary toggle) ─────────────────────────────────────
function heatColor(coverage: number): string {
  const hue = Math.round(coverage * 120); // 0 red → 120 green
  return `hsl(${hue}, 45%, 82%)`;
}

function GridCanvas({ cells }: { cells: AreaCell[] }) {
  if (cells.length === 0) {
    return (
      <div className="areamap__empty muted">
        No coverage cells for the current filter.
      </div>
    );
  }
  return (
    <div className="map-grid map-grid--fill" role="img" aria-label="Coverage by area">
      {cells.map((cell) => (
        <div
          key={cell.id}
          className="map-cell"
          style={{ backgroundColor: heatColor(cell.coverage) }}
          title={`${cell.label} — ${Math.round(cell.coverage * 100)}% coverage`}
        >
          <span className="map-cell__label">{cell.label}</span>
          <span className="map-cell__value">{Math.round(cell.coverage * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Error boundary: any Maps render error → static grid fallback ──────────────
class MapErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

type View = "map" | "grid";

interface AreaMapProps {
  /** Scheme gaps from GET /api/scheme-gaps (already filtered by the screen). */
  gaps: SchemeGap[];
  /** Cells for the compact grid view / static fallback. */
  fallbackCells?: AreaCell[];
}

export default function AreaMap({ gaps, fallbackCells }: AreaMapProps) {
  const apiKey = import.meta.env.VITE_MAPS_API_KEY;
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("map");
  const cells = fallbackCells ?? [];

  // Google reports auth/referrer/quota failures (e.g. RefererNotAllowedMapError)
  // via the global window.gm_authFailure callback — NOT via APIProvider.onError.
  // Register it so ANY such failure auto-switches to the grid fallback; the user
  // must never see Google's broken "Oops! Something went wrong" card.
  useEffect(() => {
    const w = window as typeof window & { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => setFailed(true);
    return () => {
      w.gm_authFailure = prev;
    };
  }, []);

  // No key, or the Maps JS refused to load → graceful static fallback.
  if (!apiKey || failed) {
    return <MapPlaceholder cells={fallbackCells} />;
  }

  return (
    <MapErrorBoundary fallback={<MapPlaceholder cells={fallbackCells} />}>
      <div className="areamap">
        <div className="areamap__toolbar">
          <div className="areamap__lede">
            <span className="badge">Live coverage map</span>
            <span className="muted areamap__hint">
              Red = biggest gap · size tracks ₹ owed
            </span>
          </div>
          <div className="viewtoggle" role="group" aria-label="Map view">
            <button
              type="button"
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              Map
            </button>
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              Grid
            </button>
          </div>
        </div>

        <div className="areamap__canvas">
          {view === "map" ? (
            <APIProvider apiKey={apiKey} onError={() => setFailed(true)}>
              <MapCanvas gaps={gaps} />
            </APIProvider>
          ) : (
            <GridCanvas cells={cells} />
          )}
        </div>

        <div className="map-legend" aria-hidden="true">
          <span>Low coverage</span>
          <div className="map-legend__bar" />
          <span>Full coverage</span>
        </div>
      </div>
    </MapErrorBoundary>
  );
}
