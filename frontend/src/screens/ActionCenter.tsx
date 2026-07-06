import { useMemo } from "react";
import { Link } from "react-router-dom";
import StateBlock from "../components/StateBlock";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatCrore } from "../format";
import type {
  DemandRow,
  Department,
  RankedProject,
  SilentVillage,
} from "../types";

/**
 * Today — the MP's morning briefing for Coimbatore.
 * "What needs your attention today", assembled from the live intake feed,
 * the ranked project list, the department rollup and the silent-village index.
 */

// ── Local helpers ────────────────────────────────────────────────────────────

/** Urgency severity, most-urgent first; null/unknown sorts last. */
const URGENCY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function urgencyRank(u: string | null | undefined): number {
  if (!u) return 99;
  return URGENCY_RANK[u] ?? 99;
}

/** Parse a tolerant timestamp to epoch ms for newest-first sorting. */
function toTime(s: string | null | undefined): number {
  if (!s) return 0;
  const d = new Date(s.replace(" ", "T"));
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Colour meta for an urgency pill. */
function urgencyPill(
  u: string | null | undefined,
): { label: string; bg: string; fg: string; border: string } | null {
  switch (u) {
    case "critical":
      return {
        label: "Critical",
        bg: "hsl(0 84% 97%)",
        fg: "hsl(0 72% 45%)",
        border: "hsl(0 84% 92%)",
      };
    case "high":
      return {
        label: "High",
        bg: "hsl(45 96% 95%)",
        fg: "hsl(38 80% 38%)",
        border: "hsl(45 90% 88%)",
      };
    case "medium":
      return {
        label: "Medium",
        bg: "hsl(var(--secondary))",
        fg: "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
      };
    case "low":
      return {
        label: "Low",
        bg: "hsl(var(--secondary))",
        fg: "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
      };
    default:
      return null;
  }
}

/** One coloured "attention" stat tile that links to a deeper screen. */
function StatTile({
  to,
  label,
  value,
  hint,
  accent,
}: {
  to: string;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "16px 18px",
        textDecoration: "none",
        color: "inherit",
        borderTop: `3px solid ${accent}`,
        minWidth: 0,
      }}
    >
      <span
        className="muted"
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span
        className="num"
        style={{
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.1,
          color: accent,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12.5, color: "hsl(var(--muted-foreground))" }}>
        {hint}
      </span>
    </Link>
  );
}

