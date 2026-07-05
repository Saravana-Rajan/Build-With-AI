import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import type { DemandRecord } from "../types";

// Placeholder rows — real data comes from api.demands() later.
const DEMO: DemandRecord[] = [];

export default function IntakeFeed() {
  const loading = DEMO.length === 0;

  return (
    <Page
      title="Intake"
      subtitle="Live feed of incoming demands as they are structured and geo-resolved."
      actions={<span className="badge badge--live">Live</span>}
    >
      {loading ? (
        <StateBlock
          variant="loading"
          title="Waiting for submissions…"
          detail="New demands will stream in here (web, Telegram, phone, meetings)."
        />
      ) : (
        <ul className="feed">
          {DEMO.map((d) => (
            <li key={d.id} className="feed-item">
              <div className="feed-item__top">
                <span className={`chip chip--${d.urgency}`}>{d.urgency}</span>
                <span className="chip chip--muted">{d.category}</span>
                <span className="chip chip--muted">{d.source}</span>
                {d.place_name && (
                  <span className="feed-item__place">{d.place_name}</span>
                )}
              </div>
              <p className="feed-item__text">{d.need_detail || d.raw_text}</p>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
