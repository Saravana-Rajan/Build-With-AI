import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  ChevronRight,
  FileText,
  Send,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Users,
  MapPin,
  Layers,
  Sparkles,
} from "lucide-react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import LetterModal, { LetterBody } from "../components/LetterModal";
import Pagination, { usePagination } from "../components/Pagination";
import ComplaintsModal from "../components/ComplaintsModal";
import InfoTip from "../components/InfoTip";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatCrore, formatInr } from "../format";
import {
  loadDepartments,
  projectDepartment,
  departmentColor,
} from "../lib/departments";
import type { DepartmentsResult } from "../lib/departments";
import { schemeInfo } from "../lib/schemeMeta";
import type { Department, RankedProject } from "../types";

type Tab = "A" | "B";

const MPLADS_BUDGET = 5_00_00_000; // ₹5 crore annual allocation.

/** The citizen complaints behind a letter / work — place (+ category) drill-down. */
type ComplaintsView = {
  placeName: string | null | undefined;
  category?: string | null;
  title: string;
  subtitle?: ReactNode;
};

/** Enter/Space activates a role="button" element, matching a click. */
const onKeyActivate =
  (fn: () => void) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

/** Group projects by owning department, sorted by group size (largest first). */
function groupByDept(rows: RankedProject[]): Array<[string, RankedProject[]]> {
  const map = new Map<string, RankedProject[]>();
  for (const p of rows) {
    const dept = projectDepartment(p);
    (map.get(dept) ?? map.set(dept, []).get(dept)!).push(p);
  }
  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
}

function uniqueAreas(items: RankedProject[]): string[] {
  return Array.from(new Set(items.map((p) => p.place_name).filter(Boolean)));
}

function uniqueSchemes(items: RankedProject[]): string[] {
  return Array.from(
    new Set(items.map((p) => p.matched_scheme).filter(Boolean) as string[]),
  );
}

// ── Track B: MPLADS candidate (deduped by place + category) ──────────────────
interface MpladsCandidate {
  id: string; // `${place}|${category}` — dedup key
  place_name: string;
  category: string;
  cost: number; // Σ estimated_cost of merged works
  beneficiaries: number; // Σ beneficiaries
  count: number; // number of raw works merged into this candidate
  priority: number; // max priority_score across merged works
  why?: Record<string, number>; // factor breakdown of the top-priority work
}

/** Merge duplicate MPLADS works by place + category (sum ₹, beneficiaries). */
function mergeCandidates(rows: RankedProject[]): MpladsCandidate[] {
  const m = new Map<string, MpladsCandidate>();
  for (const p of rows) {
    const id = `${p.place_name}|${p.category}`.toLowerCase();
    const ex = m.get(id);
    if (ex) {
      ex.cost += p.estimated_cost ?? 0;
      ex.beneficiaries += p.beneficiaries ?? 0;
      ex.count += 1;
      if (p.priority_score > ex.priority) {
        ex.priority = p.priority_score;
        ex.why = p.why; // keep the factor breakdown of the strongest work
      }
    } else {
      m.set(id, {
        id,
        place_name: p.place_name,
        category: p.category,
        cost: p.estimated_cost ?? 0,
        beneficiaries: p.beneficiaries ?? 0,
        count: 1,
        priority: p.priority_score,
        why: p.why,
      });
    }
  }
  return Array.from(m.values()).sort(
    (a, b) => b.priority - a.priority || b.beneficiaries - a.beneficiaries,
  );
}

/**
 * Greedy allocation that mirrors the OR-Tools knapsack intent: pick works by
 * beneficiaries-per-rupee until the ₹5 Cr budget is exhausted — i.e. the mix
 * that serves the most people per rupee.
 */
function optimalSelection(cands: MpladsCandidate[], budget: number): Set<string> {
  const byDensity = [...cands].sort(
    (a, b) =>
      b.beneficiaries / Math.max(1, b.cost) -
      a.beneficiaries / Math.max(1, a.cost),
  );
  const sel = new Set<string>();
  let total = 0;
  for (const c of byDensity) {
    if (c.cost > 0 && total + c.cost <= budget) {
      sel.add(c.id);
      total += c.cost;
    }
  }
  return sel;
}