/** A briefing card: title, optional header action, body. */
function BriefCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2
          className="section-title"
          style={{ margin: 0, fontSize: 16 }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Link styled as a subtle header action. */
function HeaderLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "hsl(var(--primary, var(--foreground)))",
        textDecoration: "none",
        flexShrink: 0,
      }}
    >
      {children}
    </Link>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ActionCenter() {
  const stats = useFetch(() => api.stats());
  const demands = useFetch(() => api.demands(300));
  const projects = useFetch(() => api.rankedProjects(300));
  const departments = useFetch(() => api.departments());
  const villages = useFetch(() => api.silentVillages(50));

  const demandRows: DemandRow[] =
    demands.status === "ready" ? demands.data : [];
  const projectRows: RankedProject[] =
    projects.status === "ready" ? projects.data : [];
  const departmentRows: Department[] =
    departments.status === "ready" ? departments.data : [];
  const villageRows: SilentVillage[] =
    villages.status === "ready" ? villages.data : [];

  // Urgent complaints: critical + high, most-urgent then newest first.
  const urgentDemands = useMemo(() => {
    return [...demandRows]
      .filter((d) => d.urgency === "critical" || d.urgency === "high")
      .sort((a, b) => {
        const r = urgencyRank(a.urgency) - urgencyRank(b.urgency);
        if (r !== 0) return r;
        return toTime(b.created_at) - toTime(a.created_at);
      });
  }, [demandRows]);

  const urgentCount = urgentDemands.length;
  const topUrgent = urgentDemands.slice(0, 6);

  // Ranked projects sorted by score desc.
  const rankedByScore = useMemo(() => {
    return [...projectRows].sort(
      (a, b) => b.priority_score - a.priority_score,
    );
  }, [projectRows]);

  const topPriorities = rankedByScore.slice(0, 3);
  const worksToFund = useMemo(
    () => projectRows.filter((p) => p.track === "B").length,
    [projectRows],
  );

  // Biggest-entitlement department.
  const topDepartment = useMemo(() => {
    if (departmentRows.length === 0) return null;
    return [...departmentRows].sort(
      (a, b) => b.total_gap_value - a.total_gap_value,
    )[0];
  }, [departmentRows]);

  // Top silent village by silent_score.
  const topVillage = useMemo(() => {
    if (villageRows.length === 0) return null;
    return [...villageRows].sort(
      (a, b) => b.silent_score - a.silent_score,
    )[0];
  }, [villageRows]);

  const statsData = stats.status === "ready" ? stats.data : null;

  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        What needs your attention across Coimbatore today.
      </p>
      {/* 1 · Attention stat tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatTile
          to="/intake"
          label="Urgent complaints"
          value={demands.status === "ready" ? String(urgentCount) : "—"}
          hint="Critical + high, need triage"
          accent="hsl(0 72% 50%)"
        />
        <StatTile
          to="/act"
          label="Entitlements to unlock"
          value={statsData ? formatCrore(statsData.rupees_owed) : "₹—"}
          hint="Owed to citizens, ready to claim"
          accent="hsl(152 55% 38%)"
        />
        <StatTile
          to="/act"
          label="Works to fund"
          value={projects.status === "ready" ? String(worksToFund) : "—"}
          hint="Track B · MPLADS candidates"
          accent="hsl(213 70% 48%)"
        />
        <StatTile
          to="/forgotten"
          label="Silent villages"
          value={statsData ? String(statsData.silent_villages) : "—"}
          hint="High need, few petitions"
          accent="hsl(38 80% 45%)"
        />
      </div>

      {/* 2 · Urgent complaints */}
      <div style={{ marginBottom: 20 }}>
        <BriefCard
          title="Urgent complaints"
          action={<HeaderLink to="/intake">View all in Intake →</HeaderLink>}
        >
          {demands.status === "loading" && (
            <StateBlock
              variant="loading"
              title="Scanning intake…"
              detail="Pulling the most urgent citizen complaints."
            />
          )}
          {demands.status === "error" && (
            <StateBlock
              variant="error"
              title="Could not load intake"
              detail={demands.error}
            />
          )}
          {(demands.status === "empty" ||
            (demands.status === "ready" && topUrgent.length === 0)) && (
            <StateBlock
              variant="empty"
              title="No urgent complaints"
              detail="Nothing critical or high is waiting right now."
            />
          )}
          {demands.status === "ready" && topUrgent.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {topUrgent.map((d) => {
                const pill = urgencyPill(d.urgency);
                return (
                  <li
                    key={d.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      padding: "10px 12px",
                      borderRadius: "0.6rem",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {pill && (
                        <span
                          className="chip"
                          style={{
                            background: pill.bg,
                            color: pill.fg,
                            borderColor: pill.border,
                            fontWeight: 700,
                          }}
                        >
                          {pill.label}
                        </span>
                      )}
                      {d.true_category && (
                        <span className="chip chip--muted">
                          {d.true_category}
                        </span>
                      )}
                      {d.place_name && (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "hsl(var(--foreground))",
                          }}
                        >
                          {d.place_name}
                          {d.urban ? " · urban" : " · rural"}
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        color: "hsl(var(--muted-foreground))",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {d.raw_text || "(no text)"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </BriefCard>
      </div>

      {/* 3 · Top priorities to act */}
      <div style={{ marginBottom: 20 }}>
        <BriefCard
          title="Top priorities to act"
          action={<HeaderLink to="/priorities">Open Priorities →</HeaderLink>}
        >
          {projects.status === "loading" && (
            <StateBlock
              variant="loading"
              title="Computing priority ranking…"
              detail="Scoring projects on demand, need, feasibility and equity."
            />
          )}
          {projects.status === "error" && (
            <StateBlock
              variant="error"
              title="Could not load ranking"
              detail={projects.error}
            />
          )}
          {(projects.status === "empty" ||
            (projects.status === "ready" && topPriorities.length === 0)) && (
            <StateBlock
              variant="empty"
              title="No ranked projects yet"
              detail="Run the analytics job to populate the ranking."
            />
          )}
          {projects.status === "ready" && topPriorities.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {topPriorities.map((p, i) => (
                <li
                  key={`${p.area_id}-${p.rank}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: "0.6rem",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "hsl(var(--muted-foreground))",
                      minWidth: 24,
                      textAlign: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 14,
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        {p.title}
                      </strong>
                      <span className={`chip chip--track-${p.track}`}>
                        Track {p.track}
                      </span>
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 12.5, marginTop: 2 }}
                    >
                      {p.place_name} · {p.category}
                    </div>
                  </div>
                  <div
                    className="num"
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {Math.round(p.priority_score * 100)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BriefCard>
      </div>

      {/* 4 · Unlock the biggest entitlement */}
      <div style={{ marginBottom: 20 }}>
        <BriefCard title="Unlock the biggest entitlement">
          {departments.status === "loading" && (
            <StateBlock
              variant="loading"
              title="Rolling up departments…"
              detail="Summing what each line department owes."
            />
          )}
          {departments.status === "error" && (
            <StateBlock
              variant="error"
              title="Could not load departments"
              detail={departments.error}
            />
          )}
          {(departments.status === "empty" ||
            (departments.status === "ready" && !topDepartment)) && (
            <StateBlock
              variant="empty"
              title="No department gaps yet"
              detail="Run the scheme-gap analysis to populate this view."
            />
          )}
          {departments.status === "ready" && topDepartment && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <strong
                  style={{
                    fontSize: 17,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {topDepartment.department}
                </strong>
                <span
                  className="num"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "hsl(var(--success))",
                  }}
                >
                  {formatCrore(topDepartment.total_gap_value)}
                </span>
                <span
                  className="muted"
                  style={{ fontSize: 13 }}
                >
                  owed · {topDepartment.issue_count.toLocaleString("en-IN")}{" "}
                  issues
                </span>
              </div>
              {topDepartment.schemes.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {topDepartment.schemes.slice(0, 3).map((s) => (
                    <span key={s} className="chip chip--muted">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <div>
                <Link
                  to="/act"
                  className="btn"
                  style={{ textDecoration: "none" }}
                >
                  Draft the letter in Act →
                </Link>
              </div>
            </div>
          )}
        </BriefCard>
      </div>

      {/* 5 · Reach a forgotten village */}
      <div>
        <BriefCard
          title="Reach a forgotten village"
          action={
            <HeaderLink to="/forgotten">See Forgotten Villages →</HeaderLink>
          }
        >
          {villages.status === "loading" && (
            <StateBlock
              variant="loading"
              title="Finding silent areas…"
              detail="Ranking villages with high need and few petitions."
            />
          )}
          {villages.status === "error" && (
            <StateBlock
              variant="error"
              title="Could not load silent villages"
              detail={villages.error}
            />
          )}
          {(villages.status === "empty" ||
            (villages.status === "ready" && !topVillage)) && (
            <StateBlock
              variant="empty"
              title="No silent villages flagged"
              detail="Every area is petitioning in line with its need."
            />
          )}
          {villages.status === "ready" && topVillage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <strong
                style={{
                  fontSize: 17,
                  color: "hsl(var(--foreground))",
                }}
              >
                {topVillage.place_name}
              </strong>
              <span className="chip chip--muted">
                Need {Math.round(topVillage.need_score * 100)}/100
              </span>
              <span className="chip chip--muted">
                {topVillage.petition_count.toLocaleString("en-IN")} petitions
              </span>
              {topVillage.flagged && (
                <span
                  className="chip"
                  style={{
                    background: "hsl(45 96% 95%)",
                    color: "hsl(38 80% 38%)",
                    borderColor: "hsl(45 90% 88%)",
                    fontWeight: 700,
                  }}
                >
                  Flagged
                </span>
              )}
            </div>
          )}
        </BriefCard>
      </div>
    </div>
  );
}
