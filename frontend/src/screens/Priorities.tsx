import { useMemo } from "react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import Pagination, { usePagination } from "../components/Pagination";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatInr } from "../format";
import type { RankedProject, UnifiedIssue } from "../types";

const PAGE_SIZE = 12;

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

/** Sampled score-distribution spark: bars scaled to the top score. */
function ScoreSpark({ scores }: { scores: number[] }) {
  const bars = useMemo(() => {
    if (scores.length === 0) return [];
    const max = Math.max(...scores) || 1;
    const target = 48;
    const step = Math.max(1, Math.ceil(scores.length / target));
    const sampled: number[] = [];
    for (let i = 0; i < scores.length; i += step) sampled.push(scores[i]);
    return sampled.map((s) => Math.max(6, Math.round((s / max) * 100)));
  }, [scores]);
  if (bars.length === 0) return null;
  return (
    <div className="score-spark" role="img" aria-label="Priority score distribution, highest first">
      {bars.map((h, i) => (
        <span key={i} className="score-spark__bar" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export default function Priorities() {
  const issues = useFetch(() => api.unifiedIssues(300));
  const projects = useFetch(() => api.rankedProjects(300));

  // Sort by score (desc) and re-rank 1..N regardless of backend row order.
  const ranked: RankedProject[] = useMemo(() => {
    const rows = projects.status === "ready" ? projects.data : [];
    return [...rows]
      .sort((a, b) => b.priority_score - a.priority_score)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }, [projects]);

  const scores = ranked.map((p) => p.priority_score);
  const topScore = scores.length ? scores[0] : 0;
  const medianScore = scores.length ? scores[Math.floor(scores.length / 2)] : 0;

  const { page, pageCount, pageItems, total, from, to, setPage } =
    usePagination(ranked, PAGE_SIZE);

  return (
    <Page
      title="Priorities"
      subtitle="Deduplicated issues across the constituency and the ranked project list."
    >
      <section className="headline headline--slim" aria-label="Issue summary">
        <span className="headline__label">Signal from noise · duplicates merged</span>
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

      {projects.status === "ready" && ranked.length > 0 && (
        <div className="card spark-card">
          <div className="spark-card__meta">
            <span className="dept-panel__label">Score distribution</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {ranked.length.toLocaleString("en-IN")} ranked · top {topScore.toFixed(2)} · median{" "}
              {medianScore.toFixed(2)}
            </span>
          </div>
          <ScoreSpark scores={scores} />
        </div>
      )}

      <h2 className="section-title">
        Ranked projects
        {projects.status === "ready" && (
          <span className="count-badge">{ranked.length.toLocaleString("en-IN")}</span>
        )}
      </h2>

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
        <>
          <ul className="ranked-list">
            {pageItems.map((p) => (
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
                <div className="ranked-item__score num">{p.priority_score.toFixed(2)}</div>
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
            noun="projects"
          />
        </>
      )}
    </Page>
  );
}
