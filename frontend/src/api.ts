/**
 * Minimal fetch client for the FastAPI dashboard read-API.
 * Base URL comes from VITE_API_URL (defaults to http://localhost:8000).
 *
 * Paths below match backend/app/api.py exactly (all mounted under /api).
 * Every call is typed against src/types.ts.
 */
import type {
  DemandRow,
  RankedProject,
  SchemeGap,
  SilentVillage,
  StatsResponse,
  UnifiedIssue,
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
  /** Headline numbers for the dashboard hero. */
  stats: () => get<StatsResponse>("/api/stats"),

  /** Live intake feed — most recent raw demands. */
  demands: (limit = 50) => get<DemandRow[]>(`/api/demands?limit=${limit}`),

  /** Per-area scheme coverage gaps (Constituency X-Ray). */
  schemeGaps: (limit = 100) => get<SchemeGap[]>(`/api/scheme-gaps?limit=${limit}`),

  /** Ranked project list (Priorities + Act). */
  rankedProjects: (limit = 50) =>
    get<RankedProject[]>(`/api/ranked-projects?limit=${limit}`),

  /** Silent / under-petitioning areas (Forgotten Villages). */
  silentVillages: (limit = 50) =>
    get<SilentVillage[]>(`/api/silent-villages?limit=${limit}`),

  /** Deduplicated issue clusters (Priorities headline). */
  unifiedIssues: (limit = 100) =>
    get<UnifiedIssue[]>(`/api/unified-issues?limit=${limit}`),
};

export default api;
