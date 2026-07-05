interface StateBlockProps {
  variant?: "loading" | "empty" | "error";
  title: string;
  detail?: string;
}

/** Neutral placeholder for loading / empty / error states. */
export default function StateBlock({
  variant = "loading",
  title,
  detail,
}: StateBlockProps) {
  return (
    <div className={`state-block state-block--${variant}`} role="status">
      <span className="state-block__title">{title}</span>
      {detail && <span className="state-block__detail">{detail}</span>}
    </div>
  );
}
