import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import Pagination, { usePagination } from "../components/Pagination";
import ProvenanceChip from "../components/Provenance";
import { api } from "../api";
import { useFetch } from "../useFetch";
import type { SilentVillage } from "../types";

const PAGE_SIZE = 15;

type SortKey = "need_score" | "petition_count" | "silent_score";

export default function ForgottenVillages() {
  const state = useFetch(() => api.silentVillages(300));
  const [sortKey, setSortKey] = useState<SortKey>("silent_score");
  const [asc, setAsc] = useState(false);

  const rows: SilentVillage[] = state.status === "ready" ? state.data : [];

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey],
    );
  }, [rows, sortKey, asc]);

  const { page, pageCount, pageItems, total, from, to, setPage } =
    usePagination(sorted, PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      setAsc(false);
    }
  }

  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      className={`th-sort${sortKey === key ? " th-sort--active" : ""}`}
      onClick={() => toggleSort(key)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <ArrowUpDown size={12} />
    </button>
  );

  return (
    <Page
      title="Forgotten Villages"
      subtitle="Villages that never asked — high estimated need but few or no petitions. The silent constituents you'd otherwise miss."
      actions={
        state.status === "ready" ? (
          <div className="flex items-center gap-2">
            <ProvenanceChip kind="computed" />
            <span className="count-badge">{rows.length.toLocaleString("en-IN")} areas</span>
          </div>
        ) : undefined
      }
    >
      {state.status === "loading" && (
        <StateBlock
          variant="loading"
          title="Scanning for silent areas…"
          detail="High need + low petition volume surfaces the places going unheard."
        />
      )}
      {state.status === "empty" && (
        <StateBlock variant="empty" title="No silent villages flagged" />
      )}
      {state.status === "error" && (
        <StateBlock variant="error" title="Could not load silent villages" detail={state.error} />
      )}

      {state.status === "ready" && (
        <>
          <div className="data-table--scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Area</th>
                  <th className="num">{sortBtn("need_score", "Need score")}</th>
                  <th className="num">{sortBtn("petition_count", "Petitions")}</th>
                  <th className="num">{sortBtn("silent_score", "Silent score")}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((v) => (
                  <tr key={v.area_id}>
                    <td>{v.place_name}</td>
                    <td className="num">{v.need_score.toFixed(1)}</td>
                    <td className="num">{v.petition_count}</td>
                    <td className="num">{v.silent_score.toFixed(1)}</td>
                    <td>
                      {v.flagged ? (
                        <span className="chip chip--critical">Flagged</span>
                      ) : (
                        <span className="chip chip--muted">Watch</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageCount={pageCount}
            from={from}
            to={to}
            total={total}
            onPageChange={setPage}
            noun="areas"
          />
        </>
      )}
    </Page>
  );
}
