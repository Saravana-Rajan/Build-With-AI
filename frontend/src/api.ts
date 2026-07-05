/**
 * Minimal fetch client for the FastAPI backend.
 * Base URL comes from VITE_API_URL (defaults to http://localhost:8000).
 *
 * Endpoint paths below are best-guess placeholders — adjust to match the
 * backend routes when wiring is done. Every call is typed against src/types.ts.
 */
import type {
  DemandRecord,
  RankedProject,
  SchemeGap,
  SilentVillage,
} from "./types";

export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  /** Live intake feed — most recent structured demands. */
  demands: () => get<DemandRecord[]>("/demands"),

  /** Ranked project list (Priorities screen). */
  rankedProjects: () => get<RankedProject[]>("/priorities"),

  /** Per-area scheme coverage gaps (Constituency X-Ray). */
  schemeGaps: () => get<SchemeGap[]>("/scheme-gaps"),

  /** Silent / under-petitioning areas (Forgotten Villages). */
  silentVillages: () => get<SilentVillage[]>("/silent-villages"),
};

export default api;
