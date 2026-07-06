import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  User,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Page from "../components/Page";

/**
 * Ask Sarvik — a grounded chat screen. The MP types a question about the
 * constituency and Sarvik answers using ONLY the real BigQuery-backed data
 * (via POST /api/ask). Chat-UI style mirrors the Datathon "Ask Sarvik"
 * investigator surface, reimplemented in the Sabha (light) theme.
 */

interface ChatMessage {
  id: string;
  role: "user" | "sarvik";
  content: string;
}

const SUGGESTIONS = [
  "Which department owes the most?",
  "Top forgotten villages?",
  "Which projects fit my ₹5 crore?",
  "How many duplicate complaints were merged?",
];

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Redirect layer: turn Sarvik's grounded answer into navigable actions ── */

interface NavChip {
  label: string;
  to: string;
}

/**
 * Choose "quick-nav" chips by keyword-matching the answer. Departments and the
 * Constituency X-Ray are always offered; the rest surface when relevant.
 */
function quickNavChips(content: string): NavChip[] {
  const t = content.toLowerCase();
  const chips: NavChip[] = [];
  const push = (label: string, to: string) => {
    if (!chips.some((c) => c.to === to)) chips.push({ label, to });
  };

  push("View Departments", "/departments"); // always
  if (/silent|forgotten|under[-\s]?petition|0\s+petition|zero\s+petition/.test(t)) {
    push("Forgotten Villages", "/forgotten");
  }
  push("Constituency X-Ray", "/x-ray"); // always
  if (/priorit|ranked|\bscore/.test(t)) push("Priorities", "/priorities");
  if (/letter|mplads|₹\s?5\s*crore|5\s*crore|track\s+[ab]\b|\bact\b/.test(t)) {
    push("Act", "/act");
  }
  return chips;
}

/** Department names + central-scheme codes we linkify inside the answer. */
const NAV_TERMS = [
  "Housing & Urban Affairs",
  "Health & Family Welfare",
  "Drinking Water & Sanitation",
  "Rural Development",
  "Social Welfare",
  "School Education",
  "Jal Shakti",
  "Jal Jeevan",
  "PMAY-G",
  "PMAY-U",
  "PM-JAY",
  "MGNREGA",
  "MPLADS",
  "PMGSY",
  "PMEGP",
  "PMAY",
  "NHM",
  "JJM",
  "SBM",
  "NSAP",
];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest-first so "PMAY-G" wins over "PMAY". Not preceded by "[" so we never
// re-wrap an existing markdown link.
const NAV_RE = new RegExp(
  "(?<!\\[)(" +
    [...NAV_TERMS]
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join("|") +
    ")",
  "g",
);

/** Wrap known department / scheme mentions as internal nav links. */
function linkifyDepartments(md: string): string {
  return md.replace(NAV_RE, (m) => `[${m}](sarvik-nav:/departments)`);
}

