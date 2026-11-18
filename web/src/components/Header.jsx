import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { initials, ROLE_LABELS } from "../lib/format";
import Logo from "./Logo";

const NAV_ITEMS = [
  { to: "/", label: "Beranda", end: true },
  { to: "/cara-melapor", label: "Cara Melapor" },
  { to: "/laporan-publik", label: "Laporan Publik" },
  { to: "/#statistik", label: "Statistik", anchor: true },
  { to: "/faq", label: "FAQ" },
];

function navClass({ isActive }) {
  return `rounded-btn px-3 py-2 text-sm transition ${
    isActive ? "font-semibold text-blue" : "text-ink/80 hover:bg-surface hover:text-navy"
  }`;
}

export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <>
      <div className="bg-footer text-white/65">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-1.5 text-[11px] sm:px-6">
          <p className="hidden sm:block">Situs resmi layanan pengaduan masyarakat Kota Depok</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Call Center 112</span>
            <span className="hidden md:inline">lapor@depok.example.go.id</span>
            <span className="hidden lg:inline">Senin–Jumat 08.00–16.00 WIB</span>
          </p>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Lapor Depok" onClick={() => setMobileOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) =>
            item.anchor ? (
              <a
                key={item.to}
                href={item.to}
                className="rounded-btn px-3 py-2 text-sm text-ink/80 transition hover:bg-surface hover:text-navy"
              >
                {item.label}
              </a>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {loading ? (
            <span className="h-11 w-28 animate-pulse rounded-btn bg-surface" aria-label="Memuat akun" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex min-h-control items-center gap-2 rounded-btn border border-line bg-white py-1.5 pl-1.5 pr-3 text-sm font-semibold text-navy transition hover:bg-surface"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  {initials(user.name)}
                </span>
                <span className="max-w-36 truncate">{user.name}</span>
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" aria-hidden="true">
                  <path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>

              {menuOpen ? (
                <div
                  className="absolute right-0 mt-2 w-64 overflow-hidden rounded-card border border-line bg-white shadow-lg"
                  role="menu"
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-blue">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </p>
                  </div>
                  <div className="p-1.5">
                    {user.role === "warga" ? (
                      <>
                        <Link
                          to="/laporan-saya"
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-btn px-3 py-2.5 text-sm text-ink hover:bg-surface"
                        >
                          Laporan Saya
                        </Link>
                        <Link
                          to="/profil"
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-btn px-3 py-2.5 text-sm text-ink hover:bg-surface"
                        >
                          Profil
                        </Link>
                      </>
                    ) : (
                      <Link
                        to="/admin"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-btn px-3 py-2.5 text-sm text-ink hover:bg-surface"
                      >
                        Panel Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full rounded-btn px-3 py-2.5 text-left text-sm text-status-ditolak-fg hover:bg-status-ditolak-bg"
                    >
                      Keluar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Link to="/masuk" className="btn-outline px-5">
              Masuk
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-btn border border-line text-navy lg:hidden"
          aria-expanded={mobileOpen}
          aria-label="Menu navigasi"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-line bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Navigasi seluler">
            {NAV_ITEMS.map((item) =>
              item.anchor ? (
                <a
                  key={item.to}
                  href={item.to}
                  className="rounded-btn px-3 py-2 text-sm text-ink/80 hover:bg-surface"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navClass}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="mt-4 border-t border-line pt-4">
            {user ? (
              <>
                <p className="px-3 text-sm font-semibold text-ink">{user.name}</p>
                <p className="px-3 text-xs text-muted">{user.email}</p>
                <div className="mt-2 flex flex-col gap-1">
                  {user.role === "warga" ? (
                    <>
                      <Link
                        to="/laporan-saya"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-btn px-3 py-2.5 text-sm text-ink hover:bg-surface"
                      >
                        Laporan Saya
                      </Link>
                      <Link
                        to="/profil"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-btn px-3 py-2.5 text-sm text-ink hover:bg-surface"
                      >
                        Profil
                      </Link>
                    </>
                  ) : (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-btn px-3 py-2.5 text-sm text-ink hover:bg-surface"
                    >
                      Panel Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-btn px-3 py-2.5 text-left text-sm text-status-ditolak-fg hover:bg-status-ditolak-bg"
                  >
                    Keluar
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/masuk"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full"
              >
                Masuk
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
    </>
  );
}
