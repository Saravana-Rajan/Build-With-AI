import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import { api } from "../api";
import { useFetch } from "../useFetch";

export default function IntakeFeed() {
  const state = useFetch(() => api.demands(50));

  return (
    <Page
      title="Intake"
      subtitle="Live feed of incoming demands as they are structured and geo-resolved."
      actions={<span className="badge badge--live">Live</span>}
    >
      {state.status === "loading" && (
        <StateBlock
          variant="loading"
          title="Waiting for submissions…"
          detail="New demands will stream in here (web, Telegram, phone, meetings)."
        />
      )}

      {state.status === "empty" && (
        <StateBlock
          variant="empty"
          title="No demands yet"
          detail="Once submissions arrive they appear here newest-first."
        />
      )}

      {state.status === "error" && (
        <StateBlock variant="error" title="Could not load intake" detail={state.error} />
      )}

      {state.status === "ready" && (
        <ul className="feed">
          {state.data.map((d) => (
            <li key={d.id} className="feed-item">
              <div className="feed-item__top">
                {d.language && (
                  <span className="chip chip--muted">{d.language.toUpperCase()}</span>
                )}
                {d.true_category && (
                  <span className="chip chip--muted">{d.true_category}</span>
                )}
                {d.channel && <span className="chip chip--muted">{d.channel}</span>}
                {d.place_name && (
                  <span className="feed-item__place">
                    {d.place_name}
                    {d.urban ? " · urban" : " · rural"}
                  </span>
                )}
              </div>
              <p className="feed-item__text">{d.raw_text || "(no text)"}</p>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
