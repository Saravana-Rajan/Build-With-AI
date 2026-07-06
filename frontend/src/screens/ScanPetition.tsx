import { useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import StateBlock from "../components/StateBlock";
import { submitIntake, ApiError } from "../api";
import type { IntakeResponse } from "../api";

const LANGUAGES = [
  { value: "ta", label: "Tamil" },
  { value: "en", label: "English" },
];

const ACCEPT = "image/*,application/pdf,audio/*";

type Status =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "done"; result: IntakeResponse }
  | { kind: "error"; message: string };

export default function ScanPetition() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("ta");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(next: File | null) {
    setFile(next);
    setStatus({ kind: "idle" });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  }

  async function onSubmit() {
    if (!file) return;
    setStatus({ kind: "reading" });
    try {
      const result = await submitIntake(file, language, "paper");
      setStatus({ kind: "done", result });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong reading the petition.";
      setStatus({ kind: "error", message });
    }
  }

  function reset() {
    setFile(null);
    setStatus({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = status.kind === "reading";

  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Photograph a paper letter, or upload a PDF or voice note. The AI reads it and
        files a structured record — the way the front desk should work.
      </p>
      <div className="scan-grid">
        <section className="card scan-uploader" aria-label="Upload petition">
          <div
            className={
              dragging
                ? "dropzone dropzone--active"
                : file
                  ? "dropzone dropzone--filled"
                  : "dropzone"
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <strong className="dropzone__name">{file.name}</strong>
                <span className="muted">
                  {(file.size / 1024).toFixed(0)} KB · click to replace
                </span>
              </>
            ) : (
              <>
                <strong>Drop a file here</strong>
                <span className="muted">
                  or click to browse — photo, PDF, or voice note
                </span>
              </>
            )}
          </div>

          <div className="scan-controls">
            <label className="scan-field">
              <span className="scan-field__label">Language</span>
              <select
                className="scan-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={busy}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="scan-actions">
              {file && (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={reset}
                  disabled={busy}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={onSubmit}
                disabled={!file || busy}
              >
                {busy ? "Reading…" : "Submit petition"}
              </button>
            </div>
          </div>
        </section>

        <section className="scan-result" aria-live="polite">
          {status.kind === "idle" && (
            <StateBlock
              variant="empty"
              title="No petition read yet"
              detail="Upload a file and submit to see the AI-extracted record."
            />
          )}

          {status.kind === "reading" && (
            <StateBlock
              variant="loading"
              title="AI is reading the petition…"
              detail="Extracting the demand, resolving the location, and matching a scheme."
            />
          )}

          {status.kind === "error" && (
            <StateBlock
              variant="error"
              title="Could not read the petition"
              detail={status.message}
            />
          )}

          {status.kind === "done" && <Result result={status.result} />}
        </section>
      </div>
    </div>
  );
}

function Result({ result }: { result: IntakeResponse }) {
  const { ack, reference, record } = result;
  const transcript = record.translated_text || record.raw_text;

  return (
    <div className="scan-result__stack">
      <div className="ack-card">
        <span className="badge badge--live">Received</span>
        <p className="ack-card__text">{ack}</p>
        <span className="muted">Reference {reference}</span>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 className="section-title">Extracted record</h2>
          {record.track && (
            <span className={`chip chip--track-${record.track}`}>
              Track {record.track}
            </span>
          )}
        </div>

        <dl className="record-grid">
          <Field label="Category">
            <span className="chip chip--muted">{record.category}</span>
          </Field>
          <Field label="Urgency">
            <span className={`chip chip--${record.urgency}`}>
              {record.urgency}
            </span>
          </Field>
          <Field label="Place">
            {record.place_name || "—"}
            {record.area_id ? ` · ${record.area_id}` : ""}
            {" · "}
            {record.urban ? "urban" : "rural"}
          </Field>
          <Field label="Beneficiaries">
            {record.beneficiary_estimate != null
              ? record.beneficiary_estimate.toLocaleString("en-IN")
              : "—"}
          </Field>
          <Field label="Matched scheme">
            {record.matched_scheme || "None → MPLADS"}
          </Field>
          <Field label="Need">{record.need_detail || "—"}</Field>
        </dl>
      </div>

      {transcript && (
        <div className="card">
          <div className="card__head">
            <h2 className="section-title">What the AI read</h2>
          </div>
          <p className="scan-transcript">{transcript}</p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="record-grid__field">
      <dt className="record-grid__label">{label}</dt>
      <dd className="record-grid__value">{children}</dd>
    </div>
  );
}
