import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import type { Category, RankedProject } from "../types";

// Placeholder theme counts — real data from aggregating demands by category.
const THEMES: { category: Category; count: number }[] = [
  { category: "water", count: 0 },
  { category: "road", count: 0 },
  { category: "housing", count: 0 },
  { category: "health", count: 0 },
];

const DEMO: RankedProject[] = [];

export default function Priorities() {
  const loading = DEMO.length === 0;

  return (
    <Page
      title="Priorities"
      subtitle="Dominant themes across the constituency and the ranked project list."
    >
      <section className="theme-row" aria-label="Themes">
        {THEMES.map((t) => (
          <div key={t.category} className="theme-card">
            <span className="theme-card__count">{t.count}</span>
            <span className="theme-card__label">{t.category}</span>
          </div>
        ))}
      </section>

      <h2 className="section-title">Ranked projects</h2>
      {loading ? (
        <StateBlock
          variant="loading"
          title="Computing priority ranking…"
          detail="Projects are scored on need, coverage gap, and beneficiaries."
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Project</th>
              <th>Area</th>
              <th>Track</th>
              <th className="num">Score</th>
              <th className="num">Est. cost (₹)</th>
            </tr>
          </thead>
          <tbody>
            {DEMO.map((p) => (
              <tr key={p.rank}>
                <td>{p.rank}</td>
                <td>{p.title}</td>
                <td>{p.place_name}</td>
                <td>
                  <span className={`chip chip--track-${p.track}`}>
                    Track {p.track}
                  </span>
                </td>
                <td className="num">{p.priority_score.toFixed(1)}</td>
                <td className="num">
                  {p.estimated_cost != null
                    ? p.estimated_cost.toLocaleString("en-IN")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}
