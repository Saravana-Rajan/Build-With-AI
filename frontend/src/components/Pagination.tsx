import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Client-side pagination helper. Given the full list and a page size it slices
 * the current page and hands back everything <Pagination /> needs. The current
 * page auto-resets to 1 whenever the total number of items changes (e.g. a new
 * search filter narrows the list).
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(1);

  // Reset to first page when the underlying data set changes (filter/sort/fetch).
  useEffect(() => {
    setPage(1);
  }, [total]);

  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageItems = items.slice(start, end);

  return {
    page: safePage,
    pageCount,
    pageItems,
    total,
    // 1-based inclusive range for the "Showing X–Y of Z" label (0 when empty).
    from: total === 0 ? 0 : start + 1,
    to: end,
    setPage,
  };
}

interface PaginationProps {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Unit label for the count, e.g. "demands" → "Showing 1–15 of 300 demands". */
  noun?: string;
}

/** shadcn-styled pager: result count on the left, Prev / page / Next on the right. */
export default function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPageChange,
  noun,
}: PaginationProps) {
  if (total === 0) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__count">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of{" "}
        <strong>{total.toLocaleString("en-IN")}</strong>
        {noun ? ` ${noun}` : ""}
      </span>

      <div className="pagination__controls">
        <button
          type="button"
          className="btn btn--sm pagination__btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
          Prev
        </button>

        <span className="pagination__status">
          Page <strong>{page}</strong> of <strong>{pageCount}</strong>
        </span>

        <button
          type="button"
          className="btn btn--sm pagination__btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
