import * as React from "react";
import { Info } from "lucide-react";
import { lookupTerm } from "../lib/glossary";
import { cn } from "../lib/utils";

/**
 * Tiny ⓘ affordance that reveals a plain-language definition of a jargon term.
 * Opens on hover, on tap/click (toggle — for touch), and on keyboard focus.
 * Dismisses on blur, Escape, or outside pointer-down.
 *
 * Pass `term` to pull the definition from GLOSSARY, or `text` for a custom one.
 * Accessible: the trigger is a real <button> labelled for screen readers and
 * the popover is role="tooltip" wired via aria-describedby.
 */
let uid = 0;

export default function InfoTip({
  term,
  text,
  className,
  label,
}: {
  term?: string;
  text?: string;
  className?: string;
  /** Optional aria-label override; defaults to "What is <term>?". */
  label?: string;
}) {
  const definition = text ?? (term ? lookupTerm(term) : undefined);
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const idRef = React.useRef<string>(`infotip-${++uid}`);

  // Close on outside pointer-down or Escape while open.
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nothing to explain — render nothing rather than a dead icon.
  if (!definition) return null;

  const aria = label ?? (term ? `What is ${term}?` : "More information");

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={aria}
        aria-expanded={open}
        aria-describedby={open ? idRef.current : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      >
        <Info className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
      </button>

      {open && (
        <span
          id={idRef.current}
          role="tooltip"
          className="absolute bottom-[calc(100%+6px)] left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-left text-[11.5px] font-normal normal-case leading-snug tracking-normal text-popover-foreground shadow-lg"
        >
          {term && (
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-primary">
              {term}
            </span>
          )}
          {definition}
        </span>
      )}
    </span>
  );
}
