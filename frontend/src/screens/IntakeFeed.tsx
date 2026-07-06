import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, MapPin, Radio, Languages, Tag, Clock, Hash, AlertTriangle } from "lucide-react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import Pagination, { usePagination } from "../components/Pagination";
import ProvenanceChip from "../components/Provenance";
import ScanPetition from "./ScanPetition";
import { api } from "../api";
import { useFetch } from "../useFetch";
import type { DemandRow } from "../types";

const PAGE_SIZE = 15;

/** /demands rows may carry live-submission provenance from demand_records. */
type FeedRow = DemandRow & {
  source_outlet?: string | null;
};

/** "Live" = a genuine citizen submission (Telegram / Scan / web intake), NOT a
 * news-sourced synthetic row (which carries is_real for provenance only). */
function isLive(d: FeedRow): boolean {
  return d.live === true || d.channel === "telegram" || d.channel === "paper";
}

/** Tolerant date formatter — handles ISO and "YYYY-MM-DD HH:MM:SS+00" shapes. */
function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// ── Urgency triage — surface critical/high complaints first ──────────────────
const URGENCY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function urgencyRank(u: string | null | undefined): number {
  return URGENCY_RANK[(u || "").toLowerCase()] ?? 4;
}

const URGENCY_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  critical: { bg: "hsl(0 84% 96%)", fg: "hsl(0 72% 45%)", border: "hsl(0 84% 88%)" },
  high: { bg: "hsl(28 96% 95%)", fg: "hsl(24 80% 42%)", border: "hsl(28 90% 85%)" },
  medium: { bg: "hsl(45 96% 95%)", fg: "hsl(38 75% 38%)", border: "hsl(45 88% 85%)" },
  low: { bg: "hsl(var(--secondary))", fg: "hsl(var(--muted-foreground))", border: "hsl(var(--border))" },
};

function UrgencyPill({ u }: { u: string | null | undefined }) {
  const key = (u || "").toLowerCase();
  const meta = URGENCY_STYLE[key];
  if (!meta) return null;
  return (
    <span
      className="chip"
      style={{ background: meta.bg, color: meta.fg, borderColor: meta.border, fontWeight: 700 }}
    >
      {key === "critical" ? "⚠ " : ""}
      {key}
    </span>
  );
}

export default function IntakeFeed() {
  const state = useFetch(() => api.demands(300));
  const [tab, setTab] = useState<"complaints" | "scan">("complaints");
  const [query, setQuery] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selected, setSelected] = useState<FeedRow | null>(null);

  const rows: FeedRow[] = state.status === "ready" ? (state.data as FeedRow[]) : [];

  const urgentCount = useMemo(
    () => rows.filter((d) => urgencyRank(d.urgency) <= 1).length,
    [rows],
  );

  // Filter by place/category/channel text, optionally urgent-only, urgent-first.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((d) =>
        [d.place_name, d.true_category, d.channel, d.language, d.raw_text]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }
    if (urgentOnly) out = out.filter((d) => urgencyRank(d.urgency) <= 1);
    // LIVE citizen submissions pin to the very top (the MP just received them),
    // then urgent-first (critical/high), then original recency order — stable.
    return [...out]
      .map((d, i) => ({ d, i }))
      .sort(
        (a, b) =>
          (isLive(b.d) ? 1 : 0) - (isLive(a.d) ? 1 : 0) ||
          urgencyRank(a.d.urgency) - urgencyRank(b.d.urgency) ||
          a.i - b.i,
      )
      .map((x) => x.d);
  }, [rows, query, urgentOnly]);

  const { page, pageCount, pageItems, total, from, to, setPage } =
    usePagination(filtered, PAGE_SIZE);

  return (
    <Page
      title="Intake"
      subtitle="Where staff triage incoming demands as they are structured and geo-resolved. Click any complaint to see the full record."
      actions={
        <div className="flex items-center gap-2">
          <ProvenanceChip kind="synthetic" />
          <span className="badge badge--live">Live</span>
        </div>
      }
    >
      <div className="tabs" role="tablist" aria-label="Intake mode" style={{ marginBottom: 16 }}>
        <button
          role="tab"
          aria-selected={tab === "complaints"}
          className={tab === "complaints" ? "tab tab--active" : "tab"}
          onClick={() => setTab("complaints")}
        >
          Complaints
        </button>
        <button
          role="tab"
          aria-selected={tab === "scan"}
          className={tab === "scan" ? "tab tab--active" : "tab"}
          onClick={() => setTab("scan")}
        >
          Scan a petition
        </button>
      </div>

      {tab === "scan" && <ScanPetition />}

      {tab === "complaints" && (
        <>
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
            <button
              type="button"
              onClick={() => setUrgentOnly((v) => !v)}
              aria-pressed={urgentOnly}
              className="chip"
              style={{
                cursor: "pointer",
                fontWeight: 700,
                background: urgentOnly ? "hsl(0 84% 96%)" : "hsl(var(--secondary))",
                color: urgentOnly ? "hsl(0 72% 45%)" : "hsl(var(--muted-foreground))",
                borderColor: urgentOnly ? "hsl(0 84% 88%)" : "hsl(var(--border))",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
              title="Show only critical + high urgency complaints"
            >
              <AlertTriangle size={13} /> Urgent {urgentCount > 0 ? `(${urgentCount})` : ""}
            </button>
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
                {pageItems.map((d) => {
                  const live = isLive(d);
                  return (
                    <li
                      key={d.id}
                      className="feed-item"
                      role="button"
                      tabIndex={0}
                      aria-label={`View full complaint from ${d.place_name ?? "unknown area"}`}
                      onClick={() => setSelected(d)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(d);
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        borderLeft: live
                          ? "3px solid hsl(var(--success))"
                          : "3px solid transparent",
                      }}
                    >
                      <div className="feed-item__top">
                        <UrgencyPill u={d.urgency} />
                        {live && (
                          <span
                            className="chip"
                            style={{
                              background: "hsl(152 55% 95%)",
                              color: "hsl(152 60% 30%)",
                              borderColor: "hsl(152 45% 82%)",
                              fontWeight: 700,
                            }}
                          >
                            ● Live
                          </span>
                        )}
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
                      <p
                        className="feed-item__text"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {d.raw_text || "(no text)"}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 8,
                          fontSize: 12,
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        <span>{fmtDate(d.created_at)}</span>
                        <span style={{ fontWeight: 600, color: "hsl(var(--primary, var(--foreground)))" }}>
                          View details →
                        </span>
                      </div>
                    </li>
                  );
                })}
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

        </>
      )}

      {selected && <DetailModal d={selected} onClose={() => setSelected(null)} />}
    </Page>
  );
}

