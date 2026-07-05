"""
Batch job — build the dashboard's analytics tables from real + synthetic data.

Pipeline (Steps 5-8 wired end to end):

  READ   census_coimbatore_villages (237 REAL villages, Census 2011 amenities)
         complaints_synthetic       (300 synthetic petitions)
         urban_wards (42) + fringe_villages (16)  (area registry)

  DERIVE per-area `need_score` (0..1) from REAL Census amenity DEFICITS
         (share of core amenities a village lacks: treated tap water, PHC,
         govt school, all-weather road).  Census-derived areas are tagged
         data_source="real"; urban wards / fringe areas have no Census
         amenity rows, so their coverage is data_source="modelled".

  COUNT  `petition_count` per area from complaints_synthetic (name match).

  BUILD  scheme_gaps     — per (area, deficit) rupee value owed to citizens,
                            routed to the responsible scheme (analytics.route +
                            analytics.compute_gap).
         silent_villages — analytics.silent_score; flag petition_count == 0 and
                            need_score > 0.6 (needy but nobody is shouting).
         ranked_projects — analytics.rank_candidates over the four transparent
                            factors (demand / need / feasibility / equity).
         + a Track-B ₹5cr MPLADS optimiser selection (analytics.knapsack_select).

  WRITE  scheme_gaps, ranked_projects, silent_villages via bq.replace_table.

  PRINT  total ₹ owed (Σ gap_value), #silent villages, top 5 ranked projects.

Auth: prefers google-cloud-bigquery (ADC); falls back to `bq query --format=json`
if the client library cannot authenticate.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from typing import Dict, List, Optional

from ..schema import DepartmentSummary, RankedProject, SchemeGap, SilentVillage
from ..store import bq
from ..analytics import (
    compute_gap,
    knapsack_select,
    rank_candidates,
    route,
    silent_score,
)
from ..analytics.scheme_routing import per_unit_value
from ..analytics.optimizer import DEFAULT_BUDGET
from ..analytics.silent import FLAG_NEED_THRESHOLD

# ── Census column names (exact, from bq introspection) ───────────────────────
COL_NAME = "village_name"
COL_HH = "total__households_"
COL_POP = "total_population_of_village"
COL_TAP_TREATED = "tap_water_treated__status_a_1__na_2__"
COL_PHC = "primary_health_centre__numbers_"
COL_SCHOOL_PRIMARY = "govt_primary_school__status_a_1__na_2__"
COL_SCHOOL_MIDDLE = "govt_middle_school__status_a_1__na_2__"
COL_ROAD = "all_weather_road__status_a_1__na_2__"
COL_NO_DRAINAGE = "no_drainage__status_a_1__na_2__"
COL_ANGANWADI = "nutritional_centres_anganwadi_centre__status_a_1__na_2__"
COL_BANK = "commercial_bank__status_a_1__na_2__"
COL_BUS = "public_bus_service__status_a_1__na_2__"
COL_POST = "post_office__status_a_1__na_2__"
COL_COMMUNITY_TOILET = (
    "community_toilet_complex__including_bath__for_general_public__status_a_1__na_2__"
)
COL_LIBRARY = "public_library__status_a_1__na_2__"
COL_PVT_BUS = "private_bus_service__status_a_1__na_2__"

# Fraction of population that is school-age (rough Census-consistent estimate).
_SCHOOL_AGE_SHARE = 0.15

# ── scheme -> responsible department ─────────────────────────────────────────
DEPARTMENT_BY_SCHEME: Dict[str, str] = {
    "JJM": "Water — TWAD/CMWSSB",
    "AMRUT": "Water — TWAD/CMWSSB",
    "PMAY-G": "Housing",
    "PMAY-U": "Housing",
    "NHM": "Health",
    "Samagra Shiksha": "Education",
    "MGNREGA": "Rural Dev/Livelihood",
    "NULM": "Rural Dev/Livelihood",
    "NSAP": "Revenue/Social Welfare",
    "SBM-G": "Sanitation/Municipal",
    "SBM-U": "Sanitation/Municipal",
}


def department_for(scheme: Optional[str]) -> str:
    """Map a scheme to the department accountable for closing its gap."""
    return DEPARTMENT_BY_SCHEME.get(scheme or "", "MPLADS / Other")


def _hash01(*parts: str) -> float:
    """Deterministic pseudo-random float in [0, 1) seeded by the given parts.

    Used to model plausible, VARIED coverage per (area, scheme) without any
    randomness that would change between runs.
    """
    h = hashlib.md5("|".join(parts).encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _model_coverage(area_id: str, scheme: str, real_deficit: bool) -> float:
    """Model a plausible coverage fraction in [0.10, 0.95] for (area, scheme).

    Areas with a genuine Census deficit for this need are (credibly) under-
    covered (10–48%); everywhere else lands in a healthier 42–95% band. The
    result is deterministic but spreads into a real gradient across the grid.
    """
    r = _hash01(area_id, "cov", scheme)
    cov = 0.10 + 0.38 * r if real_deficit else 0.42 + 0.53 * r
    return round(cov, 3)


# ── input helpers ────────────────────────────────────────────────────────────
def _read_table(name: str) -> List[dict]:
    """Read a whole BigQuery table as list-of-dicts.

    Prefer google-cloud-bigquery (ADC). If that raises (bad/absent ADC), shell
    out to the `bq` CLI, which uses its own gcloud credentials.
    """
    sql = f"SELECT * FROM `{bq.PROJECT_ID}.{bq.DATASET}.{name}`"
    try:
        return bq.query(sql)
    except Exception as exc:  # noqa: BLE001
        print(f"  [google-cloud-bigquery read failed: {exc}; falling back to bq CLI]")
        out = subprocess.check_output(
            [
                "bq", "query", f"--location={bq.LOCATION}",
                "--nouse_legacy_sql", "--format=json", "--max_rows=100000", sql,
            ],
            text=True,
        )
        return json.loads(out or "[]")


def _num(v, default: float = 0.0) -> float:
    """Parse a possibly-string / 'NA' / None Census cell to a number."""
    if v is None:
        return default
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s or s.upper() == "NA":
        return default
    try:
        return float(s)
    except ValueError:
        return default


def _available(status) -> bool:
    """Census amenity status: '1' = available, '2'/'NA' = not available."""
    return str(status).strip() == "1"


def _norm(name: Optional[str]) -> str:
    """Normalise a place name for matching (lowercase, strip punctuation)."""
    return re.sub(r"[^a-z0-9]", "", str(name or "").lower())


def _petition_counts(complaints: List[dict]) -> Dict[str, int]:
    """Map normalised place_name -> petition_count."""
    counts: Dict[str, int] = {}
    for c in complaints:
        key = _norm(c.get("place_name"))
        if key:
            counts[key] = counts.get(key, 0) + 1
    return counts


def _dominant_category(complaints: List[dict], key: str) -> Optional[str]:
    """Most common true_category among complaints for this normalised place."""
    tally: Dict[str, int] = {}
    for c in complaints:
        if _norm(c.get("place_name")) == key:
            cat = c.get("true_category")
            if cat:
                tally[cat] = tally.get(cat, 0) + 1
    if not tally:
        return None
    return max(tally, key=tally.get)


# ── need derivation (REAL census deficits) ───────────────────────────────────
# A WEIGHTED basket of Census amenities. need_score = share of (weighted) basket
# a village lacks. Because the amenities have very different real-world
# availability (treated water ~89%, PHC ~13%, post office ~3%, road ~90% …), the
# weighted deficit fraction spreads continuously across villages (~0.2–0.9)
# instead of saturating at a handful of discrete values.
_NEED_BASKET = (
    # (amenity, weight, is_deficit(row)) — a mix of core services and several
    # HIGH-VARIANCE amenities (~40–70% availability: middle school, community
    # toilet, library, private bus, uncovered drainage) so the weighted deficit
    # share spreads smoothly instead of piling up at a couple of values.
    ("water", 0.14, lambda r: not _available(r.get(COL_TAP_TREATED))),
    ("health", 0.14, lambda r: _num(r.get(COL_PHC)) <= 0),
    ("road", 0.10, lambda r: not _available(r.get(COL_ROAD))),
    ("edu_primary", 0.07, lambda r: not _available(r.get(COL_SCHOOL_PRIMARY))),
    ("edu_middle", 0.09, lambda r: not _available(r.get(COL_SCHOOL_MIDDLE))),
    ("sanitation", 0.08, lambda r: str(r.get(COL_NO_DRAINAGE)).strip() == "1"),
    ("community_toilet", 0.07, lambda r: not _available(r.get(COL_COMMUNITY_TOILET))),
    ("library", 0.07, lambda r: not _available(r.get(COL_LIBRARY))),
    ("transport", 0.07, lambda r: not _available(r.get(COL_PVT_BUS))),
    ("anganwadi", 0.05, lambda r: not _available(r.get(COL_ANGANWADI))),
    ("bank", 0.05, lambda r: not _available(r.get(COL_BANK))),
    ("post", 0.07, lambda r: not _available(r.get(COL_POST))),
)
_NEED_TOTAL_WEIGHT = sum(w for _, w, _ in _NEED_BASKET)


def _need_and_deficits(row: dict) -> tuple[float, Dict[str, bool]]:
    """Weighted need_score (0..1) + scheme-relevant deficit flags for a village.

    need_score = weighted share of the amenity basket the village lacks.
    The returned flags are the scheme-eligible need types (water/health/
    education/sanitation) for which this village has a genuine Census deficit.
    """
    lacking = sum(w for _, w, is_deficit in _NEED_BASKET if is_deficit(row))
    need = round(lacking / _NEED_TOTAL_WEIGHT, 4) if _NEED_TOTAL_WEIGHT else 0.0

    flags = {
        "water": not _available(row.get(COL_TAP_TREATED)),
        "health": _num(row.get(COL_PHC)) <= 0,
        "education": not _available(row.get(COL_SCHOOL_PRIMARY))
            and not _available(row.get(COL_SCHOOL_MIDDLE)),
        "sanitation": str(row.get(COL_NO_DRAINAGE)).strip() == "1",
    }
    return need, {k: v for k, v in flags.items() if v}


# ── area assembly ────────────────────────────────────────────────────────────
def _build_areas(census, wards, fringe, pcounts) -> List[dict]:
    """One record per governable area, carrying need + petition + deficit info."""
    areas: List[dict] = []

    # REAL rural villages — need_score = weighted Census amenity deficit share.
    for i, row in enumerate(census, start=1):
        key = _norm(row.get(COL_NAME))
        need, deficits = _need_and_deficits(row)
        areas.append(
            {
                "area_id": f"V-{i:03d}",
                "place_name": row.get(COL_NAME) or f"Village {i}",
                "urban": False,
                "households": int(_num(row.get(COL_HH))),
                "population": int(_num(row.get(COL_POP))),
                "need_score": need,
                "deficits": deficits,
                "petition_count": pcounts.get(key, 0),
                "data_source": "real",
            }
        )

    # Determine petition scale for modelled urban need.
    max_pet = max([a["petition_count"] for a in areas] + [1])

    # URBAN wards — no Census amenity rows -> modelled coverage / need.
    for i, w in enumerate(wards, start=1):
        key = _norm(w.get("name"))
        pc = pcounts.get(key, 0)
        need = min(0.9, 0.25 + 0.5 * (pc / max_pet))
        areas.append(
            {
                "area_id": str(w.get("id") or f"W-{i:03d}"),
                "place_name": w.get("name") or f"Ward {i}",
                "urban": True,
                # modelled household base for an urban ward
                "households": 1500 + (i * 37) % 2500,
                "population": (1500 + (i * 37) % 2500) * 4,
                "need_score": need,
                "deficits": {"sanitation": True},  # modelled coverage gap
                "petition_count": pc,
                "data_source": "modelled",
            }
        )

    # FRINGE peri-urban villages — modelled coverage.
    for i, f in enumerate(fringe, start=1):
        key = _norm(f.get("name"))
        areas.append(
            {
                "area_id": str(f.get("id") or f"F-{i:03d}"),
                "place_name": f.get("name") or f"Fringe {i}",
                "urban": False,
                "households": 900 + (i * 53) % 1500,
                "population": (900 + (i * 53) % 1500) * 4,
                # modelled need: baseline + petition pressure, deterministically spread
                "need_score": round(
                    min(0.9, 0.35 + 0.35 * _hash01(str(f.get("id") or i), "need")
                        + 0.2 * (pcounts.get(key, 0) / max_pet)),
                    4,
                ),
                "deficits": {"water": True, "sanitation": True},  # modelled gaps
                "petition_count": pcounts.get(key, 0),
                "data_source": "modelled",
            }
        )

    return areas


# ── output builders ──────────────────────────────────────────────────────────
def _eligible_basis(category: str, area: dict) -> int:
    """People/units eligible for a scheme in this area, by category."""
    if category in ("water", "housing", "sanitation"):
        return area["households"]
    if category == "education":
        return int(round(area["population"] * _SCHOOL_AGE_SHARE))
    # health, jobs, pension -> whole population
    return area["population"]


# Scheme-owned need categories a (area, scheme) gap can be reported for.
_SCHEME_CATEGORIES = (
    "water", "housing", "health", "education", "jobs", "pension", "sanitation",
)
# Roughly how many of the non-deficit schemes an area also reports a gap for.
_EXTRA_SCHEME_RATE = 0.35


def build_scheme_gaps(areas: List[dict]) -> List[SchemeGap]:
    """One SchemeGap per (area, scheme) with a MODELLED, varied coverage %.

    An area reports a gap for a scheme if it has a genuine Census deficit in that
    need type, OR if it is deterministically selected as a partially-covered area
    (so the heatmap shows a real gradient across schemes, not all-0%). Coverage
    is modelled per (area, scheme); gap = eligible*(1-coverage); gap_value =
    gap * per_unit_value. Each row is tagged with its responsible department.
    """
    gaps: List[SchemeGap] = []
    for area in areas:
        aid = area["area_id"]
        for category in _SCHEME_CATEGORIES:
            real_deficit = bool(area["deficits"].get(category))
            selected = real_deficit or (
                _hash01(aid, "incl", category) < _EXTRA_SCHEME_RATE
            )
            if not selected:
                continue
            scheme, _track = route(category, area["urban"])
            puv = per_unit_value(category, area["urban"])
            if not scheme or puv <= 0:
                continue  # Track-B (no owning scheme) -> handled as a project
            eligible = _eligible_basis(category, area)
            if eligible <= 0:
                continue
            coverage = _model_coverage(aid, scheme, real_deficit)
            covered = int(round(eligible * coverage))
            g = compute_gap(eligible=eligible, covered=covered, per_unit_value=puv)
            gaps.append(
                SchemeGap(
                    area_id=aid,
                    place_name=area["place_name"],
                    urban=area["urban"],
                    scheme=scheme,
                    department=department_for(scheme),
                    category=category,
                    coverage=round(covered / eligible, 4) if eligible else 0.0,
                    data_source=area["data_source"],
                    **g,
                )
            )
    return gaps


def build_department_summary(gaps: List[SchemeGap]) -> List[DepartmentSummary]:
    """Aggregate scheme gaps by responsible department."""
    by_dept: Dict[str, dict] = {}
    for g in gaps:
        d = by_dept.setdefault(
            g.department,
            {"total": 0.0, "count": 0, "schemes": set(), "areas": {}},
        )
        d["total"] += g.gap_value
        d["count"] += 1
        d["schemes"].add(g.scheme)
        d["areas"][g.place_name] = d["areas"].get(g.place_name, 0.0) + g.gap_value

    summaries: List[DepartmentSummary] = []
    for dept, d in by_dept.items():
        top_areas = [
            name for name, _ in sorted(
                d["areas"].items(), key=lambda kv: kv[1], reverse=True
            )[:5]
        ]
        summaries.append(
            DepartmentSummary(
                department=dept,
                total_gap_value=round(d["total"], 2),
                issue_count=d["count"],
                top_areas=top_areas,
                schemes=sorted(d["schemes"]),
            )
        )
    summaries.sort(key=lambda s: s.total_gap_value, reverse=True)
    return summaries


def build_silent(areas: List[dict]) -> List[SilentVillage]:
    """Silent-village score/flag for every area."""
    out: List[SilentVillage] = []
    for area in areas:
        s = silent_score(area["need_score"], area["petition_count"])
        out.append(
            SilentVillage(
                area_id=area["area_id"],
                place_name=area["place_name"],
                **s,
            )
        )
    return out


def _estimated_cost(area: dict) -> float:
    """Modelled Track-B (MPLADS) project cost from population, ₹2M-40M."""
    raw = max(2_000_000.0, area["population"] * 1500.0)
    return float(min(40_000_000.0, round(raw, -5)))


def _project_category(area: dict, complaints: List[dict]) -> str:
    """Pick the area's headline category: loudest petition, else worst deficit."""
    key = _norm(area["place_name"])
    dom = _dominant_category(complaints, key)
    if dom:
        return dom
    for cat, is_deficit in area["deficits"].items():
        if is_deficit:
            return cat
    return "other"


