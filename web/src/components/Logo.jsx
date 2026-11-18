export default function Logo({ tone = "default", compact = false }) {
  const light = tone === "light";

  return (
    <span className="inline-flex items-center gap-3">
      <svg
        viewBox="0 0 48 48"
        className={compact ? "h-9 w-9" : "h-11 w-11"}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M24 2.5 45 10v13.5c0 11.6-8.9 20.7-21 24.2C11.9 44.2 3 35.1 3 23.5V10L24 2.5Z"
          fill="var(--color-blue)"
        />
        <path
          d="m24 11 3.7 7.5 8.3.9-6.2 5.7 1.6 8.2-7.4-4-7.4 4 1.6-8.2-6.2-5.7 8.3-.9L24 11Z"
          fill="var(--color-gold)"
        />
      </svg>
      <span className="leading-tight">
        <span
          className={`block text-[10px] font-semibold uppercase tracking-[0.16em] ${
            light ? "text-gold" : "text-muted"
          }`}
        >
          Pemerintah Kota Depok
        </span>
        <span className={`block text-lg font-extrabold ${light ? "text-white" : "text-navy"}`}>
          Lapor Depok
        </span>
      </span>
    </span>
  );
}
