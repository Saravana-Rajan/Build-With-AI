/**
 * MP action log — the close-the-loop tracker's data layer.
 *
 * When the MP sends a department letter (Track A) or funds an MPLADS work
 * (Track B), we record it here so the Tracker screen can show the follow-up
 * status: Sent → Acknowledged → Resolved. Persisted in localStorage for the
 * demo (no backend write on the hot path, no BigQuery streaming-buffer edits).
 *
 * A tiny event system lets any screen re-render when the log changes.
 */
import type { MpAction, ActionKind, ActionStatus } from "../types";

const KEY = "sarvik-mp-actions";
const EVENT = "sarvik-actions-changed";

export const STATUS_ORDER: ActionStatus[] = ["sent", "acknowledged", "resolved"];

export const STATUS_LABEL: Record<ActionStatus, string> = {
  sent: "Sent",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

function read(): MpAction[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MpAction[]) : [];
  } catch {
    return [];
  }
}

function write(list: MpAction[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** All logged actions, newest first. */
export function getActions(): MpAction[] {
  return read().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/**
 * Record (or no-op if already logged) an MP action. `id` is a stable key so
 * sending the same department letter twice doesn't create duplicates.
 */
export function logAction(input: {
  id: string;
  kind: ActionKind;
  title: string;
  department?: string | null;
  place?: string | null;
  scheme?: string | null;
  rupees?: number | null;
  beneficiaries?: number | null;
}): void {
  const list = read();
  if (list.some((a) => a.id === input.id)) return; // already logged
  const now = new Date().toISOString();
  list.push({
    ...input,
    status: "sent",
    created_at: now,
    updated_at: now,
  });
  write(list);
}

/** Advance an action one step along Sent → Acknowledged → Resolved. */
export function advanceAction(id: string): void {
  const list = read();
  const a = list.find((x) => x.id === id);
  if (!a) return;
  const i = STATUS_ORDER.indexOf(a.status);
  if (i < STATUS_ORDER.length - 1) {
    a.status = STATUS_ORDER[i + 1];
    a.updated_at = new Date().toISOString();
    write(list);
  }
}

/** Remove one action from the log. */
export function removeAction(id: string): void {
  write(read().filter((a) => a.id !== id));
}

/** Subscribe to log changes (fires on any add/advance/remove). Returns unsubscribe. */
export function onActionsChanged(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn); // cross-tab
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** Rollup counts by status, for badges / the Impact scorecard. */
export function actionCounts(): Record<ActionStatus, number> & { total: number } {
  const list = read();
  return {
    sent: list.filter((a) => a.status === "sent").length,
    acknowledged: list.filter((a) => a.status === "acknowledged").length,
    resolved: list.filter((a) => a.status === "resolved").length,
    total: list.length,
  };
}
