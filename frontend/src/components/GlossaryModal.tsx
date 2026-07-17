import * as React from "react";
import { createPortal } from "react-dom";
import { X, Search, BookOpen } from "lucide-react";
import { GLOSSARY_TERMS } from "../lib/glossary";

/**
 * Full-glossary reference: every jargon term + its plain-language definition in
 * one searchable modal, reachable from the sidebar footer. Complements the tiny
 * inline <InfoTip> so a user can also browse everything at once.
 */
export default function GlossaryModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter(
      ([term, def]) =>
        term.toLowerCase().includes(q) || def.toLowerCase().includes(q),
    );
  }, [query]);

  // Portal to <body>: the sidebar <aside> forms its own stacking context, so a
  // fixed overlay rendered inside it can be painted over by the Google Maps
  // canvas in the main pane regardless of z-index.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Glossary of terms"
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[hsl(213_43%_16%_/_0.45)] p-5 backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-[min(640px,100%)] flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-[0_24px_60px_hsl(213_43%_16%_/_0.35)]"
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg text-foreground">Glossary</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Plain-language meaning of every term used across Sarvik.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close glossary"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms…"
              aria-label="Search glossary"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No terms match “{query}”.
            </p>
          ) : (
            <dl className="space-y-3.5">
              {filtered.map(([term, def]) => (
                <div key={term}>
                  <dt className="text-[13px] font-semibold text-foreground">
                    {term}
                  </dt>
                  <dd className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    {def}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <footer className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
          {filtered.length} of {GLOSSARY_TERMS.length} terms
        </footer>
      </div>
    </div>,
    document.body,
  );
}
