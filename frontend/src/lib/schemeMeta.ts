/**
 * Central-scheme metadata — the "which scheme to push" layer.
 *
 * Each line department is a central-government portfolio. When the MP looks at a
 * department, the single most useful thing is: *which central scheme* funds this
 * gap, so they know exactly what to invoke in a letter. This map turns raw scheme
 * codes (e.g. "PMAY-G") into a prominent, colored, human-readable label plus the
 * accountable central ministry — and a few well-known sibling schemes for context.
 *
 * `color` is an explicit hex so the badges stay vivid and distinct on the light
 * "Sabha" ivory theme regardless of the department's hashed accent.
 */

export interface SchemeInfo {
  /** Canonical short code shown on the badge (e.g. "PMAY-G"). */
  code: string;
  /** Full scheme name, for the badge subtitle. */
  name: string;
  /** Accountable central ministry / office to push. */
  ministry: string;
  /** Vivid accent hex used for the highlighted badge. */
  color: string;
}

/** Keyed by UPPERCASED scheme code. Includes context-only sibling schemes. */
const META: Record<string, SchemeInfo> = {
  "PMAY-G": {
    code: "PMAY-G",
    name: "Pradhan Mantri Awas Yojana – Gramin",
    ministry: "Ministry of Rural Development",
    color: "#b45309",
  },
  "PMAY-U": {
    code: "PMAY-U",
    name: "Pradhan Mantri Awas Yojana – Urban",
    ministry: "Ministry of Housing & Urban Affairs",
    color: "#c2410c",
  },
  NHM: {
    code: "NHM",
    name: "National Health Mission",
    ministry: "Ministry of Health & Family Welfare",
    color: "#dc2626",
  },
  JJM: {
    code: "JJM",
    name: "Jal Jeevan Mission",
    ministry: "Ministry of Jal Shakti",
    color: "#0284c7",
  },
  AMRUT: {
    code: "AMRUT",
    name: "Atal Mission for Rejuvenation & Urban Transformation",
    ministry: "Ministry of Housing & Urban Affairs",
    color: "#0891b2",
  },
  MGNREGA: {
    code: "MGNREGA",
    name: "Mahatma Gandhi National Rural Employment Guarantee Act",
    ministry: "Ministry of Rural Development",
    color: "#ca8a04",
  },
  NULM: {
    code: "NULM",
    name: "Deendayal Antyodaya Yojana – National Urban Livelihoods Mission",
    ministry: "Ministry of Housing & Urban Affairs",
    color: "#a16207",
  },
  NSAP: {
    code: "NSAP",
    name: "National Social Assistance Programme",
    ministry: "Ministry of Rural Development",
    color: "#7c3aed",
  },
  "SBM-G": {
    code: "SBM-G",
    name: "Swachh Bharat Mission – Gramin",
    ministry: "Ministry of Jal Shakti",
    color: "#059669",
  },
  "SBM-U": {
    code: "SBM-U",
    name: "Swachh Bharat Mission – Urban",
    ministry: "Ministry of Housing & Urban Affairs",
    color: "#0d9488",
  },
  "SAMAGRA SHIKSHA": {
    code: "Samagra Shiksha",
    name: "Samagra Shiksha Abhiyan",
    ministry: "Ministry of Education",
    color: "#2563eb",
  },

  // ── Context-only sibling schemes (shown as "related", never as primary) ──
  "PM-JAY": {
    code: "Ayushman Bharat (PM-JAY)",
    name: "Pradhan Mantri Jan Arogya Yojana",
    ministry: "Ministry of Health & Family Welfare",
    color: "#e11d48",
  },
  "DAY-NRLM": {
    code: "DAY-NRLM",
    name: "National Rural Livelihoods Mission",
    ministry: "Ministry of Rural Development",
    color: "#9333ea",
  },
  IGNOAPS: {
    code: "IGNOAPS",
    name: "Indira Gandhi National Old Age Pension Scheme",
    ministry: "Ministry of Rural Development",
    color: "#6d28d9",
  },
  "PM-POSHAN": {
    code: "PM POSHAN",
    name: "Pradhan Mantri Poshan Shakti Nirman (Mid-Day Meal)",
    ministry: "Ministry of Education",
    color: "#4f46e5",
  },
  "PM-SHRI": {
    code: "PM SHRI",
    name: "PM Schools for Rising India",
    ministry: "Ministry of Education",
    color: "#1d4ed8",
  },
  PMGSY: {
    code: "PMGSY",
    name: "Pradhan Mantri Gram Sadak Yojana",
    ministry: "Ministry of Rural Development",
    color: "#475569",
  },
};

/**
 * Well-known sibling central schemes per matched scheme, offered as context so
 * the MP sees the fuller toolkit for a department. Values are META keys.
 */
const SIBLINGS: Record<string, string[]> = {
  "PMAY-G": ["PMAY-U"],
  "PMAY-U": ["PMAY-G"],
  NHM: ["PM-JAY"],
  JJM: ["AMRUT"],
  AMRUT: ["JJM"],
  MGNREGA: ["DAY-NRLM"],
  NULM: ["DAY-NRLM"],
  NSAP: ["IGNOAPS"],
  "SBM-G": ["SBM-U"],
  "SBM-U": ["SBM-G"],
  "SAMAGRA SHIKSHA": ["PM-POSHAN", "PM-SHRI"],
};

const FALLBACK_COLOR = "#334155";

function key(code: string): string {
  return code.trim().toUpperCase();
}

/** Full metadata for a scheme code, synthesising a sane default if unknown. */
export function schemeInfo(code: string): SchemeInfo {
  const hit = META[key(code)];
  if (hit) return hit;
  return {
    code: code.trim(),
    name: "Central scheme",
    ministry: "Union line ministry",
    color: FALLBACK_COLOR,
  };
}

/** Vivid accent hex for a scheme code (fallback slate for unknowns). */
export function schemeColor(code: string): string {
  return (META[key(code)] ?? { color: FALLBACK_COLOR }).color;
}

/**
 * Sibling central schemes for a department's matched schemes, de-duplicated and
 * excluding any scheme already matched. Returns full SchemeInfo for rendering.
 */
export function siblingSchemes(matched: string[]): SchemeInfo[] {
  const have = new Set(matched.map(key));
  const seen = new Set<string>();
  const out: SchemeInfo[] = [];
  for (const m of matched) {
    for (const sibKey of SIBLINGS[key(m)] ?? []) {
      if (have.has(sibKey) || seen.has(sibKey)) continue;
      seen.add(sibKey);
      out.push(schemeInfo(sibKey));
    }
  }
  return out;
}
