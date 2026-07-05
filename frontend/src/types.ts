/**
 * TypeScript mirror of backend/app/schema.py — the canonical data contract.
 * Keep these shapes in sync with the Pydantic models. Do not diverge.
 */

// ── Controlled vocabularies ──────────────────────────────────────────────────
export type Category =
  | "water"
  | "road"
  | "housing"
  | "education"
  | "health"
  | "jobs"
  | "pension"
  | "sanitation"
  | "other";

export type Urgency = "critical" | "high" | "medium" | "low";

// Track A = unlock an existing entitlement (₹0 of MPLADS); Track B = spend MPLADS.
export type Track = "A" | "B";

export type MatchType = "delivery_failure" | "coverage_gap" | "mplads_candidate";

export type Source = "web" | "telegram" | "phone" | "meeting" | "import";

// ── Step 0: raw intake ───────────────────────────────────────────────────────
export interface Submission {
  id: string;
  source: Source;
  language_hint: string | null; // "ta" | "en" | "hi"
  raw_text: string | null; // text, or STT output
  voice_path: string | null;
  photo_path: string | null;
  created_at: string; // ISO datetime
  synthetic: boolean;
}

// ── Steps 1–3: structured, geo-resolved, scheme-matched ──────────────────────
export interface DemandRecord {
  id: string;
  source: Source;
  language: string;
  raw_text: string;
  translated_text: string | null; // English, for the pipeline

  // Step 1 — extraction
  category: Category;
  need_detail: string;
  urgency: Urgency;
  urgency_reason: string | null;
  beneficiary_estimate: number | null;

  // Step 2 — geo resolution (mixed key: ward for urban, village for rural)
  place_name: string | null;
  area_id: string | null; // "W-12" (urban) | "V-3" (rural)
  urban: boolean;
  lgd_or_ward_code: string | null;
  location_confidence: number;

  // Step 3 — scheme matching
  matched_scheme: string | null; // e.g. "JJM", "PMAY-U", None→MPLADS
  match_type: MatchType | null;
  track: Track | null;

  created_at: string; // ISO datetime
  synthetic: boolean;
}

// ── Steps 5–8: analytics outputs ─────────────────────────────────────────────
export interface SchemeGap {
  area_id: string;
  place_name: string;
  urban: boolean;
  scheme: string;
  eligible: number;
  covered: number;
  gap: number; // eligible - covered
  per_unit_value: number;
  gap_value: number; // gap * per_unit_value (₹)
  data_source: "real" | "modelled";
}

export interface RankedProject {
  rank: number;
  area_id: string;
  place_name: string;
  title: string;
  category: Category;
  track: Track;
  priority_score: number;
  why: Record<string, number>; // factor -> contribution, for the UI
  estimated_cost: number | null; // ₹, Track B only
  beneficiaries: number | null;
  matched_scheme: string | null;
}

export interface SilentVillage {
  area_id: string;
  place_name: string;
  need_score: number;
  petition_count: number;
  silent_score: number;
  flagged: boolean;
}
