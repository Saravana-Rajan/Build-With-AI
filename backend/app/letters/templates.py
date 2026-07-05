"""
Clean, formal document templates (English, government tone).

These are pure functions over the canonical shapes in ``backend/app/schema.py``.
They contain NO external dependencies so they always work as the offline
fallback for the Gemini-backed drafters in ``letters.py``.
"""
from __future__ import annotations

from datetime import date

from ..schema import SchemeGap, RankedProject


def _rupees(value: float) -> str:
    """Format a rupee amount with Indian-style grouping."""
    whole = int(round(value))
    s = str(abs(whole))
    if len(s) > 3:
        last3 = s[-3:]
        rest = s[:-3]
        parts = []
        while len(rest) > 2:
            parts.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.insert(0, rest)
        s = ",".join(parts) + "," + last3
    return ("-" if whole < 0 else "") + "Rs. " + s


def _area_label(gap: SchemeGap) -> str:
    return "ward" if gap.urban else "village"


def track_a_letter_template(
    gap: SchemeGap,
    mp_name: str,
    department: str,
    ref_no: str | None = None,
    today: date | None = None,
) -> str:
    """
    (a) Track A — official letter to a department requesting that an existing
    entitlement be unlocked for eligible-but-uncovered residents.
    """
    today = today or date.today()
    ref_no = ref_no or f"MP/{gap.area_id}/{gap.scheme}/{today.strftime('%Y%m%d')}"
    area = _area_label(gap)

    return (
        f"Ref. No.: {ref_no}\n"
        f"Date: {today.strftime('%d %B %Y')}\n"
        f"\n"
        f"To,\n"
        f"The Secretary,\n"
        f"{department},\n"
        f"Government.\n"
        f"\n"
        f"Subject: Extension of {gap.scheme} entitlement to eligible households "
        f"in {gap.place_name} ({area} {gap.area_id}).\n"
        f"\n"
        f"Sir/Madam,\n"
        f"\n"
        f"I write to bring to your kind attention a coverage shortfall under the "
        f"{gap.scheme} scheme in {gap.place_name} within my constituency. On the "
        f"basis of the constituency data available to this office, {gap.eligible} "
        f"households/beneficiaries in this {area} are eligible under the scheme, "
        f"whereas only {gap.covered} are presently covered. This leaves "
        f"{gap.gap} eligible-but-uncovered beneficiaries who remain deprived of a "
        f"benefit to which they are already entitled.\n"
        f"\n"
        f"The estimated value of this uncovered entitlement is {_rupees(gap.gap_value)}, "
        f"computed at {_rupees(gap.per_unit_value)} per beneficiary. As this is an "
        f"existing entitlement under {gap.scheme}, closing the gap requires no fresh "
        f"outlay of constituency development funds and only the administrative "
        f"extension of the scheme to those already eligible.\n"
        f"\n"
        f"I therefore request the Department to (i) verify the eligible-but-uncovered "
        f"list for {gap.place_name}, (ii) initiate enrolment and disbursement to the "
        f"{gap.gap} pending beneficiaries at the earliest, and (iii) apprise this "
        f"office of the action taken. I shall be glad to extend any assistance "
        f"required to facilitate the same.\n"
        f"\n"
        f"Thanking you,\n"
        f"\n"
        f"Yours faithfully,\n"
        f"\n"
        f"{mp_name}\n"
        f"Member of Parliament.\n"
        f"\n"
        f"(This entitlement gap is derived from {gap.data_source} data.)"
    )


def track_b_plan_template(
    projects: list[RankedProject],
    mp_name: str,
    constituency: str = "the constituency",
    today: date | None = None,
) -> str:
    """
    (b) Track B — constituency development-plan summary listing the priority
    projects proposed for funding (e.g. under MPLADS).
    """
    today = today or date.today()

    lines = [
        f"CONSTITUENCY DEVELOPMENT PLAN — SUMMARY",
        f"Prepared for: {constituency}",
        f"Prepared by: {mp_name}, Member of Parliament",
        f"Date: {today.strftime('%d %B %Y')}",
        "",
        f"The following {len(projects)} priority works are proposed for "
        f"implementation, ranked by need and impact:",
        "",
    ]

    total_cost = 0.0
    for p in projects:
        cost = p.estimated_cost or 0.0
        total_cost += cost
        cost_str = _rupees(cost) if p.estimated_cost is not None else "to be assessed"
        benef = f"{p.beneficiaries} beneficiaries" if p.beneficiaries else "beneficiaries TBD"
        lines.append(
            f"{p.rank}. {p.title}\n"
            f"   Location : {p.place_name} ({p.area_id})\n"
            f"   Sector   : {p.category.title()}   |   Track: {p.track}\n"
            f"   Priority : {p.priority_score:.2f}   |   {benef}\n"
            f"   Est. cost: {cost_str}"
        )
        if p.matched_scheme:
            lines.append(f"   Scheme   : {p.matched_scheme}")
        lines.append("")

    lines.append(f"Indicative total outlay: {_rupees(total_cost)}.")
    lines.append("")
    lines.append(
        "This plan prioritises works by demonstrated local need and the number of "
        "beneficiaries served, so as to secure the maximum public benefit from "
        "available development funds."
    )
    lines.append("")
    lines.append(f"{mp_name}")
    lines.append("Member of Parliament.")
    return "\n".join(lines)


def justification_memo_template(project: RankedProject) -> str:
    """
    (c) A short (2-3 line) plain-language justification memo for a single project,
    suitable for briefing notes and dashboards.
    """
    benef = (
        f"about {project.beneficiaries} residents"
        if project.beneficiaries
        else "local residents"
    )
    cost_clause = ""
    if project.track == "B" and project.estimated_cost is not None:
        cost_clause = f" at an estimated cost of {_rupees(project.estimated_cost)}"
    scheme_clause = (
        f" It is delivered through the {project.matched_scheme} scheme."
        if project.matched_scheme
        else ""
    )

    return (
        f"JUSTIFICATION MEMO — Priority #{project.rank}: {project.title}\n"
        f"This work in {project.place_name} ({project.area_id}) addresses a "
        f"{project.category} need affecting {benef}{cost_clause}. "
        f"It is ranked with a priority score of {project.priority_score:.2f}, "
        f"reflecting the urgency and scale of local demand.{scheme_clause}"
    )
