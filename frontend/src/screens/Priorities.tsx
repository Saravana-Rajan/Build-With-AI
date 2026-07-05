import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatInr } from "../format";
import type { UnifiedIssue } from "../types";

/** "N raw → M issues, duplicates merged" from the unified-issues clusters. */
function headline(issues: UnifiedIssue[]): string {
  const raw = issues.reduce((sum, i) => sum + (i.report_count || 0), 0);
  const merged = issues.length;
  return `${raw} raw → ${merged} issues, duplicates merged`;
}

/** Top scored factors from a `why` breakdown, rendered as chips. */
function whyFactors(why: Record<string, number> | null | undefined) {
  if (!why) return null;
  const factors = Object.entries(why)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => b[1] - a[1]);
  if (factors.length === 0) return null;
  return (
    <div className="why-factors">
      {factors.map(([factor, value]) => (
        <span key={factor} className="chip chip--muted why-factors__chip">
          {factor} {value.toFixed(2)}
        </span>
      ))}
    </div>
  );
}

export default function Priorities() {
  const issues = useFetch(() => api.unifiedIssues(100));
  const projects = useFetch(() => api.rankedProjects(50));

  return (
    <Page
      title="Priorities"
      subtitle="Deduplicated issues across the constituency and the ranked project list."
    >
      <section className="headline headline--slim" aria-label="Issue summary">
        <span className="headline__label">Signal from noise</span>
        <span className="headline__value headline__value--sm">
          {issues.status === "ready"
            ? headline(issues.data)
            : issues.status === "empty"
              ? "0 raw → 0 issues"
              : issues.status === "error"
                ? "Issues unavailable"
                : "Merging duplicates…"}
        </span>
      </section>

      <h2 className="section-title">Ranked projects</h2>

      {projects.status === "loading" && (
        <StateBlock
          variant="loading"
          title="Computing priority ranking…"
          detail="Projects are scored on demand, need, feasibility, and equity."
        />
      )}
      {projects.status === "empty" && (
        <StateBlock
          variant="empty"
          title="No ranked projects yet"
          detail="Run the analytics job to populate the ranking."
        />
      )}
      {projects.status === "error" && (
        <StateBlock variant="error" title="Could not load ranking" detail={projects.error} />
      )}

      {projects.status === "ready" && (
        <ul className="ranked-list">
          {projects.data.map((p) => (
            <li key={p.rank} className="ranked-item">
              <div className="ranked-item__rank">{p.rank}</div>
              <div className="ranked-item__body">
                <div className="ranked-item__head">
                  <strong>{p.title}</strong>
                  <span className={`chip chip--track-${p.track}`}>Track {p.track}</span>
                </div>
                <div className="muted ranked-item__meta">
                  {p.place_name} · {p.category}
                  {p.matched_scheme ? ` · ${p.matched_scheme}` : ""}
                  {p.estimated_cost != null ? ` · ${formatInr(p.estimated_cost)}` : ""}
                </div>
                {whyFactors(p.why)}
              </div>
              <div className="ranked-item__score num">
                {p.priority_score.toFixed(2)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
