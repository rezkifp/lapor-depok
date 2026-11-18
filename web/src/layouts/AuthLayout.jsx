import { Link } from "react-router-dom";
import Logo from "../components/Logo";

export default function AuthLayout({ eyebrow, title, description, wide = false, centered = true, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="relative flex flex-col justify-center overflow-hidden bg-navy px-6 py-9 text-white sm:px-10 lg:fixed lg:inset-y-0 lg:left-0 lg:w-[46%] lg:px-14">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue/30 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <Logo tone="light" />
            <p className="mt-9 text-xs font-bold uppercase tracking-[0.18em] text-gold">
              {eyebrow}
            </p>
            <h1 className="mt-3 max-w-lg text-3xl font-extrabold leading-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
              {description}
            </p>
          </div>
        </aside>

        <section className="flex flex-1 flex-col lg:ml-[46%] lg:h-screen lg:overflow-y-auto">
          <div className="px-4 pt-4 sm:px-8 sm:pt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-navy"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Kembali ke beranda
            </Link>
          </div>
          <div
            className={`flex flex-1 justify-center ${
              centered
                ? "items-center px-4 pt-16 pb-12 sm:px-8 sm:pt-20 sm:pb-16"
                : "items-start px-4 pt-6 pb-8 sm:px-8 sm:pt-10 sm:pb-12"
            }`}
          >
            <div
              className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-card border border-line bg-white p-5 shadow-sm sm:p-8`}
            >
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