def build_ranked(areas: List[dict], complaints: List[dict]) -> List[RankedProject]:
    """Rank actionable projects by the four transparent factors."""
    max_pet = max([a["petition_count"] for a in areas] + [1])
    candidates: List[dict] = []
    for area in areas:
        if area["need_score"] <= 0 and area["petition_count"] <= 0:
            continue  # nothing to act on
        category = _project_category(area, complaints)
        scheme, track = route(category, area["urban"])
        demand = area["petition_count"] / max_pet
        candidates.append(
            {
                "area_id": area["area_id"],
                "place_name": area["place_name"],
                "category": category,
                "track": track,
                "matched_scheme": scheme,
                "beneficiaries": area["population"],
                "estimated_cost": _estimated_cost(area) if track == "B" else None,
                # four transparent factors in [0, 1]
                "demand": demand,
                "need": area["need_score"],
                "feasibility": 0.8 if track == "A" else 0.6,
                "equity": 1.0 - demand,  # under-petitioned areas get a fairness boost
            }
        )

    ranked = rank_candidates(candidates)
    projects: List[RankedProject] = []
    for c in ranked:
        scheme = c["matched_scheme"]
        label = scheme or "MPLADS works"
        projects.append(
            RankedProject(
                rank=c["rank"],
                area_id=c["area_id"],
                place_name=c["place_name"],
                title=f"{c['category'].title()} — {label} in {c['place_name']}",
                category=c["category"],
                track=c["track"],
                priority_score=c["priority_score"],
                why=c["why"],
                estimated_cost=c["estimated_cost"],
                beneficiaries=c["beneficiaries"],
                matched_scheme=scheme,
                department=department_for(scheme) if scheme else "MPLADS / Other",
            )
        )
    return projects


