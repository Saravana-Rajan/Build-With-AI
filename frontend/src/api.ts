/**
 * Minimal fetch client for the FastAPI dashboard read-API.
 * Base URL comes from VITE_API_URL (defaults to http://localhost:8000).
 *
 * Paths below match backend/app/api.py exactly (all mounted under /api).
 * Every call is typed against src/types.ts.
 */
import type {
  DemandRecord,
  DemandRow,
  Department,
  RankedProject,
  SchemeGap,
  SilentVillage,
  StatsResponse,
  UnifiedIssue,
} from "./types";

/** POST /api/intake response — a citizen ack + the structured record. */
export interface IntakeResponse {
  reference: string;
  ack: string;
  record: DemandRecord;
}

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

  /**
   * Per-department rollup — ₹ owed, issue count, top areas + schemes.
   * "Whose job is it" view. May 404 until the backend endpoint ships;
   * callers fall back to deriving departments from scheme gaps.
   */
  departments: () => get<Department[]>("/api/departments"),
};

/**
 * Submit a scanned/photographed petition (image/PDF/audio) for multimodal
 * extraction. Sends multipart/form-data to POST /api/intake and returns the
 * citizen ack plus the structured DemandRecord.
 */
export async function submitIntake(
  file: File,
  language: string,
  source: string,
): Promise<IntakeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  form.append("source", source);

  const res = await fetch(`${API_URL}/api/intake`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
  });
  if (!res.ok) {
    let detail = `Intake failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as IntakeResponse;
}

export default api;
