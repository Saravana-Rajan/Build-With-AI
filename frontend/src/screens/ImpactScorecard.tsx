import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Coins,
  HardHat,
  Users,
  MapPin,
  FileText,
  Send,
  CheckCircle2,
  BadgeIndianRupee,
  Building2,
  ArrowRight,
} from "lucide-react";
import StateBlock from "../components/StateBlock";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatCrore } from "../format";
import {
  getActions,
  actionCounts,
  onActionsChanged,
  STATUS_LABEL,
} from "../lib/actions";
import type { MpAction, ActionStatus } from "../types";

/** Indian-grouped integer, e.g. "12,45,000". */
const countInr = (n: number): string => Math.round(n).toLocaleString("en-IN");

// ── Hero tile: one big, colorful "potential on the table" number ─────────────
interface HeroTile {
  key: string;
  icon: ReactNode;
  value: string;
  label: string;
  accent: string; // hsl(...) — the tile's theme color
  tint: string; // faint background wash
}

function HeroTileCard({ tile }: { tile: HeroTile }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: "0.9rem",
        border: `1px solid ${tile.accent}33`,
        background: tile.tint,
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 4,
          background: tile.accent,
        }}
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: "0.6rem",
          background: `${tile.accent}1f`,
          color: tile.accent,
        }}
      >
        {tile.icon}
      </span>
      <span
        className="num"
        style={{
          fontSize: 30,
          fontWeight: 800,
          lineHeight: 1.05,
          color: "hsl(var(--foreground))",
          letterSpacing: "-0.01em",
        }}
      >
        {tile.value}
      </span>
      <span
        style={{
          fontSize: 13,
          lineHeight: 1.4,
          color: "hsl(var(--muted-foreground))",
        }}
      >
        {tile.label}
      </span>
    </div>
  );
}

// ── Record band: a compact "your record so far" stat ─────────────────────────
function RecordStat({
  icon,
  value,
  label,
  accent,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 150px",
        minWidth: 150,
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: "0.7rem",
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "0.55rem",
          background: `${accent}1a`,
          color: accent,
        }}
      >
        {icon}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <strong
          className="num"
          style={{ fontSize: 19, lineHeight: 1.1, color: "hsl(var(--foreground))" }}
        >
          {value}
        </strong>
        <span style={{ fontSize: 12.5, color: "hsl(var(--muted-foreground))" }}>
          {label}
        </span>
      </span>
    </div>
  );
}

