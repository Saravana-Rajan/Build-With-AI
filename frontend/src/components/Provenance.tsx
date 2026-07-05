/**
 * Small provenance chip for data credibility: is a number real (Census), a
 * synthetic demo complaint, or computed by the pipeline? Kept tiny + neutral.
 */
export type Provenance = "real" | "synthetic" | "computed" | "modelled";

const META: Record<Provenance, { label: string; className: string }> = {
  real: { label: "Real · Census", className: "prov prov--real" },
  synthetic: { label: "Synthetic", className: "prov prov--synthetic" },
  computed: { label: "Computed", className: "prov prov--computed" },
  modelled: { label: "Modelled", className: "prov prov--computed" },
};

export default function ProvenanceChip({ kind }: { kind: Provenance }) {
  const m = META[kind] ?? META.computed;
  return <span className={m.className} title={`Data source: ${m.label}`}>{m.label}</span>;
}