const CATEGORY_LABEL: Record<string, string> = {
  road: "Local road / connectivity work",
  water: "Local water work",
  sanitation: "Sanitation / drainage work",
  education: "School infrastructure work",
  health: "Health facility work",
  housing: "Housing support work",
  jobs: "Livelihood / skilling work",
  pension: "Welfare support",
  other: "Community works",
};

function candidateTitle(c: MpladsCandidate): string {
  const label = CATEGORY_LABEL[c.category] ?? "Community works";
  return `${label} — ${c.place_name}`;
}

// ── Track-B rationale: WHY no central scheme owns this (so MPLADS is the route) ─
const WHY_NO_SCHEME: Record<string, string> = {
  road: "Internal, ward and colony roads fall outside PMGSY (which funds only rural inter-village links) and state highway budgets — MPLADS is the standard route to fund them.",
  water: "A stand-alone local source — a borewell, mini-tank or last-mile network — sits outside the JJM/AMRUT scheme scope, so it has to be funded from MPLADS.",
  sanitation: "Local storm-water and open drains aren't covered by the Swachh Bharat Mission (which funds toilets, not drainage) — this is a classic MPLADS work.",
  education: "Minor school works — an extra classroom, a compound wall, a toilet block — fall below Samagra Shiksha's sanction thresholds, so MPLADS fills the gap.",
  health: "One-time building and equipment upgrades to a sub-centre aren't part of the NHM recurring grant, so they're funded as an MPLADS asset.",
  housing: "Site-level support that sits outside the PMAY unit grant (access, retaining works, common facilities) is funded from MPLADS.",
  jobs: "Local livelihood infrastructure — a work-shed or market platform — has no dedicated central scheme, so MPLADS funds the asset.",
  pension: "This is a local welfare asset with no central capital scheme behind it — MPLADS is the funding route.",
  other: "Community assets — a hall, street lighting, a crematorium — have no dedicated central scheme, so they are funded from MPLADS.",
};

/** Concrete deliverable an amount buys, at demo-plausible Indian public-works rates. */
function whatItFunds(category: string, cost: number): string {
  switch (category) {
    case "road":
      return `≈ ${(cost / 5_500_000).toFixed(1)} km of all-weather BT road with cross-drainage`;
    case "water":
      return `≈ ${Math.round(cost / 20_000).toLocaleString("en-IN")} household connections, or an overhead tank + distribution network`;
    case "sanitation":
      return `≈ ${(cost / 4_000_000).toFixed(1)} km of covered storm-water drain`;
    case "education":
      return `≈ ${Math.max(1, Math.round(cost / 1_200_000))} classroom(s) + compound wall and toilet block`;
    case "health":
      return "a sub-centre building and equipment upgrade";
    case "housing":
      return `site works + common facilities for ≈ ${Math.max(1, Math.round(cost / 180_000)).toLocaleString("en-IN")} houses`;
    default:
      return "community assets — hall, street lighting, or crematorium works";
  }
}

/** How this work was surfaced — resident-raised vs need-mapped (silent area). */
function evidenceLine(why: Record<string, number> | undefined): string {
  const demand = why?.demand ?? 0;
  if (demand > 0.05) return "Raised directly by residents through petitions.";
  return "Surfaced by need-mapping — high local deficit, few or no petitions yet.";
}

/** ₹ per resident served — the MPLADS efficiency metric the optimiser ranks on. */
function perBeneficiary(cost: number, benef: number): string {
  if (benef <= 0) return "—";
  return `₹${Math.round(cost / benef).toLocaleString("en-IN")}/resident served`;
}

/** Top scoring factors as chips (Need / Demand / Equity), 0–100. */
function CandidateFactors({ why }: { why: Record<string, number> | undefined }) {
  if (!why) return null;
  const factors = Object.entries(why)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => b[1] - a[1]);
  if (factors.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {factors.map(([factor, value]) => (
        <span key={factor} className="chip chip--muted" style={{ textTransform: "capitalize" }}>
          {factor} {Math.round(value * 100)}
        </span>
      ))}
    </div>
  );
}

