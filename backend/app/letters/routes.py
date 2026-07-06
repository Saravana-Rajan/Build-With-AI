"""
Letter API — executive, one-click correspondence for the Act screen.

Two endpoints, mounted under ``/api`` by ``app/main.py``:

* ``POST /letter/department`` — ONE consolidated official letter to a line
  department, listing every entitlement gap it owns (areas, scheme, ₹).
* ``POST /letter/item`` — a single-beneficiary letter plus a plain-language
  eligibility rationale (why this place qualifies for the scheme).

Both reuse the offline-safe drafters in ``letters.py`` / ``templates.py`` so they
always return text, with or without cloud (Gemini/Vertex) credentials.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..schema import SchemeGap
from .letters import draft_track_a_letter, _gemini_polish
from .templates import _rupees

router = APIRouter()

# The app settings carry no MP name; use a neutral honorific for the demo.
MP_NAME = "Hon'ble Member of Parliament"


# ── Request models ───────────────────────────────────────────────────────────
class DepartmentLetterRequest(BaseModel):
    """The frontend already has the department roll-up, so it passes the
    aggregated facts. All but ``department`` are optional — the letter degrades
    gracefully when detail is missing."""

    department: str
    scheme: Optional[str] = None
    schemes: list[str] = []
    areas: list[str] = []
    rupees: Optional[float] = None
    areas_count: Optional[int] = None


class ItemLetterRequest(BaseModel):
    place_name: str
    scheme: Optional[str] = None
    category: Optional[str] = None
    title: Optional[str] = None
    area_id: Optional[str] = None
    beneficiaries: Optional[int] = None
    urban: bool = False


# ── Eligibility knowledge (why a place qualifies for a scheme) ────────────────
_ELIGIBILITY: list[tuple[tuple[str, ...], str]] = [
    (("jjm", "jal jeevan", "water"),
     "Under the Jal Jeevan Mission, every rural household is entitled to a "
     "Functional Household Tap Connection. This habitation is notified but not "
     "yet served, so its uncovered households are eligible for connection at no "
     "cost to the beneficiary."),
    (("pmay", "awas", "housing"),
     "Under PMAY, households on the SECC / Awas+ eligibility list without a "
     "pucca house are entitled to a housing grant. The uncovered families here "
     "already meet the deprivation criteria and are pending sanction."),
    (("nhm", "ayushman", "health", "abhim"),
     "Under Ayushman Bharat / NHM, eligible families are entitled to a health "
     "cover and access to the nearest functional facility. Residents here fall "
     "within the covered category but lack an issued card or nearby facility."),
    (("pension", "nsap", "social", "welfare"),
     "Under the NSAP, elderly, widow and disability applicants meeting the "
     "age / income criteria are entitled to a monthly pension. The pending "
     "beneficiaries here already satisfy those criteria."),
    (("sbm", "swachh", "sanitation", "toilet"),
     "Under the Swachh Bharat Mission, households without a sanitary latrine "
     "are entitled to an IHHL incentive. Uncovered households here qualify on "
     "the basis of the baseline survey."),
    (("pmgsy", "road", "pwd"),
     "Under PMGSY, eligible unconnected habitations of the qualifying "
     "population threshold are entitled to an all-weather road connection."),
    (("education", "school", "samagra", "scholar", "midday"),
     "Under Samagra Shiksha, children of school-going age are entitled to "
     "schooling, mid-day meals and entitlements. Beneficiaries here fall within "
     "the eligible cohort but remain unserved."),
]


def _eligibility_rationale(scheme: Optional[str], category: Optional[str]) -> str:
    hay = f"{scheme or ''} {category or ''}".lower()
    for keys, text in _ELIGIBILITY:
        if any(k in hay for k in keys):
            return text
    return (
        "This beneficiary falls within the notified eligibility list for the "
        "scheme but has not yet been enrolled or served, and is therefore "
        "entitled to coverage under the existing programme."
    )


# ── Consolidated department letter ───────────────────────────────────────────
def _consolidated_letter(req: DepartmentLetterRequest, mp_name: str) -> str:
    today = date.today()
    scheme = req.scheme or (req.schemes[0] if req.schemes else "the applicable")
    schemes_label = ", ".join(req.schemes) if req.schemes else scheme
    ref_no = f"MP/{today.strftime('%Y%m%d')}/{req.department[:3].upper()}"
    count = req.areas_count or len(req.areas)
    rupees_line = _rupees(req.rupees) if req.rupees else "as assessed"

    if req.areas:
        area_lines = "\n".join(f"    {i + 1}. {a}" for i, a in enumerate(req.areas))
        more = ""
        if req.areas_count and req.areas_count > len(req.areas):
            more = (
                f"\n    …and {req.areas_count - len(req.areas)} further areas "
                f"detailed in the annexure."
            )
        area_block = (
            "The following areas within my constituency have eligible-but-"
            "uncovered beneficiaries under your department's schemes:\n\n"
            f"{area_lines}{more}\n"
        )
    else:
        area_block = (
            "Several areas within my constituency have eligible-but-uncovered "
            "beneficiaries under your department's schemes.\n"
        )

    return (
        f"Ref. No.: {ref_no}\n"
        f"Date: {today.strftime('%d %B %Y')}\n"
        f"\n"
        f"To,\n"
        f"The Secretary,\n"
        f"{req.department},\n"
        f"Government.\n"
        f"\n"
        f"Subject: Consolidated request to close entitlement gaps under "
        f"{schemes_label} across {count} area(s) of my constituency.\n"
        f"\n"
        f"Sir/Madam,\n"
        f"\n"
        f"I write to bring to your kind attention a set of coverage shortfalls "
        f"under schemes administered by your department. On the basis of the "
        f"constituency data available to this office, eligible households in the "
        f"areas listed below remain deprived of benefits to which they are "
        f"already entitled.\n"
        f"\n"
        f"{area_block}"
        f"\n"
        f"The estimated value of these uncovered entitlements is {rupees_line}. "
        f"As these are existing entitlements under {schemes_label}, closing the "
        f"gap requires no fresh outlay of constituency development funds — only "
        f"the administrative extension of the schemes to those already eligible.\n"
        f"\n"
        f"I therefore request the Department to (i) verify the eligible-but-"
        f"uncovered lists for the areas above, (ii) initiate enrolment and "
        f"disbursement to the pending beneficiaries at the earliest, and "
        f"(iii) apprise this office of the action taken. I shall be glad to "
        f"extend any assistance required to facilitate the same.\n"
        f"\n"
        f"Thanking you,\n"
        f"\n"
        f"Yours faithfully,\n"
        f"\n"
        f"{mp_name}\n"
        f"Member of Parliament.\n"
    )


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/letter/department")
def letter_department(req: DepartmentLetterRequest):
    """Generate ONE consolidated official letter to a department."""
    # Template letter is instant and demo-safe (no LLM latency/hang).
    letter = _consolidated_letter(req, MP_NAME)

    return {
        "letter_text": letter,
        "department": req.department,
        "areas_count": req.areas_count or len(req.areas),
        "rupees": req.rupees or 0.0,
    }


def _item_letter(req: ItemLetterRequest, mp_name: str) -> str:
    """Instant single-beneficiary template letter (no LLM latency)."""
    today = date.today()
    scheme = req.scheme or "the applicable scheme"
    ref_no = f"MP/{today.strftime('%Y%m%d')}/{(req.category or 'GEN')[:3].upper()}"
    benef = req.beneficiaries or 1
    return (
        f"Ref. No.: {ref_no}\n"
        f"Date: {today.strftime('%d %B %Y')}\n\n"
        f"To,\nThe Secretary,\nThe department administering {scheme},\nGovernment.\n\n"
        f"Subject: Request to extend {scheme} entitlements to eligible "
        f"beneficiaries in {req.place_name}.\n\n"
        f"Sir/Madam,\n\n"
        f"I write regarding eligible-but-uncovered beneficiaries under {scheme} in "
        f"{req.place_name} of my constituency. Approximately {benef} eligible "
        f"person(s)/household(s) here are entitled to benefits under this scheme "
        f"but remain unserved.\n\n"
        f"As this is an existing entitlement, closing the gap requires no fresh "
        f"outlay of constituency development funds — only the administrative "
        f"extension of {scheme} to those already eligible.\n\n"
        f"I request the Department to verify the eligible list for {req.place_name}, "
        f"initiate enrolment and disbursement at the earliest, and apprise this "
        f"office of the action taken.\n\n"
        f"Thanking you,\n\nYours faithfully,\n\n{mp_name}\n"
        f"Member of Parliament.\n"
    )


@router.post("/letter/item")
def letter_item(req: ItemLetterRequest):
    """Single-beneficiary letter + a plain-language eligibility rationale (instant)."""
    letter = _item_letter(req, MP_NAME)
    eligibility = _eligibility_rationale(req.scheme, req.category)
    return {"letter_text": letter, "eligibility": eligibility}
