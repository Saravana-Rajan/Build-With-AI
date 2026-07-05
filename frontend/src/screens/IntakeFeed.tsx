import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import Pagination, { usePagination } from "../components/Pagination";
import ProvenanceChip from "../components/Provenance";
import { api } from "../api";
import { useFetch } from "../useFetch";
import type { DemandRow } from "../types";

const PAGE_SIZE = 15;

export default function IntakeFeed() {
  const state = useFetch(() => api.demands(300));
  const [query, setQuery] = useState("");

  const rows: DemandRow[] = state.status === "ready" ? state.data : [];

  // Filter by place name or category text (case-insensitive).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((d) =>
      [d.place_name, d.true_category, d.channel, d.language, d.raw_text]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const { page, pageCount, pageItems, total, from, to, setPage } =
    usePagination(filtered, PAGE_SIZE);

  return (
    <Page
      title="Intake"
      subtitle="Where staff triage incoming demands as they are structured and geo-resolved."
      actions={
        <div className="flex items-center gap-2">
          <ProvenanceChip kind="synthetic" />
          <span className="badge badge--live">Live</span>
        </div>
      }
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
        <>
          <div className="toolbar">
            <div className="search-box">
              <Search className="search-box__icon" size={15} />
              <input
                className="search-box__input"
                type="search"
                placeholder="Filter by place, category, channel…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter demands"
              />
            </div>
            <span className="count-badge">{filtered.length.toLocaleString("en-IN")} demands</span>
          </div>

          {filtered.length === 0 ? (
            <StateBlock
              variant="empty"
              title="No matching demands"
              detail={`Nothing matches “${query}”. Try a different place or category.`}
            />
          ) : (
            <>
              <ul className="feed">
                {pageItems.map((d) => (
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

              <Pagination
                page={page}
                pageCount={pageCount}
                from={from}
                to={to}
                total={total}
                onPageChange={setPage}
                noun="demands"
              />
            </>
          )}
        </>
      )}
    </Page>
  );
}