export default function ImpactScorecard() {
  const stats = useFetch(() => api.stats(), () => false);
  const projects = useFetch(() => api.rankedProjects(300));
  const depts = useFetch(() => api.departments());

  // Action log is localStorage-backed — read into state, refresh on change.
  const [actions, setActions] = useState<MpAction[]>(() => getActions());
  const [counts, setCounts] = useState<
    Record<ActionStatus, number> & { total: number }
  >(() => actionCounts());

  useEffect(() => {
    const refresh = () => {
      setActions(getActions());
      setCounts(actionCounts());
    };
    return onActionsChanged(refresh);
  }, []);

  // ── Hero: potential impact still on the table ──────────────────────────────
  const projectRows = projects.status === "ready" ? projects.data : [];

  const fundableWorks = useMemo(
    () => projectRows.filter((p) => p.track === "B").length,
    [projectRows],
  );
  const residentsInScope = useMemo(
    () => projectRows.reduce((sum, p) => sum + (p.beneficiaries ?? 0), 0),
    [projectRows],
  );

  const heroLoading =
    stats.status === "loading" || projects.status === "loading";
  const heroError =
    stats.status === "error"
      ? stats.error
      : projects.status === "error"
        ? projects.error
        : null;

  const heroTiles: HeroTile[] =
    stats.status === "ready"
      ? [
          {
            key: "owed",
            icon: <Coins size={18} />,
            value: formatCrore(stats.data.rupees_owed),
            label: "entitlements owed to unlock (₹0 cost)",
            accent: "hsl(var(--success))",
            tint: "hsl(160 84% 96%)",
          },
          {
            key: "works",
            icon: <HardHat size={18} />,
            value: countInr(fundableWorks),
            label: "local works fundable via MPLADS",
            accent: "hsl(var(--primary))",
            tint: "hsl(213 58% 24% / 0.04)",
          },
          {
            key: "residents",
            icon: <Users size={18} />,
            value: countInr(residentsInScope),
            label: "residents in scope",
            accent: "hsl(var(--saffron))",
            tint: "hsl(33 100% 96%)",
          },
          {
            key: "villages",
            icon: <MapPin size={18} />,
            value: countInr(stats.data.silent_villages),
            label: "forgotten villages surfaced",
            accent: "hsl(280 55% 48%)",
            tint: "hsl(280 60% 97%)",
          },
        ]
      : [];

  // ── Record: what the MP has actually done, from the action log ─────────────
  const lettersSent = actions.filter((a) => a.kind === "letter").length;
  const worksFunded = actions.filter((a) => a.kind === "work").length;
  const rupeesCommitted = actions
    .filter((a) => a.kind === "work")
    .reduce((sum, a) => sum + (a.rupees ?? 0), 0);
  const residentsServed = actions.reduce(
    (sum, a) => sum + (a.beneficiaries ?? 0),
    0,
  );

  // ── Where the money is owed: top departments by ₹ owed ─────────────────────
  const topDepts = useMemo(() => {
    const rows = depts.status === "ready" ? depts.data : [];
    return [...rows]
      .sort((a, b) => b.total_gap_value - a.total_gap_value)
      .slice(0, 6);
  }, [depts]);
  const maxGap = topDepts.length ? topDepts[0].total_gap_value : 0;

  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Your record and the impact still on the table.
      </p>

      {/* ── 1. Potential impact ──────────────────────────────────────────── */}
      <section aria-label="Potential impact on the table" style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Sparkles size={17} color="hsl(var(--saffron))" />
          <h2 className="section-title" style={{ margin: 0 }}>
            Potential impact on the table
          </h2>
        </div>

        {heroLoading && (
          <StateBlock variant="loading" title="Tallying the numbers…" />
        )}
        {heroError && (
          <StateBlock
            variant="error"
            title="Could not load the scorecard"
            detail={heroError}
          />
        )}
        {!heroLoading && !heroError && heroTiles.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            {heroTiles.map((tile) => (
              <HeroTileCard key={tile.key} tile={tile} />
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Your record so far ────────────────────────────────────────── */}
      <section aria-label="Your record so far" style={{ marginBottom: 28 }}>
        <h2 className="section-title" style={{ marginBottom: 12 }}>
          Your record so far
        </h2>

        {counts.total === 0 ? (
          <div
            className="state-block state-block--empty"
            role="status"
            style={{ gap: 10 }}
          >
            <span className="state-block__title">No actions logged yet</span>
            <span className="state-block__detail">
              Send a department letter or fund a work in Act, and your record
              builds here.
            </span>
            <Link
              to="/act"
              className="btn btn--primary btn--sm"
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Go to Act <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <RecordStat
                icon={<Send size={16} />}
                value={countInr(lettersSent)}
                label="letters sent"
                accent="hsl(var(--primary))"
              />
              <RecordStat
                icon={<HardHat size={16} />}
                value={countInr(worksFunded)}
                label="works funded"
                accent="hsl(var(--saffron))"
              />
              <RecordStat
                icon={<BadgeIndianRupee size={16} />}
                value={formatCrore(rupeesCommitted)}
                label="₹ committed"
                accent="hsl(var(--success))"
              />
              <RecordStat
                icon={<Users size={16} />}
                value={countInr(residentsServed)}
                label="residents served"
                accent="hsl(280 55% 48%)"
              />
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                }}
              >
                <FileText size={14} /> Follow-up status
              </span>
              <span className="chip chip--muted">
                {STATUS_LABEL.sent} {counts.sent}
              </span>
              <span className="chip chip--muted">
                {STATUS_LABEL.acknowledged} {counts.acknowledged}
              </span>
              <span
                className="chip"
                style={{
                  background: "hsl(160 84% 95%)",
                  color: "hsl(var(--success))",
                  borderColor: "hsl(160 60% 85%)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <CheckCircle2 size={13} /> {STATUS_LABEL.resolved}{" "}
                {counts.resolved}
              </span>
            </div>
          </>
        )}
      </section>

      {/* ── 3. Where the money is owed ───────────────────────────────────── */}
      <section aria-label="Where the money is owed">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Building2 size={17} color="hsl(var(--muted-foreground))" />
          <h2 className="section-title" style={{ margin: 0 }}>
            Where the money is owed
          </h2>
        </div>

        {depts.status === "loading" && (
          <StateBlock variant="loading" title="Loading departments…" />
        )}
        {depts.status === "empty" && (
          <StateBlock variant="empty" title="No departmental gaps computed yet" />
        )}
        {depts.status === "error" && (
          <StateBlock
            variant="error"
            title="Could not load departments"
            detail={depts.error}
          />
        )}
        {depts.status === "ready" && topDepts.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "16px 18px",
              borderRadius: "0.8rem",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
          >
            {topDepts.map((d) => {
              const pct =
                maxGap > 0 ? Math.max(4, (d.total_gap_value / maxGap) * 100) : 0;
              return (
                <div key={d.department}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 12,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.department}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexShrink: 0,
                        fontSize: 13,
                      }}
                    >
                      <strong className="num" style={{ color: "hsl(var(--foreground))" }}>
                        {formatCrore(d.total_gap_value)}
                      </strong>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>
                        {countInr(d.issue_count)}{" "}
                        {d.issue_count === 1 ? "issue" : "issues"}
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      background: "hsl(var(--border))",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, hsl(var(--saffron)), hsl(var(--saffron) / 0.65))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