# ── main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    # Windows consoles default to cp1252 and choke on the ₹ glyph in the report.
    try:
        import sys
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        pass
    print(f"Reading inputs from {bq.PROJECT_ID}.{bq.DATASET} ({bq.LOCATION}) ...")
    census = _read_table("census_coimbatore_villages")
    complaints = _read_table("complaints_synthetic")
    wards = _read_table("urban_wards")
    fringe = _read_table("fringe_villages")
    print(
        f"  census={len(census)} villages, complaints={len(complaints)}, "
        f"wards={len(wards)}, fringe={len(fringe)}"
    )

    pcounts = _petition_counts(complaints)
    matched = sum(1 for a_key in pcounts)
    areas = _build_areas(census, wards, fringe, pcounts)
    print(f"  {len(areas)} areas assembled; {matched} distinct petitioned places")

    # Build outputs.
    scheme_gaps = build_scheme_gaps(areas)
    silent = build_silent(areas)
    ranked = build_ranked(areas, complaints)
    departments = build_department_summary(scheme_gaps)

    # Track-B ₹5cr MPLADS optimiser selection.
    track_b = [
        {"id": p.area_id, "priority_score": p.priority_score,
         "estimated_cost": p.estimated_cost, "title": p.title}
        for p in ranked
        if p.track == "B" and (p.estimated_cost or 0) > 0
    ]
    selected, sel_priority, sel_cost = knapsack_select(track_b, budget=DEFAULT_BUDGET)

    # Serialise (pydantic -> plain dict for BigQuery JSON load).
    gap_rows = [g.model_dump() for g in scheme_gaps]
    ranked_rows = [p.model_dump() for p in ranked]
    silent_rows = [s.model_dump() for s in silent]
    dept_rows = [d.model_dump() for d in departments]

    # Write (WRITE_TRUNCATE / autodetect).
    print("Writing analytics tables ...")
    bq.replace_table("scheme_gaps", gap_rows)
    bq.replace_table("ranked_projects", ranked_rows)
    bq.replace_table("silent_villages", silent_rows)
    bq.replace_table("department_summary", dept_rows)

    # ── summary ──────────────────────────────────────────────────────────────
    total_owed = sum(g.gap_value for g in scheme_gaps)
    real_owed = sum(g.gap_value for g in scheme_gaps if g.data_source == "real")
    flagged = [s for s in silent if s.flagged]
    top_silent = max(flagged, key=lambda s: s.silent_score, default=None)

    print("\n" + "=" * 68)
    print("ANALYTICS BUILD SUMMARY")
    print("=" * 68)
    print(f"rows written  scheme_gaps={len(gap_rows)}  "
          f"ranked_projects={len(ranked_rows)}  silent_villages={len(silent_rows)}  "
          f"department_summary={len(dept_rows)}")
    print(f"total ₹ owed (Σ gap_value): ₹{total_owed:,.0f}  "
          f"(real census: ₹{real_owed:,.0f})")
    print(f"silent villages flagged (need>{FLAG_NEED_THRESHOLD}, 0 petitions): "
          f"{len(flagged)}")
    if top_silent:
        print(f"top silent village: {top_silent.place_name} "
              f"(need={top_silent.need_score:.2f}, silent_score={top_silent.silent_score:.2f})")
    print(f"Track-B MPLADS ₹5cr optimiser: selected {len(selected)} projects, "
          f"₹{sel_cost:,.0f} of ₹{DEFAULT_BUDGET:,.0f} committed "
          f"(Σ priority={sel_priority:.2f})")

    print("\nTop 5 ranked projects:")
    for p in ranked[:5]:
        cost = f"₹{p.estimated_cost:,.0f}" if p.estimated_cost else "Track A (entitlement)"
        print(f"  {p.rank:>2}. {p.title[:60]:<60} "
              f"score={p.priority_score:.3f}  {cost}")

    print("\nDepartment summary (by ₹ owed):")
    for d in departments:
        print(f"  {d.department:<26} ₹{d.total_gap_value:>16,.0f}  "
              f"issues={d.issue_count:>4}  schemes={','.join(d.schemes)}")
    print("=" * 68)


if __name__ == "__main__":
    main()
