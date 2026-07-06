import { useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  ShieldCheck,
  Building2,
  Layers,
  Unlock,
  ListChecks,
  VolumeX,
} from "lucide-react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { formatCrore, formatCroreShort } from "../format";
import { loadDepartments, departmentColor } from "../lib/departments";
import type { DepartmentsResult } from "../lib/departments";
import HBarChart from "../components/HBarChart";
import ProvenanceChip from "../components/Provenance";
import InfoTip from "../components/InfoTip";
import ComplaintsModal from "../components/ComplaintsModal";
import ActionCenter from "./ActionCenter";
import ImpactScorecard from "./ImpactScorecard";
import type { DemandRow, RankedProject } from "../types";

function langChip(code: string | null): string {
  if (!code) return "—";
  return code.toUpperCase();
}

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

export default function Dashboard() {
  const [complaintsView, setComplaintsView] = useState<ComplaintsView | null>(null);
  const [tab, setTab] = useState<"overview" | "today" | "impact">("overview");
  const stats = useFetch(() => api.stats(), () => false);
  const demands = useFetch<DemandRow[]>(() => api.demands(6));
  const depts = useFetch<DepartmentsResult>(
    () => loadDepartments(),
    (d) => d.data.length === 0,
  );
  const projects = useFetch<RankedProject[]>(() => api.rankedProjects(50));

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const owed = stats.status === "ready" ? stats.data.rupees_owed : null;
  const silent = stats.status === "ready" ? stats.data.silent_villages : null;
  const realVillages = stats.status === "ready" ? stats.data.real_villages : null;
  const complaints = stats.status === "ready" ? stats.data.complaints : null;

  // Supporting stats — deliberately secondary to the owed hero (not vanity leads).
  const supportStats: Array<{ label: string; value: string | null; prov: "real" | "synthetic" | "computed" }> = [
    {
      label: "Villages never asked",
      value: silent != null ? silent.toLocaleString("en-IN") : null,
      prov: "computed",
    },
    {
      label: "Villages (real coverage)",
      value: realVillages != null ? realVillages.toLocaleString("en-IN") : null,
      prov: "real",
    },
    {
      label: "Complaints processed",
      value: complaints != null ? complaints.toLocaleString("en-IN") : null,
      prov: "synthetic",
    },
  ];

  const deptRows = depts.status === "ready" ? depts.data.data : [];
  const chartData = deptRows.slice(0, 8).map((d) => ({
    name: d.department,
    value: d.total_gap_value,
    color: departmentColor(d.department),
  }));

  const topPriorities: RankedProject[] =
    projects.status === "ready"
      ? [...projects.data].sort((a, b) => b.priority_score - a.priority_score).slice(0, 6)
      : [];

  return (
    <div className="flex flex-col">
      {/* Page heading */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {greeting}, MP Office · Coimbatore. Your decisions start here.
        </p>
      </div>

      {/* Dashboard sub-tabs — Overview / Today briefing / Impact scorecard */}
      <div className="tabs" role="tablist" aria-label="Dashboard view" style={{ marginBottom: 18 }}>
        <button
          role="tab"
          aria-selected={tab === "overview"}
          className={tab === "overview" ? "tab tab--active" : "tab"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={tab === "today"}
          className={tab === "today" ? "tab tab--active" : "tab"}
          onClick={() => setTab("today")}
        >
          Today
        </button>
        <button
          role="tab"
          aria-selected={tab === "impact"}
          className={tab === "impact" ? "tab tab--active" : "tab"}
          onClick={() => setTab("impact")}
        >
          Impact
        </button>
      </div>

      {tab === "today" && <ActionCenter />}
      {tab === "impact" && <ImpactScorecard />}

      {tab === "overview" && (
        <>
      {/* Owed hero — the lead story (WOW #1) */}
      <section aria-label="Entitlements owed" className="headline mb-4">
        <span className="headline__label">
          Already owed to your people · unclaimed entitlements
          <InfoTip term="Entitlement / Owed" className="ml-1" />
        </span>
        <span className="headline__value">
          {owed != null ? formatCrore(owed) : stats.status === "error" ? "₹—" : "₹…"}
        </span>
        <span className="headline__note">
          This money is your constituents&apos; by right — Track A unlocks it with letters, spending
          <strong> ₹0</strong> of your <strong>₹5&nbsp;cr</strong> MPLADS
          <InfoTip term="MPLADS" className="mx-1" /> budget before it&apos;s touched.
        </span>
      </section>

      {/* Supporting stats — secondary to the owed hero, each with provenance */}
      <section aria-label="Supporting metrics" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {supportStats.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <ProvenanceChip kind={k.prov} />
            </div>
            <div className="mt-1">
              {k.value === null ? (
                <div className="mt-0.5 h-7 w-20 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-semibold tracking-tight text-foreground">{k.value}</div>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Two-floor explainer strip */}
      <section aria-label="How Sarvik works" className="two-floor mb-6">
        <div className="floor-card">
          <span className="floor-card__num" style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}>
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Floor 1 · Consolidate &amp; rank</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Deduplicate every petition, theme it, map it, and rank projects on demand, need,
              feasibility and equity — the complaint inbox judges expect, done solidly.
            </p>
          </div>
        </div>
        <div className="floor-card">
          <span className="floor-card__num" style={{ background: "hsl(160 84% 94%)", color: "hsl(var(--success))" }}>
            <Unlock className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Floor 2 · Unlock what&apos;s owed</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Convert gaps into money: route every rupee to the department that owes it (Track A,
              ₹0 of MPLADS) and spend the ₹5&nbsp;cr budget where it counts (Track B).
            </p>
          </div>
        </div>
      </section>

      {/* By Department */}
      <section aria-label="By department" className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">By department — whose job is it</h2>
          </div>
          <Link to="/departments" className="text-xs font-medium text-primary hover:underline">
            All departments →
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Bar chart */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-1 text-xs font-medium text-muted-foreground">₹ owed by department</div>
            {depts.status === "loading" && (
              <div className="h-[300px] animate-pulse rounded bg-muted/50" />
            )}
            {depts.status === "error" && (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Department rollup unavailable.
              </div>
            )}
            {depts.status === "empty" && (
              <div className="py-10 text-center text-xs text-muted-foreground">No departments yet.</div>
            )}
            {depts.status === "ready" && (
              <HBarChart data={chartData} format={formatCroreShort} labelWidth={170} />
            )}
          </div>

          {/* Department cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {depts.status === "loading" &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[112px] animate-pulse rounded-lg border border-border bg-muted/40" />
              ))}
            {depts.status === "ready" &&
              deptRows.slice(0, 4).map((d) => {
                const color = departmentColor(d.department);
                const topArea = d.top_areas[0];
                return (
                  <button
                    key={d.department}
                    type="button"
                    aria-label={`View citizen complaints behind ${d.department}`}
                    onClick={() =>
                      setComplaintsView({
                        placeName: topArea,
                        title: d.department,
                        subtitle: `${formatCrore(d.total_gap_value)} owed · ${d.issue_count.toLocaleString("en-IN")} issues${topArea ? ` · ${topArea}` : ""}`,
                      })
                    }
                    className="group flex cursor-pointer flex-col gap-1.5 rounded-lg border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">{d.department}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-primary" />
                    </div>
                    <div className="text-lg font-bold tabular-nums" style={{ color }}>
                      {formatCrore(d.total_gap_value)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.issue_count.toLocaleString("en-IN")} issues
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {d.top_areas.slice(0, 2).map((a) => (
                        <span
                          key={a}
                          className="truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-primary group-hover:underline">
                      See complaints →
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </section>

      {/* Forgotten villages callout (WOW #3) */}
      <Link
        to="/forgotten"
        className="group mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <VolumeX className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            {silent != null ? `${silent} villages that never asked` : "Villages that never asked"}
          </div>
          <div className="text-xs text-muted-foreground">
            High estimated need, few or no petitions — the silent constituents you&apos;d otherwise miss.
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary" />
      </Link>

      {/* Bottom panels: Top priorities + Recent activity */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Top priorities */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">Top priorities</div>
                <div className="text-xs text-muted-foreground">Highest-scoring ranked projects.</div>
              </div>
            </div>
            <Link to="/priorities" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>

          {projects.status === "loading" && (
            <ul className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="h-9 animate-pulse rounded bg-muted/50" />
              ))}
            </ul>
          )}
          {projects.status === "error" && (
            <div className="py-6 text-center text-xs text-muted-foreground">Couldn't load priorities.</div>
          )}
          {(projects.status === "empty" ||
            (projects.status === "ready" && topPriorities.length === 0)) && (
            <div className="py-6 text-center text-xs text-muted-foreground">No ranked projects yet.</div>
          )}
          {projects.status === "ready" && topPriorities.length > 0 && (
            <ul className="space-y-1">
              {topPriorities.map((p, i) => (
                <li
                  key={p.rank}
                  role="button"
                  tabIndex={0}
                  aria-label={`View citizen complaints behind ${p.title}`}
                  onClick={() =>
                    setComplaintsView({
                      placeName: p.place_name,
                      category: p.category,
                      title: p.title,
                      subtitle: `${p.place_name} · ${p.category}${p.matched_scheme ? ` · ${p.matched_scheme}` : ""}`,
                    })
                  }
                  onKeyDown={onKeyActivate(() =>
                    setComplaintsView({
                      placeName: p.place_name,
                      category: p.category,
                      title: p.title,
                      subtitle: `${p.place_name} · ${p.category}${p.matched_scheme ? ` · ${p.matched_scheme}` : ""}`,
                    }),
                  )}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">{p.title}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {p.place_name} · {p.category}
                      {p.matched_scheme ? ` · ${p.matched_scheme}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      p.track === "A"
                        ? "bg-[hsl(160_84%_95%)] text-[hsl(var(--success))]"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {p.track === "A" ? "Track A" : "Track B"}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                    {Math.round(p.priority_score * 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity — latest demands */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Recent activity</div>
              <div className="text-xs text-muted-foreground">Latest citizen demands.</div>
            </div>
            <Link to="/intake" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>

          {demands.status === "loading" && (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ol>
          )}
          {demands.status === "error" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              Couldn't load activity.
              <div className="mt-1 font-mono text-[10px] opacity-70">{demands.error}</div>
            </div>
          )}
          {demands.status === "empty" && (
            <div className="py-6 text-center text-xs text-muted-foreground">No activity yet.</div>
          )}
          {demands.status === "ready" && (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {demands.data.map((d) => (
                <li
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View citizen complaints from ${d.place_name ?? "this area"}`}
                  onClick={() =>
                    setComplaintsView({
                      placeName: d.place_name,
                      title: d.place_name ?? "Citizen complaints",
                      subtitle: d.true_category ? `All complaints from ${d.place_name}` : undefined,
                    })
                  }
                  onKeyDown={onKeyActivate(() =>
                    setComplaintsView({
                      placeName: d.place_name,
                      title: d.place_name ?? "Citizen complaints",
                      subtitle: d.true_category ? `All complaints from ${d.place_name}` : undefined,
                    }),
                  )}
                  className="relative -mx-1 cursor-pointer rounded-md px-1 py-0.5 hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="absolute -left-[20px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-2 text-xs">
                    <span className="font-medium text-foreground">{d.place_name ?? "Unknown"}</span>
                    {d.true_category && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {d.true_category}
                      </span>
                    )}
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-foreground">
                      {langChip(d.language)}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {d.channel ?? "web"}
                    </span>
                  </div>
                  {d.raw_text && (
                    <div className="mt-1 line-clamp-1 text-xs text-slate-600 dark:text-slate-300">
                      {d.raw_text}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Reminder banner */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-accent/40 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <span className="font-medium">Data note: </span>
          Complaints shown are synthetic, generated over real Coimbatore geography for
          demonstration. All data is processed and stored on MeitY-compliant Indian cloud
          infrastructure.
        </div>
      </div>
        </>
      )}

      <ComplaintsModal
        open={complaintsView !== null}
        onClose={() => setComplaintsView(null)}
        placeName={complaintsView?.placeName}
        category={complaintsView?.category}
        title={complaintsView?.title ?? "Citizen complaints"}
        subtitle={complaintsView?.subtitle}
      />
    </div>
  );
}
