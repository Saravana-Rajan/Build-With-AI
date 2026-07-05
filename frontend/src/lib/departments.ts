/**
 * Department helpers — the "whose job is it" layer.
 *
 * The backend exposes GET /api/departments, but it may 404 until that endpoint
 * ships. When it does, and whenever a scheme_gap / ranked_project is missing its
 * `department` field, we derive the owning line department from the scheme code
 * so the UI degrades gracefully instead of going blank.
 */
import { api } from "../api";
import type { Department, RankedProject, SchemeGap } from "../types";

/** Scheme code → owning line department. Substring match, case-insensitive. */
const SCHEME_TO_DEPT: Array<[RegExp, string]> = [
  [/jjm|jal\s*jeevan|water/i, "Jal Shakti · Water Supply"],
  [/pmay|housing|awas/i, "Housing & Urban Affairs"],
  [/nhm|health|ayushman|abhim/i, "Health & Family Welfare"],
  [/pmgsy|road|pwd/i, "Rural Development · Roads"],
  [/sbm|swachh|sanitation|toilet/i, "Drinking Water & Sanitation"],
  [/pension|nsap|social|welfare/i, "Social Welfare"],
  [/pmegp|mgnrega|nrega|job|employ|skill/i, "Rural Development · Livelihoods"],
  [/education|school|samagra|midday|scholar/i, "School Education"],
];

const FALLBACK_DEPT = "General Administration";

/** Best-effort department label for a scheme (or explicit department field). */
export function departmentFor(
  scheme: string | null | undefined,
  explicit?: string | null,
): string {
  if (explicit && explicit.trim()) return explicit.trim();
  if (!scheme) return FALLBACK_DEPT;
  for (const [re, dept] of SCHEME_TO_DEPT) {
    if (re.test(scheme)) return dept;
  }
  return FALLBACK_DEPT;
}

/** Department of a ranked project (explicit field first, else derived). */
export function projectDepartment(p: RankedProject): string {
  return departmentFor(p.matched_scheme, p.department);
}

/** Roll scheme gaps up into Department records (used as the 404 fallback). */
export function deriveDepartments(gaps: SchemeGap[]): Department[] {
  const byDept = new Map<
    string,
    { gap: number; count: number; areas: Map<string, number>; schemes: Set<string> }
  >();

  for (const g of gaps) {
    const dept = departmentFor(g.scheme, g.department);
    const bucket =
      byDept.get(dept) ??
      { gap: 0, count: 0, areas: new Map<string, number>(), schemes: new Set<string>() };
    bucket.gap += g.gap_value || 0;
    bucket.count += 1;
    bucket.schemes.add(g.scheme);
    bucket.areas.set(g.place_name, (bucket.areas.get(g.place_name) ?? 0) + (g.gap_value || 0));
    byDept.set(dept, bucket);
  }

  return Array.from(byDept.entries())
    .map(([department, b]) => ({
      department,
      total_gap_value: b.gap,
      issue_count: b.count,
      top_areas: Array.from(b.areas.entries())
        .sort((a, c) => c[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name),
      schemes: Array.from(b.schemes).sort(),
    }))
    .sort((a, b) => b.total_gap_value - a.total_gap_value);
}

export interface DepartmentsResult {
  data: Department[];
  /** true when derived client-side from scheme gaps (endpoint not live yet). */
  derived: boolean;
}

/**
 * Load departments from the live endpoint; if it 404s / errors, derive them
 * from scheme gaps so the "whose job is it" views stay populated.
 */
export async function loadDepartments(): Promise<DepartmentsResult> {
  try {
    const data = await api.departments();
    if (Array.isArray(data) && data.length > 0) {
      return {
        data: [...data].sort((a, b) => b.total_gap_value - a.total_gap_value),
        derived: false,
      };
    }
    // Empty (but reachable) → fall through to derivation.
  } catch {
    /* endpoint not live yet — derive below */
  }
  const gaps = await api.schemeGaps(300);
  return { data: deriveDepartments(gaps), derived: true };
}

/** Stable-ish accent color per department for charts + chips. */
const DEPT_PALETTE = [
  "#7c5cfa",
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#6366f1",
];

export function departmentColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DEPT_PALETTE[h % DEPT_PALETTE.length];
}

/** Short slug for anchors / filter values. */
export function departmentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
