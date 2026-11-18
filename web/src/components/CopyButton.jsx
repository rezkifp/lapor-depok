import { useState } from "react";

export default function CopyButton({ value, label = "Salin Tiket", className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* abaikan jika clipboard diblokir */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`inline-flex min-h-control items-center gap-1.5 rounded-btn border border-line bg-white px-3 text-xs font-semibold text-navy transition hover:border-blue hover:text-blue ${className}`}
      aria-label={`Salin ${value}`}
    >
      {copied ? (
        <>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-status-selesai-fg" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-status-selesai-fg">Tersalin</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="7" y="7" width="9" height="9" rx="1.5" />
            <path d="M5 13H4.5A1.5 1.5 0 0 1 3 11.5v-7A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5V5" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