/** Full single-complaint record — the "detailed view" for an intake row. */
function DetailModal({ d, onClose }: { d: FeedRow; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const live = isLive(d);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Complaint detail"
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
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "0.9rem",
          boxShadow: "0 24px 60px hsl(213 43% 16% / 0.35)",
          width: "min(620px, 100%)",
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {live && (
                <span
                  className="chip"
                  style={{
                    background: "hsl(152 55% 95%)",
                    color: "hsl(152 60% 30%)",
                    borderColor: "hsl(152 45% 82%)",
                    fontWeight: 700,
                  }}
                >
                  ● Live submission
                </span>
              )}
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 19,
                  color: "hsl(var(--foreground))",
                }}
              >
                {d.place_name || "Unknown area"}
                {d.urban != null ? (d.urban ? " · urban" : " · rural") : ""}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
              {d.true_category ? `${d.true_category} complaint` : "Complaint"} · {fmtDate(d.created_at)}
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
          {/* Structured fields */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <Meta icon={<Tag size={13} />} label="Category" value={d.true_category || "—"} />
            <Meta icon={<AlertTriangle size={13} />} label="Urgency" value={(d.urgency || "—").toString()} />
            <Meta icon={<Radio size={13} />} label="Channel" value={d.channel || "—"} />
            <Meta icon={<Languages size={13} />} label="Language" value={(d.language || "—").toUpperCase()} />
            <Meta icon={<MapPin size={13} />} label="Place" value={d.place_name || "—"} />
            <Meta icon={<Clock size={13} />} label="Received" value={fmtDate(d.created_at) || "—"} />
            <Meta icon={<Hash size={13} />} label="Reference" value={d.id} />
          </div>

          {/* Full complaint text — what the citizen actually said / the AI read. */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "0.6rem",
              border: "1px solid hsl(var(--border))",
              background: "hsl(40 33% 98%)",
            }}
          >
            <div
              className="muted"
              style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}
            >
              Full complaint {live ? "· as read by the AI" : "text"}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: "hsl(var(--foreground))",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {d.raw_text || "(no text)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 12px",
        borderRadius: "0.5rem",
        background: "hsl(var(--secondary))",
        minWidth: 120,
      }}
    >
      <span
        className="muted"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        {icon} {label}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "hsl(var(--foreground))" }}>{value}</span>
    </div>
  );
}