// ── Modal view state ─────────────────────────────────────────────────────────
type ModalState =
  | {
      kind: "dept";
      dept: string;
      loading: boolean;
      text?: string;
      areasCount?: number;
      rupees?: number;
      error?: string;
    }
  | {
      kind: "item";
      title: string;
      place: string;
      loading: boolean;
      text?: string;
      eligibility?: string;
      error?: string;
    };

export default function Act() {
  const [tab, setTab] = useState<Tab>("A");
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [complaints, setComplaints] = useState<ComplaintsView | null>(null);
  const cartInit = useRef(false);

  const openProjectComplaints = (p: RankedProject) =>
    setComplaints({
      placeName: p.place_name,
      category: p.category,
      title: p.title,
      subtitle: `${p.place_name} · ${p.category} — the citizen complaints behind this`,
    });

  const projects = useFetch(() => api.rankedProjects(300));
  const depts = useFetch<DepartmentsResult>(
    () => loadDepartments(),
    (d) => d.data.length === 0,
  );

  const { trackA, trackB } = useMemo(() => {
    const rows = projects.status === "ready" ? projects.data : [];
    return {
      trackA: rows.filter((p) => p.track === "A"),
      trackB: rows.filter((p) => p.track === "B"),
    };
  }, [projects]);

  // Department -> summary record (₹ owed, top areas, schemes, issue count).
  const summaryByDept = useMemo(() => {
    const m = new Map<string, Department>();
    if (depts.status === "ready") {
      for (const d of depts.data.data) m.set(d.department, d);
    }
    return m;
  }, [depts]);

  const groupedA = useMemo(() => groupByDept(trackA), [trackA]);
  const candidates = useMemo(() => mergeCandidates(trackB), [trackB]);
  const recommended = useMemo(
    () => optimalSelection(candidates, MPLADS_BUDGET),
    [candidates],
  );

  // Seed the cart with the recommended (optimiser-selected) mix, once.
  useEffect(() => {
    if (!cartInit.current && candidates.length > 0) {
      setCart(new Set(recommended));
      cartInit.current = true;
    }
  }, [candidates, recommended]);

  const committed = useMemo(
    () =>
      candidates
        .filter((c) => cart.has(c.id))
        .reduce((sum, c) => sum + c.cost, 0),
    [candidates, cart],
  );
  const servedSelected = useMemo(
    () =>
      candidates
        .filter((c) => cart.has(c.id))
        .reduce((sum, c) => sum + c.beneficiaries, 0),
    [candidates, cart],
  );

  const toggle = (id: string) =>
    setCart((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const pct = Math.min(100, (committed / MPLADS_BUDGET) * 100);
  const over = committed > MPLADS_BUDGET;
  const remaining = MPLADS_BUDGET - committed;

  // ── Letter generation ──────────────────────────────────────────────────────
  async function openDeptLetter(dept: string, items: RankedProject[]) {
    const summary = summaryByDept.get(dept);
    const areas = summary?.top_areas?.length
      ? summary.top_areas
      : uniqueAreas(items).slice(0, 5);
    const schemes = summary?.schemes?.length
      ? summary.schemes
      : uniqueSchemes(items);
    setModal({ kind: "dept", dept, loading: true });
    try {
      const res = await api.letterDepartment({
        department: dept,
        schemes,
        scheme: schemes[0] ?? null,
        areas,
        rupees: summary?.total_gap_value ?? null,
        areas_count: summary?.issue_count ?? uniqueAreas(items).length,
      });
      setModal({
        kind: "dept",
        dept,
        loading: false,
        text: res.letter_text,
        areasCount: res.areas_count,
        rupees: res.rupees,
      });
    } catch (e) {
      setModal({ kind: "dept", dept, loading: false, error: String(e) });
    }
  }

  async function openItemLetter(p: RankedProject) {
    setModal({
      kind: "item",
      title: p.title,
      place: p.place_name,
      loading: true,
    });
    try {
      const res = await api.letterItem({
        place_name: p.place_name,
        scheme: p.matched_scheme,
        category: p.category,
        title: p.title,
        area_id: p.area_id,
        beneficiaries: p.beneficiaries,
      });
      setModal({
        kind: "item",
        title: p.title,
        place: p.place_name,
        loading: false,
        text: res.letter_text,
        eligibility: res.eligibility,
      });
    } catch (e) {
      setModal({
        kind: "item",
        title: p.title,
        place: p.place_name,
        loading: false,
        error: String(e),
      });
    }
  }

  return (
    <Page
      title="Act"
      subtitle="Turn priorities into action, routed by department: unlock entitlements (Track A) or allocate MPLADS funds (Track B)."
    >
      <div className="tabs" role="tablist" aria-label="Action track">
        <button
          role="tab"
          aria-selected={tab === "A"}
          className={tab === "A" ? "tab tab--active" : "tab"}
          onClick={() => setTab("A")}
        >
          Track A · Letters ({groupedA.length} depts)
        </button>
        <InfoTip term="Track A" className="self-center" />
        <button
          role="tab"
          aria-selected={tab === "B"}
          className={tab === "B" ? "tab tab--active" : "tab"}
          onClick={() => setTab("B")}
        >
          Track B · ₹5 Cr cart ({candidates.length})
        </button>
        <InfoTip term="Track B" className="self-center" />
      </div>

      {projects.status === "loading" && (
        <StateBlock variant="loading" title="Loading projects…" />
      )}
      {projects.status === "empty" && (
        <StateBlock variant="empty" title="No projects to act on yet" />
      )}
      {projects.status === "error" && (
        <StateBlock
          variant="error"
          title="Could not load projects"
          detail={projects.error}
        />
      )}

      {projects.status === "ready" && tab === "A" && (
        <section aria-label="Track A letters">
          <p className="muted" style={{ marginBottom: 14 }}>
            One consolidated letter per department to unlock existing entitlements
            (JJM, PMAY-U, pensions). ₹0 of MPLADS
            <InfoTip term="MPLADS" className="mx-1" /> required — pick a department,
            generate, send.
          </p>
          {groupedA.length === 0 ? (
            <StateBlock variant="empty" title="No Track A items" />
          ) : (
            groupedA.map(([dept, items], i) => (
              <DeptLetterCard
                key={dept}
                dept={dept}
                items={items}
                summary={summaryByDept.get(dept)}
                sent={sent.has(dept)}
                defaultOpen={i === 0}
                onGenerate={() => openDeptLetter(dept, items)}
                onWhyEligible={openItemLetter}
                onSeeComplaints={openProjectComplaints}
              />
            ))
          )}
        </section>
      )}

      {projects.status === "ready" && tab === "B" && (
        <section aria-label="Track B cart">
          <p className="muted" style={{ marginBottom: 14 }}>
            Track B = needs <strong>no central scheme covers</strong> — mostly
            local roads and works. These are funded from your own{" "}
            <strong>₹5 Cr MPLADS</strong>
            <InfoTip term="MPLADS" className="mx-1" /> allocation. The highlighted mix is the
            optimiser's pick: it fits the budget while serving the most people
            per rupee. Adjust freely — the budget guard blocks over-spend.
          </p>

          <div className="budget-bar" aria-label="MPLADS budget">
            <div className="budget-bar__meta">
              <span>MPLADS allocated</span>
              <strong>{formatCrore(MPLADS_BUDGET)}</strong>
            </div>
            <div className="budget-bar__track">
              <div
                className={`budget-bar__fill${over ? " budget-bar__fill--over" : ""}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="budget-bar__meta">
              <span className="muted">
                {formatCrore(committed)} committed · {formatInr(remaining)} remaining
                · {servedSelected.toLocaleString("en-IN")} beneficiaries served
              </span>
              {over && <span className="chip chip--critical">Over budget</span>}
            </div>
          </div>

          {candidates.length === 0 ? (
            <StateBlock
              variant="empty"
              title="No Track B candidates"
              detail="Nothing to allocate against the ₹5 Cr budget yet."
            />
          ) : (
            <MpladsPool
              candidates={candidates}
              recommended={recommended}
              cart={cart}
              committed={committed}
              onToggle={toggle}
              onSeeComplaints={(c) =>
                setComplaints({
                  placeName: c.place_name,
                  category: c.category,
                  title: candidateTitle(c),
                  subtitle: `${c.place_name} · ${c.category} — the citizen complaints behind this work`,
                })
              }
            />
          )}
        </section>
      )}

      {modal && (
        <LetterModal
          title={
            modal.kind === "dept"
              ? `Letter to ${modal.dept}`
              : `Why eligible · ${modal.place}`
          }
          subtitle={
            modal.kind === "dept"
              ? modal.loading
                ? "Generating consolidated letter…"
                : modal.error
                  ? undefined
                  : `${modal.areasCount ?? 0} area(s) · ${formatInr(modal.rupees ?? 0)} owed`
              : modal.title
          }
          onClose={() => setModal(null)}
          footer={
            modal.kind === "dept" && !modal.loading && !modal.error ? (
              sent.has(modal.dept) ? (
                <span
                  className="chip chip--track-A"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <CheckCircle2 size={15} /> Sent to department
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() =>
                    setSent((prev) => new Set(prev).add(modal.dept))
                  }
                >
                  <Send size={15} /> Send to department
                </button>
              )
            ) : undefined
          }
        >
          {modal.loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "hsl(var(--muted-foreground))",
                padding: "24px 0",
              }}
            >
              <Loader2 size={18} /> Generating…
            </div>
          )}
          {modal.error && (
            <StateBlock
              variant="error"
              title="Could not generate letter"
              detail={modal.error}
            />
          )}
          {!modal.loading && !modal.error && (
            <>
              {modal.kind === "item" && modal.eligibility && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "12px 14px",
                    borderRadius: "0.6rem",
                    background: "hsl(160 84% 95%)",
                    border: "1px solid hsl(160 60% 85%)",
                    color: "hsl(var(--success))",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>
                    Eligibility rationale
                  </strong>
                  {modal.eligibility}
                </div>
              )}
              {modal.text && <LetterBody text={modal.text} />}
            </>
          )}
        </LetterModal>
      )}

      <ComplaintsModal
        open={complaints !== null}
        onClose={() => setComplaints(null)}
        placeName={complaints?.placeName}
        category={complaints?.category}
        title={complaints?.title ?? "Citizen complaints"}
        subtitle={complaints?.subtitle}
      />
    </Page>
  );
}

// ── Track A: consolidated per-department card ────────────────────────────────
function DeptLetterCard({
  dept,
  items,
  summary,
  sent,
  defaultOpen,
  onGenerate,
  onWhyEligible,
  onSeeComplaints,
}: {
  dept: string;
  items: RankedProject[];
  summary?: Department;
  sent: boolean;
  defaultOpen?: boolean;
  onGenerate: () => void;
  onWhyEligible: (p: RankedProject) => void;
  onSeeComplaints: (p: RankedProject) => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const color = departmentColor(dept);
  const owed = summary?.total_gap_value ?? null;

  const areas = summary?.top_areas?.length
    ? summary.top_areas
    : uniqueAreas(items);
  const areaTotal = summary?.issue_count ?? uniqueAreas(items).length;
  const topAreas = areas.slice(0, 5);
  const moreCount = Math.max(0, areaTotal - topAreas.length);
  const schemes = summary?.schemes?.length
    ? summary.schemes
    : uniqueSchemes(items);

  const totalBenef = items.reduce((s, p) => s + (p.beneficiaries ?? 0), 0);
  const perResident =
    owed != null && totalBenef > 0
      ? `₹${Math.round(owed / totalBenef).toLocaleString("en-IN")}/resident`
      : null;

  const pager = usePagination(items, 10);

  return (
    <div className="dept-section">
      <button
        type="button"
        className="dept-section__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight
          size={16}
          className={`dept-section__chevron${open ? " dept-section__chevron--open" : ""}`}
        />
        <span className="dept-section__dot" style={{ background: color }} />
        <span className="dept-section__name">{dept}</span>
        <span className="dept-section__meta">
          {sent && (
            <span
              className="chip chip--track-A"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <CheckCircle2 size={13} /> Sent
            </span>
          )}
          <span className="chip chip--muted">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          {owed != null && (
            <span className="dept-section__owed">{formatCrore(owed)}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="dept-section__body">
          {/* Why this is ₹0 — the load-bearing Track A rationale. */}
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: "0.6rem",
              background: "hsl(160 84% 96%)",
              border: "1px solid hsl(160 55% 86%)",
              color: "hsl(160 45% 24%)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            These are benefits your constituents are <strong>already entitled to</strong> under
            central schemes but haven't received. One consolidated letter triggers the
            department's administrative extension of the scheme — <strong>₹0 of your MPLADS</strong>{" "}
            required.
          </div>

          {/* Entitlements to unlock — per scheme: what's owed + which ministry. */}
          {schemes.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div
                className="muted"
                style={{ fontSize: 13, marginBottom: 8, fontWeight: 500 }}
              >
                Entitlements to unlock
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {schemes.map((s) => {
                  const info = schemeInfo(s);
                  return (
                    <div
                      key={s}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      <span
                        className="chip"
                        style={{
                          flexShrink: 0,
                          background: `${info.color}14`,
                          color: info.color,
                          borderColor: `${info.color}44`,
                          fontWeight: 700,
                        }}
                      >
                        {info.code}
                      </span>
                      <span>
                        {info.entitlement ? (
                          <>
                            Every eligible citizen is owed {info.entitlement}
                          </>
                        ) : (
                          <>Existing entitlements under {info.name} remain unclaimed here. </>
                        )}
                        <span className="muted"> Push: {info.ministry}.</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* The math — who's owed, how much, efficiency. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 14,
              fontSize: 13,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Users size={13} /> ≈ {totalBenef.toLocaleString("en-IN")} residents entitled
            </span>
            {owed != null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                {formatInr(owed)} owed
              </span>
            )}
            {perResident && (
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: "hsl(var(--success))" }}
                title="Entitlement value owed per resident — unlocked at ₹0 cost to your fund"
              >
                {perResident}
              </span>
            )}
          </div>

          {/* Compact summary — top areas, not 184 rows. */}
          <div style={{ marginBottom: 14 }}>
            <div
              className="muted"
              style={{ fontSize: 13, marginBottom: 6, fontWeight: 500 }}
            >
              Affected areas ({areaTotal})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {topAreas.map((a) => (
                <span key={a} className="chip chip--muted">
                  {a}
                </span>
              ))}
              {moreCount > 0 && (
                <span className="chip chip--muted">and {moreCount} more</span>
              )}
            </div>
          </div>

          {/* One clear primary action per department. */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn btn--primary"
              onClick={onGenerate}
            >
              <FileText size={15} /> Generate letter to {dept.split(/[·]/)[0].trim()}
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Hide" : `Show all ${items.length} items`}
            </button>
          </div>

          {/* Optional full, paginated list with per-item "Why eligible". */}
          {showAll && (
            <div style={{ marginTop: 14 }}>
              <ul className="ranked-list">
                {pager.pageItems.map((p) => (
                  <li
                    key={p.rank}
                    className="ranked-item"
                    role="button"
                    tabIndex={0}
                    aria-label={`View citizen complaints behind ${p.title}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSeeComplaints(p)}
                    onKeyDown={onKeyActivate(() => onSeeComplaints(p))}
                  >
                    <div className="ranked-item__body">
                      <div className="ranked-item__head">
                        <strong>{p.title}</strong>
                        {p.matched_scheme && (
                          <span className="chip chip--muted">
                            {p.matched_scheme}
                          </span>
                        )}
                      </div>
                      <div className="muted ranked-item__meta">
                        {p.place_name} · {p.category}
                      </div>
                    </div>
                    <button
                      className="btn btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onWhyEligible(p);
                      }}
                    >
                      <HelpCircle size={14} /> Why eligible
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={pager.page}
                pageCount={pager.pageCount}
                from={pager.from}
                to={pager.to}
                total={pager.total}
                onPageChange={pager.setPage}
                noun="items"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Track B: full MPLADS candidate pool with recommended mix highlighted ─────
function MpladsPool({
  candidates,
  recommended,
  cart,
  committed,
  onToggle,
  onSeeComplaints,
}: {
  candidates: MpladsCandidate[];
  recommended: Set<string>;
  cart: Set<string>;
  committed: number;
  onToggle: (id: string) => void;
  onSeeComplaints: (c: MpladsCandidate) => void;
}) {
  const selectedCount = candidates.filter((c) => cart.has(c.id)).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "6px 0 12px",
          fontSize: 13,
          color: "hsl(var(--muted-foreground))",
        }}
      >
        <Sparkles size={15} color="hsl(var(--saffron))" />
        <span>
          <strong style={{ color: "hsl(var(--foreground))" }}>
            {selectedCount} of {candidates.length}
          </strong>{" "}
          works selected — this mix maximises beneficiaries within ₹5 Cr.
        </span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {candidates.map((c) => {
          const inCart = cart.has(c.id);
          const isRec = recommended.has(c.id);
          const wouldOver = !inCart && committed + c.cost > MPLADS_BUDGET;
          return (
            <MpladsCard
              key={c.id}
              c={c}
              inCart={inCart}
              isRec={isRec}
              wouldOver={wouldOver}
              onToggle={() => onToggle(c.id)}
              onSeeComplaints={() => onSeeComplaints(c)}
            />
          );
        })}
      </div>
    </div>
  );
}

function MpladsCard({
  c,
  inCart,
  isRec,
  wouldOver,
  onToggle,
  onSeeComplaints,
}: {
  c: MpladsCandidate;
  inCart: boolean;
  isRec: boolean;
  wouldOver: boolean;
  onToggle: () => void;
  onSeeComplaints: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View citizen complaints behind ${candidateTitle(c)}`}
      onClick={onSeeComplaints}
      onKeyDown={onKeyActivate(onSeeComplaints)}
      className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{
        border: inCart
          ? "1.5px solid hsl(var(--primary))"
          : "1px solid hsl(var(--border))",
        background: inCart ? "hsl(213 58% 24% / 0.04)" : "hsl(var(--card))",
        borderRadius: "0.7rem",
        padding: "14px 16px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <input
        type="checkbox"
        checked={inCart}
        disabled={wouldOver}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Include ${candidateTitle(c)} in the MPLADS cart`}
        style={{ marginTop: 4, width: 17, height: 17, flexShrink: 0, cursor: "pointer" }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          <strong style={{ fontSize: 15 }}>{candidateTitle(c)}</strong>
          {isRec && (
            <span
              className="chip chip--track-A"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Sparkles size={12} /> Recommended
            </span>
          )}
          {c.count > 1 && (
            <span
              className="chip chip--muted"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Layers size={12} /> {c.count} works merged
            </span>
          )}
        </div>

        {/* Why it's Track B — the load-bearing rationale (per category). */}
        <div
          className="muted"
          style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}
        >
          {WHY_NO_SCHEME[c.category] ?? WHY_NO_SCHEME.other}
        </div>

        {/* What the money actually buys + how it was surfaced. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <span style={{ color: "hsl(var(--foreground))" }}>
            <strong>What {formatInr(c.cost)} funds:</strong>{" "}
            <span className="muted">{whatItFunds(c.category, c.cost)}</span>
          </span>
          <span className="muted" style={{ fontStyle: "italic" }}>
            {evidenceLine(c.why)}
          </span>
        </div>

        <CandidateFactors why={c.why} />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            fontSize: 13,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <MapPin size={13} /> {c.place_name}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Users size={13} /> {c.beneficiaries.toLocaleString("en-IN")}{" "}
            beneficiaries
          </span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: "hsl(var(--success))" }}
            title="Cost efficiency — the optimiser prefers the lowest ₹ per resident"
          >
            {perBeneficiary(c.cost, c.beneficiaries)}
          </span>
          <span className="muted" style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
            View citizen complaints →
          </span>
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{formatInr(c.cost)}</div>
        {wouldOver && (
          <span className="chip chip--critical" style={{ marginTop: 6 }}>
            exceeds budget
          </span>
        )}
      </div>
    </div>
  );
}