export default function AskSarvik() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages, loading]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { id: uid(), role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) throw new Error(`Ask failed (${res.status})`);
      const data = (await res.json()) as { answer?: string };
      const answer = (data.answer ?? "").trim() || "No answer was returned.";
      setMessages((prev) => [...prev, { id: uid(), role: "sarvik", content: answer }]);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't reach Sarvik — ${e.message}`
          : "Couldn't reach Sarvik.",
      );
    } finally {
      setLoading(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <Page
      title="Ask Sarvik"
      subtitle="Ask anything about your constituency — every answer is grounded in your real Coimbatore data."
      actions={
        <span className="count-badge">
          <Sparkles size={13} style={{ marginRight: 4 }} /> Grounded in data
        </span>
      }
    >
      <style>{`
        @keyframes ask-spin { to { transform: rotate(360deg); } }
        .ask-spin { animation: ask-spin 0.8s linear infinite; }
        @keyframes ask-blink { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
        .sarvik-md > :first-child { margin-top: 0; }
        .sarvik-md > :last-child { margin-bottom: 0; }
        .sarvik-md p { margin: 0 0 8px; }
        .sarvik-md strong { font-weight: 600; color: hsl(var(--foreground)); }
        .sarvik-md ul, .sarvik-md ol { margin: 6px 0; padding-left: 20px; }
        .sarvik-md li { margin: 2px 0; }
        .sarvik-md li::marker { color: hsl(var(--muted-foreground)); }
        .sarvik-md h1, .sarvik-md h2, .sarvik-md h3,
        .sarvik-md h4, .sarvik-md h5, .sarvik-md h6 {
          font-size: 15px; font-weight: 600; margin: 10px 0 4px;
          color: hsl(var(--foreground));
        }
        .sarvik-md a { color: hsl(var(--primary)); text-decoration: underline; }
        .sarvik-md code {
          font-size: 0.9em; padding: 1px 5px; border-radius: 4px;
          background: hsl(var(--secondary)); font-family: var(--font-mono, monospace);
        }
        .sarvik-md pre {
          margin: 8px 0; padding: 10px 12px; border-radius: 8px;
          background: hsl(var(--secondary)); overflow-x: auto;
        }
        .sarvik-md pre code { padding: 0; background: transparent; }
        .sarvik-md blockquote {
          margin: 8px 0; padding-left: 12px;
          border-left: 3px solid hsl(var(--border)); color: hsl(var(--muted-foreground));
        }
        .sarvik-md table { border-collapse: collapse; margin: 8px 0; font-size: 14px; }
        .sarvik-md th, .sarvik-md td {
          border: 1px solid hsl(var(--border)); padding: 4px 8px; text-align: left;
        }
        .sarvik-inline-link {
          appearance: none; border: none; background: none; padding: 0;
          font: inherit; color: hsl(var(--primary)); font-weight: 600;
          cursor: pointer; text-decoration: underline;
          text-underline-offset: 2px; text-decoration-thickness: 1px;
        }
        .sarvik-inline-link:hover { color: hsl(var(--primary) / 0.8); }
        .sarvik-nav-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 9999px;
          border: 1px solid hsl(var(--border)); background: hsl(var(--card));
          color: hsl(var(--foreground)); font-size: 12.5px; font-weight: 600;
          cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease;
        }
        .sarvik-nav-chip:hover {
          background: hsl(var(--accent)); color: hsl(var(--accent-foreground));
          border-color: hsl(var(--accent));
        }
      `}</style>
      <div
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 220px)",
          minHeight: 420,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* ── Scrollable message list ── */}
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation with Sarvik"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px" }}
        >
          {empty ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 8,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: "9999px",
                  background: "hsl(var(--accent))",
                  color: "hsl(var(--accent-foreground))",
                  marginBottom: 6,
                }}
              >
                <Sparkles size={26} />
              </span>
              <h2
                className="section-title"
                style={{ fontFamily: "var(--font-display)", fontSize: 22 }}
              >
                Namaskaram, Hon'ble Member.
              </h2>
              <p className="muted" style={{ maxWidth: 440 }}>
                Ask about departments, ₹ owed, forgotten villages, or which projects
                fit your budget. I answer only from your constituency's real data.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {messages.map((m) => (
                <Bubble key={m.id} message={m} />
              ))}
              {loading && <TypingBubble />}
            </div>
          )}
        </div>

        {/* ── Suggested-question chips ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: "0 24px 12px",
          }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={loading}
              className="chip"
              style={{
                cursor: loading ? "not-allowed" : "pointer",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--secondary))",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Sparkles size={12} style={{ marginRight: 5, opacity: 0.7 }} />
              {s}
            </button>
          ))}
        </div>

        {/* ── Error state ── */}
        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "0 24px 12px",
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              background: "hsl(var(--destructive) / 0.08)",
              color: "hsl(var(--destructive))",
              fontSize: 13,
            }}
          >
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Input + send ── */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          style={{
            display: "flex",
            gap: 10,
            padding: "14px 24px",
            borderTop: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Sarvik about your constituency…"
            aria-label="Ask a question"
            autoFocus
            style={{
              flex: 1,
              padding: "11px 14px",
              borderRadius: "var(--radius)",
              border: "1px solid hsl(var(--input))",
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              fontSize: 15,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0 18px",
              borderRadius: "var(--radius)",
              border: "none",
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              opacity: loading || !input.trim() ? 0.55 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={16} className="ask-spin" />
            ) : (
              <Send size={16} />
            )}
            Send
          </button>
        </form>
      </div>
    </Page>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const navigate = useNavigate();
  const chips = isUser ? [] : quickNavChips(message.content);
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: "9999px",
          background: isUser ? "hsl(var(--secondary))" : "hsl(var(--accent))",
          color: isUser
            ? "hsl(var(--secondary-foreground))"
            : "hsl(var(--accent-foreground))",
        }}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
          maxWidth: "78%",
          minWidth: 0,
        }}
      >
        <div
          className={isUser ? undefined : "sarvik-md"}
          style={{
            maxWidth: "100%",
            padding: "11px 15px",
            borderRadius: 16,
            fontSize: 15,
            lineHeight: 1.55,
            whiteSpace: isUser ? "pre-wrap" : "normal",
            overflowWrap: "anywhere",
            background: isUser ? "hsl(var(--primary))" : "hsl(var(--muted))",
            color: isUser
              ? "hsl(var(--primary-foreground))"
              : "hsl(var(--foreground))",
            borderTopRightRadius: isUser ? 4 : 16,
            borderTopLeftRadius: isUser ? 16 : 4,
          }}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a({ href, children, ...props }) {
                  if (href && href.startsWith("sarvik-nav:")) {
                    const to = href.slice("sarvik-nav:".length);
                    return (
                      <button
                        type="button"
                        className="sarvik-inline-link"
                        onClick={() => navigate(to)}
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer" {...props}>
                      {children}
                    </a>
                  );
                },
              }}
            >
              {linkifyDepartments(message.content)}
            </ReactMarkdown>
          )}
        </div>

        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
            }}
          >
            {chips.map((c) => (
              <button
                key={c.to}
                type="button"
                className="sarvik-nav-chip"
                onClick={() => navigate(c.to)}
              >
                {c.label}
                <ArrowRight size={13} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: "9999px",
          background: "hsl(var(--accent))",
          color: "hsl(var(--accent-foreground))",
        }}
      >
        <Sparkles size={16} />
      </span>
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 16,
          borderTopLeftRadius: 4,
          background: "hsl(var(--muted))",
          color: "hsl(var(--muted-foreground))",
          fontSize: 14,
        }}
      >
        Sarvik is thinking
        <span
          aria-hidden="true"
          style={{
            marginLeft: 6,
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "9999px",
            background: "currentColor",
            animation: "ask-blink 1s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
