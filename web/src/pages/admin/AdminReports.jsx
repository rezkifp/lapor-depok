import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import StatusChip from "../../components/StatusChip";
import { api } from "../../lib/api";
import { formatNumber, formatShortDate } from "../../lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "diterima", label: "Diterima" },
  { value: "diverifikasi", label: "Diverifikasi" },
  { value: "diproses", label: "Diproses" },
  { value: "selesai", label: "Selesai" },
  { value: "ditolak", label: "Ditolak" },
];

const RANGE_OPTIONS = [
  { value: "7", label: "7 hari terakhir" },
  { value: "30", label: "30 hari terakhir" },
  { value: "90", label: "90 hari terakhir" },
  { value: "all", label: "Semua tanggal" },
];

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromRange(range) {
  if (range === "all") return "";
  const days = Number(range);
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return isoDate(date);
}

function pageList(page, totalPages) {
  const values = new Set(
    [1, totalPages, page - 1, page, page + 1].filter((item) => item >= 1 && item <= totalPages),
  );
  const sorted = [...values].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((item, index) => {
    if (index > 0 && item - sorted[index - 1] > 1) result.push("gap");
    result.push(item);
  });
  return result;
}

export default function AdminReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();

  const rawStatus = searchParams.get("status") ?? "";
  const statusParam = STATUS_OPTIONS.some((item) => item.value === rawStatus) ? rawStatus : "";
  const categoryParam = Number(searchParams.get("category") ?? "0") || 0;
  const districtParam = Number(searchParams.get("district") ?? "0") || 0;
  const slaParam = searchParams.get("sla") === "overdue" ? "overdue" : "";
  const rawRange = searchParams.get("range") ?? "30";
  const rangeParam = RANGE_OPTIONS.some((item) => item.value === rawRange) ? rawRange : "30";
  const qParam = searchParams.get("q") ?? "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [searchText, setSearchText] = useState(qParam);
  const [categories, setCategories] = useState([]);
  const [districts, setDistricts] = useState([]);
  const tableRef = useRef(null);

  useEffect(() => {
    setSearchText(qParam);
  }, [qParam]);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/master/categories"), api.get("/master/districts")])
      .then(([categoryRows, districtRows]) => {
        if (!active) return;
        setCategories(Array.isArray(categoryRows) ? categoryRows : []);
        setDistricts(Array.isArray(districtRows) ? districtRows : []);
      })
      .catch(() => {
        // Dropdown master gagal dimuat: filter lain tetap bisa dipakai.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === qParam) return undefined;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      next.delete("page");
      setSearchParams(next, { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchText, qParam, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (statusParam) query.set("status", statusParam);
    if (categoryParam) query.set("category", String(categoryParam));
    if (districtParam) query.set("district", String(districtParam));
    if (slaParam) query.set("sla", slaParam);
    if (qParam) query.set("q", qParam);
    const from = dateFromRange(rangeParam);
    if (from) query.set("date_from", from);

    api
      .get(`/admin/reports?${query.toString()}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        if (page > result.total_pages) {
          const next = new URLSearchParams(searchParams);
          if (result.total_pages <= 1) next.delete("page");
          else next.set("page", String(result.total_pages));
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
  }, [queryKey, page, statusParam, categoryParam, districtParam, slaParam, rangeParam, qParam, reloadKey, searchParams, setSearchParams]);

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
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * 10 + 1;
  const end = Math.min(page * 10, total);
  const hasFilter =
    Boolean(statusParam || categoryParam || districtParam || qParam || slaParam) ||
    rangeParam !== "30";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Panel Admin</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Laporan Masuk</h1>
          <p className="mt-1 text-sm text-muted">
            {data
              ? `${formatNumber(data.scope_total)} laporan · ${formatNumber(
                  data.awaiting_verification,
                )} menunggu verifikasi`
              : "Memuat ringkasan laporan..."}
            {data?.scope?.restricted && data.scope.agency
              ? ` · ${data.scope.agency.name}`
              : ""}
          </p>
        </div>
      </div>

      <div className="card mt-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.7fr_1fr_1fr_1fr_1fr_1fr]">
          <div>
            <label htmlFor="report-search" className="sr-only">
              Cari tiket atau judul
            </label>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                id="report-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Cari tiket atau judul"
                className="field-input pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="filter-status" className="sr-only">
              Status
            </label>
            <select
              id="filter-status"
              className="field-input pr-9"
              value={statusParam}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-category" className="sr-only">
              Kategori
            </label>
            <select
              id="filter-category"
              className="field-input pr-9"
              value={categoryParam || ""}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="">Semua kategori</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-district" className="sr-only">
              Kecamatan
            </label>
            <select
              id="filter-district"
              className="field-input pr-9"
              value={districtParam || ""}
              onChange={(event) => updateFilter("district", event.target.value)}
            >
              <option value="">Semua kecamatan</option>
              {districts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-range" className="sr-only">
              Rentang tanggal
            </label>
            <select
              id="filter-range"
              className="field-input pr-9"
              value={rangeParam}
              onChange={(event) => updateFilter("range", event.target.value)}
            >
              {RANGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-sla" className="sr-only">
              SLA
            </label>
            <select
              id="filter-sla"
              className="field-input pr-9"
              value={slaParam}
              onChange={(event) => updateFilter("sla", event.target.value)}
            >
              <option value="">Semua SLA</option>
              <option value="overdue">Lewat SLA</option>
            </select>
          </div>
        </div>

        {hasFilter ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Filter aktif diterapkan pada daftar di bawah.</p>
            <button
              type="button"
              className="min-h-control rounded-btn px-3 text-xs font-semibold text-blue hover:bg-surface"
              onClick={() => {
                setSearchText("");
                setSearchParams(new URLSearchParams(), { replace: true });
              }}
            >
              Reset filter
            </button>
          </div>
        ) : null}
      </div>

      <div ref={tableRef} className="mt-5 scroll-mt-24">
        {error ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-semibold text-status-ditolak-fg">{error}</p>
            <button
              type="button"
              className="btn-outline mt-4"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Tiket</th>
                    <th className="px-3 py-3">Judul</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Kecamatan</th>
                    <th className="px-3 py-3">Prioritas</th>
                    <th className="px-3 py-3">Masuk</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [0, 1, 2, 3, 4].map((index) => (
                        <tr key={index} className="border-b border-line last:border-0">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="h-5 animate-pulse rounded bg-surface" />
                          </td>
                        </tr>
                      ))
                    : items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-line last:border-0 hover:bg-surface/60"
                        >
                          <td className="px-5 py-3">
                            <Link
                              to={`/admin/laporan/${item.id}`}
                              className="font-mono text-xs font-bold text-navy hover:text-blue"
                            >
                              {item.ticket_no}
                            </Link>
                          </td>
                          <td className="max-w-[300px] px-3 py-3">
                            <Link
                              to={`/admin/laporan/${item.id}`}
                              className="line-clamp-2 font-semibold text-ink hover:text-blue"
                              title={item.title}
                            >
                              {item.title}
                            </Link>
                            {item.agency ? (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                                {item.agency.name}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-muted">{item.category.name}</td>
                          <td className="px-3 py-3 text-muted">{item.district?.name ?? "-"}</td>
                          <td className="px-3 py-3">
                            <span
                              className={
                                item.priority === "mendesak"
                                  ? "font-bold text-status-ditolak-fg"
                                  : "text-muted"
                              }
                            >
                              {item.priority === "mendesak" ? "Mendesak" : "Biasa"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-muted">
                            {formatShortDate(item.created_at)}
                            {item.overdue ? (
                              <span className="mt-0.5 block text-[11px] font-semibold text-status-ditolak-fg">
                                Lewat SLA
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <StatusChip status={item.status} />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              to={`/admin/laporan/${item.id}`}
                              className="inline-flex min-h-control items-center rounded-btn px-3 text-sm font-bold text-blue hover:bg-surface"
                            >
                              Buka
                            </Link>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {!loading && items.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <h2 className="text-lg font-bold text-navy">Tidak ada laporan yang cocok</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Coba ubah filter status, kategori, kecamatan, rentang tanggal, atau kata kunci
                  pencarian.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!error && data && total > 0 ? (
        <nav
          className="mt-6 flex flex-wrap items-center justify-between gap-3"
          aria-label="Navigasi halaman laporan admin"
        >
          <p className="text-sm text-muted">
            Menampilkan {formatNumber(start)}–{formatNumber(end)} dari {formatNumber(total)}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="btn-outline px-4"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
            >
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
                    item === page
                      ? "bg-navy text-white"
                      : "border border-line bg-white text-muted hover:border-blue hover:text-blue"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              className="btn-outline px-4"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Berikutnya
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
