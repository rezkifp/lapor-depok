import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Alert, Select } from "../../components/form";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/format";

const ROLE_OPTIONS = [
  { value: "", label: "Semua peran" },
  { value: "warga", label: "Warga" },
  { value: "admin_verifikator", label: "Admin Verifikator" },
  { value: "petugas_dinas", label: "Petugas Dinas" },
  { value: "super_admin", label: "Super Admin" },
];

const PAGE_SIZE = 10;

function pageList(page, totalPages) {
  const values = new Set([1, totalPages, page - 1, page, page + 1].filter((item) => item >= 1 && item <= totalPages));
  const sorted = [...values].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((item, index) => {
    if (index > 0 && item - sorted[index - 1] > 1) result.push("gap");
    result.push(item);
  });
  return result;
}

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const roleParam = searchParams.get("role") ?? "";
  const qParam = searchParams.get("q") ?? "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [searchText, setSearchText] = useState(qParam);

  useEffect(() => {
    setSearchText(qParam);
  }, [qParam]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (roleParam) query.set("role", roleParam);
    if (qParam) query.set("q", qParam);

    api
      .get(`/admin/users?${query.toString()}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        const nextPage = Number(result.total_pages) || 1;
        if (page > nextPage) {
          const next = new URLSearchParams(searchParams);
          if (nextPage <= 1) next.delete("page");
          else next.set("page", String(nextPage));
          setSearchParams(next, { replace: true });
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, roleParam, qParam, reloadKey, searchParams, setSearchParams]);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const goToPage = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    setSearchParams(params, { replace: true });
  };

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const handleSearch = () => {
    const next = new URLSearchParams(searchParams);
    if (searchText.trim()) next.set("q", searchText.trim());
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const filtered = Boolean(roleParam || qParam);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Panel Admin</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Pengguna</h1>
          <p className="mt-1 text-sm text-muted">
            Daftar akun warga dan petugas yang terdaftar. Halaman ini read-only untuk keamanan data.
          </p>
        </div>
      </div>

      <div className="card mt-6 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div>
            <label htmlFor="users-search" className="sr-only">
              Cari nama atau email
            </label>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                id="users-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="Cari nama atau email"
                className="field-input pl-10"
              />
            </div>
          </div>
          <div>
            <label htmlFor="users-role" className="sr-only">
              Peran
            </label>
            <Select id="users-role" value={roleParam} onChange={(event) => updateFilter("role", event.target.value)}>
              {ROLE_OPTIONS.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" className="btn-outline px-4" onClick={handleSearch}>
            Cari
          </button>
          {filtered ? (
            <button
              type="button"
              className="text-sm font-semibold text-blue hover:text-navy"
              onClick={() => {
                setSearchText("");
                updateFilter("q", "");
                updateFilter("role", "");
              }}
            >
              Reset filter
            </button>
          ) : null}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Nama</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Peran</th>
                <th className="px-3 py-3">Instansi</th>
                <th className="px-3 py-3">Kecamatan</th>
                <th className="px-3 py-3">Kelurahan</th>
                <th className="px-3 py-3">Laporan</th>
                <th className="px-3 py-3">NIK</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-muted">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-status-ditolak-fg">{error}</p>
                    <button type="button" className="btn-outline mt-4" onClick={() => setReloadKey((current) => current + 1)}>
                      Coba lagi
                    </button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-muted">
                    Tidak ada pengguna yang cocok.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                    <td className="px-5 py-3 font-semibold text-ink">{item.name}</td>
                    <td className="px-3 py-3 text-muted">{item.email}</td>
                    <td className="px-3 py-3">
                      <span className="text-ink">{item.role.replace("admin_verifikator", "Admin Verifikator").replace("petugas_dinas", "Petugas Dinas").replace("super_admin", "Super Admin").replace("warga", "Warga")}</span>
                    </td>
                    <td className="px-3 py-3 text-muted">{item.agency?.name ?? "-"}</td>
                    <td className="px-3 py-3 text-muted">{item.kecamatan?.name ?? "-"}</td>
                    <td className="px-3 py-3 text-muted">{item.kelurahan?.name ?? "-"}</td>
                    <td className="px-3 py-3 text-muted">{formatNumber(item.reports_count)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">{item.nik_last4 ?? "-"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          item.email_verified
                            ? "font-semibold text-status-selesai-fg"
                            : "font-semibold text-status-ditolak-fg"
                        }
                      >
                        {item.email_verified ? "Terverifikasi" : "Belum terverifikasi"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && data && !error && total > 0 ? (
        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Navigasi halaman pengguna admin">
          <p className="text-sm text-muted">
            Menampilkan {formatNumber(start)}–{formatNumber(end)} dari {formatNumber(total)}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" className="btn-outline px-4" onClick={() => goToPage(page - 1)} disabled={page <= 1 || loading}>
              Sebelumnya
            </button>
            {pageList(page, totalPages).map((item, index) =>
              item === "gap" ? (
                <span key={`gap-${index}`} className="px-1 text-muted" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  aria-current={item === page ? "page" : undefined}
                  onClick={() => goToPage(item)}
                  className={`inline-flex h-11 min-w-11 items-center justify-center rounded-btn px-2 text-sm font-semibold transition ${
                    item === page ? "bg-navy text-white" : "border border-line bg-white text-muted hover:border-blue hover:text-blue"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
            <button type="button" className="btn-outline px-4" onClick={() => goToPage(page + 1)} disabled={page >= totalPages || loading}>
              Berikutnya
            </button>
          </div>
        </nav>
      ) : null}

    </div>
  );
}
