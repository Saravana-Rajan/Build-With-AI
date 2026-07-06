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

// In-memory response cache — stable analytics endpoints are cached so moving
// between pages doesn't refetch (and re-pay BigQuery latency). Live endpoints
// (demands) pass cache:false so new submissions always show.
const _cache = new Map<string, { t: number; data: unknown }>();
const CACHE_TTL = 90_000; // ms

async function get<T>(path: string, init?: RequestInit, cache = true): Promise<T> {
  if (cache && !init) {
    const hit = _cache.get(path);
    if (hit && Date.now() - hit.t < CACHE_TTL) return hit.data as T;
  }
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} failed (${res.status})`);
  }
  const data = (await res.json()) as T;
  if (cache && !init) _cache.set(path, { t: Date.now(), data });
  return data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/** POST /api/letter/department — one consolidated official letter to a dept. */
export interface DepartmentLetterResponse {
  letter_text: string;
  department: string;
  areas_count: number;
  rupees: number;
}

/** POST /api/letter/item — single-beneficiary letter + eligibility rationale. */
export interface ItemLetterResponse {
  letter_text: string;
  eligibility: string;
}

export const api = {
  /** Headline numbers for the dashboard hero. */
  stats: () => get<StatsResponse>("/api/stats"),

  /** Live intake feed — most recent raw demands (never cached: must stay live). */
  demands: (limit = 50) =>
    get<DemandRow[]>(`/api/demands?limit=${limit}`, undefined, false),

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

  /** Generate ONE consolidated official letter to a department (Track A). */
  letterDepartment: (body: {
    department: string;
    scheme?: string | null;
    schemes?: string[];
    areas?: string[];
    rupees?: number | null;
    areas_count?: number | null;
  }) => post<DepartmentLetterResponse>("/api/letter/department", body),

  /** Generate a single-beneficiary letter + eligibility rationale. */
  letterItem: (body: {
    place_name: string;
    scheme?: string | null;
    category?: string | null;
    title?: string | null;
    area_id?: string | null;
    beneficiaries?: number | null;
    urban?: boolean;
  }) => post<ItemLetterResponse>("/api/letter/item", body),
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
