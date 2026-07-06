import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StateBlock from "../components/StateBlock";
import { formatInr } from "../format";
import {
  getActions,
  advanceAction,
  removeAction,
  onActionsChanged,
  actionCounts,
  STATUS_LABEL,
  STATUS_ORDER,
} from "../lib/actions";
import type { MpAction, ActionStatus } from "../types";

/** Accent per follow-up status — slate → amber → green as the loop closes. */
const STATUS_COLOR: Record<ActionStatus, string> = {
  sent: "hsl(215 16% 47%)",
  acknowledged: "hsl(38 80% 45%)",
  resolved: "hsl(var(--success))",
};

/** Filter tabs: "all" plus each concrete status. */
type Filter = "all" | ActionStatus;
const FILTERS: Filter[] = ["all", "sent", "acknowledged", "resolved"];
const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  sent: STATUS_LABEL.sent,
  acknowledged: STATUS_LABEL.acknowledged,
  resolved: STATUS_LABEL.resolved,
};

/** Tolerant "en-IN" datetime — guards invalid dates by returning the raw string. */
function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function Tracker() {
  const [actions, setActions] = useState<MpAction[]>(() => getActions());
  const [filter, setFilter] = useState<Filter>("all");

  // Re-read the localStorage-backed log whenever it changes (add/advance/remove).
  useEffect(() => {
    const refresh = () => setActions(getActions());
    return onActionsChanged(refresh);
  }, []);

  const counts = actionCounts();

  const visible = useMemo(
    () => (filter === "all" ? actions : actions.filter((a) => a.status === filter)),
    [actions, filter],
  );

  const isEmpty = actions.length === 0;

  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>
        Every letter sent and work funded — follow it through to Resolved.
      </p>

      <div style={{ marginBottom: 16 }}>
        <span
          className="chip chip--muted"
          style={{ fontWeight: 600, whiteSpace: "nowrap" }}
        >
          Sent {counts.sent} · Acknowledged {counts.acknowledged} · Resolved{" "}
          {counts.resolved}
        </span>
      </div>

      {isEmpty ? (
        <>
          <StateBlock
            variant="empty"
            title="Nothing to track yet"
            detail="Go to Act — send a department letter (Track A) or fund a work (Track B). Each one appears here so you can follow it to Resolved."
          />
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link className="btn btn--primary" to="/act">
              Go to Act
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* Status filter tabs */}
          <div className="toolbar" role="tablist" aria-label="Filter by status">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FILTERS.map((f) => {
                const active = filter === f;
                const n =
                  f === "all" ? counts.total : counts[f];
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? "btn btn--sm btn--primary" : "btn btn--sm"}
                    onClick={() => setFilter(f)}
                  >
                    {FILTER_LABEL[f]} · {n}
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <StateBlock
              variant="empty"
              title="Nothing in this stage"
              detail={`No actions are currently marked “${FILTER_LABEL[filter]}”.`}
            />
          ) : (
            <ul
              className="feed"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {visible.map((a) => (
                <ActionCard key={a.id} action={a} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** One tracked action: kind chip + title, meta sub-line, stepper, and controls. */
function ActionCard({ action }: { action: MpAction }) {
  const isLetter = action.kind === "letter";
  const currentIndex = STATUS_ORDER.indexOf(action.status);
  const nextStatus =
    currentIndex < STATUS_ORDER.length - 1
      ? STATUS_ORDER[currentIndex + 1]
      : null;

  // Muted sub-line pieces, joined with " · ".
  const metaParts: string[] = [];
  const where = isLetter ? action.department : action.place;
  if (where) metaParts.push(where);
  if (action.scheme) metaParts.push(action.scheme);
  if (action.rupees != null) metaParts.push(formatInr(action.rupees));
  if (action.beneficiaries != null)
    metaParts.push(`${action.beneficiaries.toLocaleString("en-IN")} residents`);
  metaParts.push(`Updated ${fmtDate(action.updated_at)}`);

  return (
    <li
      className="feed-item"
      style={{
        borderLeft: `3px solid ${STATUS_COLOR[action.status]}`,
      }}
    >
      <div className="feed-item__top" style={{ marginBottom: 4 }}>
        <span className={isLetter ? "chip chip--track-A" : "chip chip--track-B"}>
          {isLetter ? "Letter" : "MPLADS work"}
        </span>
        <strong style={{ color: "hsl(var(--foreground))", fontSize: 15 }}>
          {action.title}
        </strong>
      </div>

      <p
        className="muted"
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          color: "hsl(var(--muted-foreground))",
        }}
      >
        {metaParts.join(" · ")}
      </p>

      <Stepper currentIndex={currentIndex} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
        }}
      >
        {nextStatus && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => advanceAction(action.id)}
          >
            Advance to {STATUS_LABEL[nextStatus]}
          </button>
        )}
        <button
          type="button"
          className="btn btn--sm"
          style={{ color: "hsl(var(--muted-foreground))" }}
          onClick={() => removeAction(action.id)}
          aria-label={`Remove ${action.title} from the tracker`}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

/** Horizontal Sent → Acknowledged → Resolved stepper. */
function Stepper({ currentIndex }: { currentIndex: number }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      aria-label={`Status: ${STATUS_LABEL[STATUS_ORDER[currentIndex]]}`}
    >
      {STATUS_ORDER.map((status, i) => {
        const reached = i <= currentIndex;
        const color = STATUS_COLOR[status];
        return (
          <div
            key={status}
            style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                flexShrink: 0,
                background: reached ? color : "hsl(var(--card))",
                border: `2px solid ${reached ? color : "hsl(var(--border))"}`,
              }}
            />
            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                fontWeight: reached ? 600 : 500,
                color: reached ? color : "hsl(var(--muted-foreground))",
                whiteSpace: "nowrap",
              }}
            >
              {STATUS_LABEL[status]}
            </span>
            {i < STATUS_ORDER.length - 1 && (
              <span
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 12,
                  margin: "0 6px",
                  background:
                    i < currentIndex ? color : "hsl(var(--border))",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
