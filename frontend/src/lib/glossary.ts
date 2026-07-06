/**
 * Plain-language definitions for every piece of jargon in the app, so ANY user
 * — an MP, office staff, or a judge — can decode a term in-place without a
 * separate glossary doc. Consumed by <InfoTip term="…" /> and the Glossary modal.
 *
 * Keep the wording plain and one line. Keys are matched case-sensitively by
 * InfoTip; helper lookups below are forgiving about case/spacing.
 */
export const GLOSSARY: Record<string, string> = {
  MPLADS: "The MP's own fund — about ₹5 crore a year — to spend on local projects.",
  Scheme:
    "A central-government program that gives citizens a benefit free (a house, tap water, a pension).",
  "Entitlement / Owed":
    "A benefit a citizen has a right to under a scheme but hasn't received yet.",
  Convergence:
    "The real problem: the scheme and money exist but don't reach people — a delivery failure, not a budget shortage.",
  Eligible: "People who qualify for a scheme.",
  Coverage:
    "How many eligible people actually got the benefit (e.g. 1,060 of 2,425 got a house).",
  Gap: "Eligible minus covered — the people still waiting.",
  "Gap value": "The gap × cost per person = the money owed.",
  "Track A":
    "The need is covered by a scheme → unlock it with a letter to the department. Costs the MP ₹0.",
  "Track B":
    "No scheme covers this need (mostly local roads) → the MP spends his ₹5 crore MPLADS fund.",
  "Silent village / Forgotten":
    "An area with high need but zero complaints — too poor or remote to ask.",
  "Need score":
    "How badly an area lacks basics like water, school, PHC (0 to 1; 1 = worst).",
  "Priority score":
    "The ranking number (0–100), built from Demand + Need + Feasibility + Equity.",
  "Deduplicate / Unified issue":
    "Merging many complaints about the same problem into one issue counted many times.",
  Provenance:
    "Where a number comes from — real (actual govt data), modelled (estimated), synthetic (made for the demo), computed (calculated).",
  PMAY:
    "Pradhan Mantri Awas Yojana — the government housing scheme (PMAY-G rural, PMAY-U urban).",
  "Jal Jeevan (JJM)":
    "Government scheme to give every rural home a tap water connection.",
  AMRUT: "Government urban water and infrastructure scheme for cities.",
  NHM: "National Health Mission — the government health scheme (clinics/PHCs).",
  MGNREGA: "Rural jobs guarantee scheme.",
  NULM: "Urban livelihood/jobs scheme.",
  NSAP: "National pension scheme (old-age, widow, disability pensions).",
  SBM: "Swachh Bharat Mission — toilets and sanitation (SBM-G rural, SBM-U urban).",
  "Samagra Shiksha": "The government school-education scheme.",
  "Census 2011":
    "The official government population and household-amenities count — our real data source.",
  "R.F.": "Reserved Forest — a remote forest-edge area.",
};

/** All terms as [term, definition] pairs — handy for the Glossary modal list. */
export const GLOSSARY_TERMS: Array<[string, string]> = Object.entries(GLOSSARY);

/**
 * Aliases → canonical glossary key, so callers can pass the word as it appears
 * in the UI (e.g. "JJM", "Entitlement", "Forgotten") and still resolve.
 */
const ALIASES: Record<string, string> = {
  entitlement: "Entitlement / Owed",
  entitlements: "Entitlement / Owed",
  owed: "Entitlement / Owed",
  "silent village": "Silent village / Forgotten",
  "silent villages": "Silent village / Forgotten",
  "silent score": "Silent village / Forgotten",
  forgotten: "Silent village / Forgotten",
  deduplicate: "Deduplicate / Unified issue",
  dedupe: "Deduplicate / Unified issue",
  "unified issue": "Deduplicate / Unified issue",
  jjm: "Jal Jeevan (JJM)",
  "jal jeevan": "Jal Jeevan (JJM)",
};

/** Look up a definition, tolerating case, spacing and known aliases. */
export function lookupTerm(term: string): string | undefined {
  if (GLOSSARY[term]) return GLOSSARY[term];
  const key = term.trim();
  if (GLOSSARY[key]) return GLOSSARY[key];
  const lower = key.toLowerCase();
  if (ALIASES[lower]) return GLOSSARY[ALIASES[lower]];
  // Case-insensitive direct match against canonical keys.
  const hit = Object.keys(GLOSSARY).find((k) => k.toLowerCase() === lower);
  if (hit) return GLOSSARY[hit];
  // Fallback for scheme codes like "PMAY-G", "SBM-U", "PMAY-G (Gramin)":
  // strip the sub-scheme suffix and retry on the leading token.
  const base = lower.split(/[\s(-]/)[0];
  if (base && base !== lower) {
    if (ALIASES[base]) return GLOSSARY[ALIASES[base]];
    const baseHit = Object.keys(GLOSSARY).find(
      (k) => k.toLowerCase() === base,
    );
    if (baseHit) return GLOSSARY[baseHit];
  }
  return undefined;
}
