import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import Footer from "../components/Footer";
import Logo from "../components/Logo";
import { useAuth } from "../lib/auth";
import { initials, ROLE_LABELS } from "../lib/format";

const ALL_ROLES = ["admin_verifikator", "petugas_dinas", "super_admin"];

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: "dashboard", roles: ALL_ROLES, end: true },
  { to: "/admin/laporan", label: "Laporan", icon: "reports", roles: ALL_ROLES },
  { to: "/admin/master", label: "Master Data", icon: "master", roles: ["admin_verifikator", "super_admin"] },
  { to: "/admin/pengguna", label: "Pengguna", icon: "users", roles: ["super_admin"] },
  { to: "/admin/log", label: "Log Aktivitas", icon: "log", roles: ["super_admin"] },
  { to: "/admin/ekspor", label: "Ekspor", icon: "export", roles: ["admin_verifikator", "super_admin"] },
];

function Icon({ name, className = "h-5 w-5" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" {...common} />
        <rect x="14" y="3" width="7" height="7" rx="1.5" {...common} />
        <rect x="3" y="14" width="7" height="7" rx="1.5" {...common} />
        <rect x="14" y="14" width="7" height="7" rx="1.5" {...common} />
      </svg>
    );
  }
  if (name === "reports") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M9 4h6v3H9z" {...common} />
        <path d="M8 5H6v15h12V5h-2M9 12h6M9 16h4" {...common} />
      </svg>
    );
  }
  if (name === "master") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" {...common} />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" {...common} />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" {...common} />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="9" cy="8" r="3" {...common} />
        <path d="M3.5 20c.6-3.4 2.8-5 5.5-5s4.9 1.6 5.5 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2 .5 3.2 2.1 3.5 5" {...common} />
      </svg>
    );
  }
  if (name === "log") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" {...common} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4 19h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    onNavigate?.();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link to="/admin" onClick={onNavigate} aria-label="Panel Admin Lapor Depok">
          <Logo tone="light" compact />
        </Link>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          Panel Admin
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Navigasi admin">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-gold font-bold text-navy"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-white/55">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
        </div>
        <p className="mt-2 truncate text-xs text-white/50">{user.email}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 min-h-control w-full rounded-btn border border-white/20 px-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 bg-navy lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:block">
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
          <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-btn border border-line text-navy lg:hidden"
                aria-label="Buka menu admin"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <p className="text-sm font-semibold text-navy">Panel Admin</p>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/" className="hidden text-sm text-muted transition hover:text-navy sm:block">
                Lihat situs
              </Link>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {initials(user?.name ?? "")}
              </span>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-navy/50"
            aria-label="Tutup menu admin"
          />
          <div className="relative h-full w-72 max-w-[85%] bg-navy shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-btn text-white/80 hover:bg-white/10"
              aria-label="Tutup menu"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}