import { useId, useState } from "react";

export function Field({ label, htmlFor, required = false, error, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {required ? (
          <span className="ml-1 text-status-ditolak-fg" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-status-ditolak-fg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputClass(error, extra = "") {
  return `field-input ${error ? "border-status-ditolak-fg" : ""} ${extra}`.trim();
}

export function TextInput({ error, className = "", ...props }) {
  return <input className={inputClass(error, className)} {...props} />;
}

export function TextArea({ error, className = "", rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={inputClass(error, `py-3 ${className}`)}
      {...props}
    />
  );
}

export function Select({ error, className = "", children, ...props }) {
  return (
    <select className={inputClass(error, `pr-9 ${className}`)} {...props}>
      {children}
    </select>
  );
}

export function PasswordInput({ error, className = "", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={inputClass(error, `pr-20 ${className}`)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-1 top-1/2 min-h-9 -translate-y-1/2 rounded-btn px-3 text-xs font-semibold text-blue hover:bg-surface"
        aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      >
        {visible ? "Sembunyi" : "Lihat"}
      </button>
    </div>
  );
}

export function Alert({ tone = "error", children }) {
  const tones = {
    error: "border-status-ditolak-fg/25 bg-status-ditolak-bg text-status-ditolak-fg",
    success: "border-status-selesai-fg/25 bg-status-selesai-bg text-status-selesai-fg",
    info: "border-status-diverifikasi-fg/20 bg-status-diverifikasi-bg text-status-diverifikasi-fg",
  };
  return (
    <div className={`rounded-btn border px-4 py-3 text-sm ${tones[tone]}`} role="status">
      {children}
    </div>
  );
}

export function Button({ type = "submit", variant = "primary", className = "", disabled, ...props }) {
  const styles =
    variant === "outline"
      ? "btn-outline"
      : "btn-primary";
  return (
    <button
      type={type}
      className={`${styles} min-h-control inline-flex items-center justify-center gap-2 rounded-btn px-5 text-sm font-bold ${className}`}
      disabled={disabled}
      {...props}
    >
      {props.children}
    </button>
  );
}

export function PasswordStrength({ password }) {
  const id = useId();
  if (!password) return null;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  score = Math.min(score, 4);

  const level =
    score <= 1
      ? { label: "Lemah", color: "bg-status-ditolak-fg" }
      : score === 2
        ? { label: "Sedang", color: "bg-status-diproses-fg" }
        : { label: "Kuat", color: "bg-status-selesai-fg" };

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" id={id}>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < score ? level.color : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">
        Kekuatan kata sandi: <span className="font-semibold text-ink">{level.label}</span>
      </p>
    </div>
  );
}
