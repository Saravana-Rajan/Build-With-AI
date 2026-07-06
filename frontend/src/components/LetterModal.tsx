import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface LetterModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Lightweight, theme-aware modal for previewing a generated letter.
 * Self-contained (inline styles on the Sabha palette) so it needs no global CSS.
 */
export default function LetterModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: LetterModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "hsl(213 43% 16% / 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "0.9rem",
          boxShadow: "0 24px 60px hsl(213 43% 16% / 0.35)",
          width: "min(720px, 100%)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 19,
                color: "hsl(var(--foreground))",
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn--sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 20, overflow: "auto" }}>{children}</div>

        {footer && (
          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              padding: "14px 20px",
              borderTop: "1px solid hsl(var(--border))",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Monospace-ish letter body preview with preserved whitespace. */
export function LetterBody({ text }: { text: string }) {
  return (
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        lineHeight: 1.6,
        color: "hsl(var(--foreground))",
        background: "hsl(40 33% 98%)",
        border: "1px solid hsl(var(--border))",
        borderRadius: "0.6rem",
        padding: "16px 18px",
      }}
    >
      {text}
    </pre>
  );
}
