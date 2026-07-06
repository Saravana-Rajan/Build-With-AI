import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { X, MapPin, Radio, Newspaper } from "lucide-react";
import StateBlock from "./StateBlock";
import { api } from "../api";
import { useFetch } from "../useFetch";
import type { DemandRow } from "../types";

/**
 * The /api/demands rows are `SELECT *` from complaints_synthetic, so real-news
 * seeded rows also carry these provenance columns. They are optional because
 * purely-synthetic rows omit them.
 */
type ComplaintRow = DemandRow & {
  source_outlet?: string | null;
  source_note?: string | null;
  is_real?: boolean | null;
};

export interface ComplaintsModalProps {
  open: boolean;
  onClose: () => void;
  /** Area to filter complaints to (exact place_name match). */
  placeName: string | null | undefined;
  /** Optional true_category filter (e.g. "water"). */
  category?: string | null;
  /** Modal heading. */
  title: string;
  /** Optional rich subtitle — "why this matters", factor chips, etc. */
  subtitle?: ReactNode;
}

/** Language code -> short display chip (EN / TA / HI). */
function langChip(language: string | null | undefined) {
  const code = (language || "").toLowerCase();
  const label =
    code === "ta" ? "TA" : code === "hi" ? "HI" : code === "en" ? "EN" : (code || "—").toUpperCase();
  return (
    <span
      className="chip chip--muted"
      style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}
    >
      {label}
    </span>
  );
}

/** One citizen complaint card: raw text + language / channel / place / source. */
function ComplaintCard({ c }: { c: ComplaintRow }) {
  const outlet = c.source_outlet?.trim();
  return (
    <li
      style={{
        listStyle: "none",
        padding: "12px 14px",
        borderRadius: "0.6rem",
        border: "1px solid hsl(var(--border))",
        background: "hsl(40 33% 98%)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "hsl(var(--foreground))",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {c.raw_text || <span className="muted">(no text)</span>}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginTop: 10,
        }}
      >
        {langChip(c.language)}
        {c.channel && (
          <span
            className="chip chip--muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Radio size={11} /> {c.channel}
          </span>
        )}
        {c.place_name && (
          <span
            className="muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            <MapPin size={12} /> {c.place_name}
          </span>
        )}
        {outlet && (
          <span
            title={c.source_note || outlet}
            className="chip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "hsl(152 55% 96%)",
              color: "hsl(152 60% 30%)",
              borderColor: "hsl(152 45% 85%)",
              fontWeight: 600,
            }}
          >
            <Newspaper size={11} /> Real news · {outlet}
          </span>
        )}
      </div>
    </li>
  );
}

/** Inner body — only mounted while open, so the fetch runs once per open. */
function ComplaintsModalBody({
  onClose,
  placeName,
  category,
  title,
  subtitle,
}: Omit<ComplaintsModalProps, "open">) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const feed = useFetch<ComplaintRow[]>(() => api.demands(500) as Promise<ComplaintRow[]>);

  const complaints = useMemo(() => {
    if (feed.status !== "ready") return [];
    const place = (placeName || "").trim().toLowerCase();
    const cat = category ? category.trim().toLowerCase() : null;
    return feed.data.filter((c) => {
      if (place && (c.place_name || "").trim().toLowerCase() !== place) return false;
      if (cat && (c.true_category || "").trim().toLowerCase() !== cat) return false;
      return true;
    });
  }, [feed, placeName, category]);

  // Esc to close + basic focus trap; focus the close button on open.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = complaints.length;
  const countLabel =
    feed.status === "ready"
      ? `${count.toLocaleString("en-IN")} citizen ${count === 1 ? "complaint" : "complaints"} behind this`
      : feed.status === "loading"
        ? "Loading citizen complaints…"
        : feed.status === "empty"
          ? "No complaints on file"
          : "Complaints unavailable";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "hsl(213 43% 16% / 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "0.9rem",
          boxShadow: "0 24px 60px hsl(213 43% 16% / 0.35)",
          width: "min(680px, 100%)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 19,
                color: "hsl(var(--foreground))",
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <div
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {subtitle}
              </div>
            )}
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12.5,
                fontWeight: 600,
                color: "hsl(var(--primary, var(--foreground)))",
              }}
            >
              {countLabel}
            </p>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="btn btn--sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 20, overflow: "auto" }}>
          {feed.status === "loading" && (
            <StateBlock variant="loading" title="Loading citizen complaints…" />
          )}
          {feed.status === "error" && (
            <StateBlock variant="error" title="Could not load complaints" detail={feed.error} />
          )}
          {(feed.status === "ready" || feed.status === "empty") && count === 0 && (
            <StateBlock
              variant="empty"
              title="No complaints match this area"
              detail={
                category
                  ? `No ${category} complaints on file for ${placeName ?? "this area"} yet.`
                  : `No complaints on file for ${placeName ?? "this area"} yet.`
              }
            />
          )}
          {feed.status === "ready" && count > 0 && (
            <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {complaints.map((c) => (
                <ComplaintCard key={c.id} c={c} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable drill-down modal that previews the raw citizen complaints behind an
 * area / priority / department. Fetches the live intake feed once and
 * client-filters by place (+ optional category). Sabha-themed, self-contained.
 */
export default function ComplaintsModal({ open, ...rest }: ComplaintsModalProps) {
  if (!open) return null;
  return <ComplaintsModalBody {...rest} />;
}
