const PATHS = {
  infrastruktur: (
    <>
      <path d="M4 20 8.5 4M20 20 15.5 4" />
      <path d="M12 5v3M12 12v3M12 19v1" />
    </>
  ),
  kebersihan: (
    <>
      <path d="M5 7h14M10 7V5h4v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  administrasi: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  keamanan: (
    <>
      <path d="M12 3 20 6v6c0 4.2-3.4 7.6-8 9-4.6-1.4-8-4.8-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  kesehatan: (
    <>
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  transportasi: (
    <>
      <rect x="5" y="4" width="14" height="13" rx="2" />
      <path d="M5 10h14M8 20v-3M16 20v-3" />
      <circle cx="8.5" cy="14" r="1" />
      <circle cx="15.5" cy="14" r="1" />
    </>
  ),
  default: <path d="M4 6h7v7H4zM13 6h7v7h-7zM4 15h7v5H4zM13 15h7v5h-7z" />,
};

function keyFor(name = "") {
  const value = name.toLowerCase();
  if (value.includes("infrastruktur") || value.includes("jalan")) return "infrastruktur";
  if (value.includes("kebersihan") || value.includes("lingkungan")) return "kebersihan";
  if (value.includes("administrasi") || value.includes("pelayanan")) return "administrasi";
  if (value.includes("keamanan") || value.includes("ketertiban")) return "keamanan";
  if (value.includes("kesehatan")) return "kesehatan";
  if (value.includes("transportasi") || value.includes("lalu lintas")) return "transportasi";
  return "default";
}

export default function CategoryIcon({ name, className = "" }) {
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-btn border border-line bg-white text-blue ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {PATHS[keyFor(name)]}
      </svg>
    </span>
  );
}
