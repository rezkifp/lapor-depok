import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import StatusChip from "../components/StatusChip";
import { api } from "../lib/api";
import { formatNumber, formatShortDate } from "../lib/format";

const STATUS_FILTERS = [
  { value: "", label: "Semua" },
  { value: "diterima", label: "Diterima" },
  { value: "diverifikasi", label: "Diverifikasi" },
  { value: "diproses", label: "Diproses" },
  { value: "selesai", label: "Selesai" },
  { value: "ditolak", label: "Ditolak" },
];

function CardSkeleton() {
  return (
    <div className="card animate-pulse p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="h-3 w-32 rounded bg-surface" />
        <div className="h-6 w-20 rounded-full bg-surface" />
      </div>
      <div className="mt-4 h-4 w-4/5 rounded bg-surface" />
      <div className="mt-2 h-4 w-2/3 rounded bg-surface" />
      <div className="mt-5 h-3 w-1/2 rounded bg-surface" />
    </div>
  );
}

export default function LaporanSaya() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get("status") ?? "";
  const statusParam = STATUS_FILTERS.some((item) => item.value === rawStatus) ? rawStatus : "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (statusParam) query.set("status", statusParam);

    api
      .get(`/reports/mine?${query.toString()}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        if (page > result.total_pages) {
          const next = new URLSearchParams(searchParams);
          next.set("page", String(result.total_pages));
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
  }, [statusParam, page, reloadKey, searchParams, setSearchParams]);

  const changeStatus = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("status", value);
    else next.delete("status");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const goToPage = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    setSearchParams(params, { replace: true });
    requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const activeLabel = STATUS_FILTERS.find((item) => item.value === statusParam)?.label;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Ruang Warga</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Laporan Saya</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pantau seluruh laporan yang Anda kirim, lengkap dengan status penanganan dan
            tanggapan petugas.
          </p>
        </div>
        <Link to="/lapor" className="btn-primary px-5">
          Buat Laporan
        </Link>
      </div>

      <div className="mt-6 rounded-card border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status laporan">
          {STATUS_FILTERS.map((item) => {
            const active = statusParam === item.value;
            return (
              <button
                key={item.value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => changeStatus(item.value)}
                className={`min-h-control rounded-full px-4 text-sm font-semibold transition ${
                  active
                    ? "bg-navy text-white"
                    : "border border-line bg-white text-muted hover:border-blue hover:text-blue"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          {data
            ? `${formatNumber(data.total)} laporan${activeLabel && statusParam ? ` berstatus ${activeLabel.toLowerCase()}` : ""}`
            : "Memuat laporan..."}
        </p>
      </div>

      <div ref={listRef} className="scroll-mt-28">
        {error ? (
          <div className="card mt-5 p-6 text-center">
            <p className="text-sm font-semibold text-status-ditolak-fg">{error}</p>
            <button
              type="button"
              className="btn-outline mt-4"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Coba lagi
            </button>
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {loading
            ? [0, 1, 2].map((index) => <CardSkeleton key={index} />)
            : items.map((report) => (
                <Link
                  key={report.ticket_no}
                  to={`/laporan/${encodeURIComponent(report.ticket_no)}`}
                  className="card group block p-5 transition hover:border-blue"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-navy">{report.ticket_no}</span>
                    <StatusChip status={report.status} />
                  </div>
                  <h2 className="mt-3 text-base font-extrabold leading-snug text-navy group-hover:text-blue sm:text-lg">
                    {report.title}
                  </h2>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{report.category.name}</span>
                    <span>{formatShortDate(report.created_at)}</span>
                    {report.agency ? <span>{report.agency.name}</span> : null}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue">
                    Lihat detail
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              ))}
        </div>

        {!loading && !error && items.length === 0 ? (
          <div className="card mt-5 px-6 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-diverifikasi-bg text-status-diverifikasi-fg">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3h9l4 4v14H6z" />
                <path d="M14 3v5h5M9 12h6M9 16h4" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-navy">
              {statusParam ? `Belum ada laporan berstatus ${activeLabel.toLowerCase()}` : "Belum ada laporan"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {statusParam
                ? "Coba pilih status lain atau lihat semua laporan Anda."
                : "Laporan yang Anda kirim akan tampil di sini agar mudah dipantau."}
            </p>
            {statusParam ? (
              <button type="button" className="btn-outline mt-5" onClick={() => changeStatus("")}>
                Lihat semua laporan
              </button>
            ) : (
              <Link to="/lapor" className="btn-primary mt-5">
                Buat laporan sekarang
              </Link>
            )}
          </div>
        ) : null}
      </div>

      {data && data.total > 0 ? (
        <nav className="mt-8 flex flex-wrap items-center justify-between gap-3" aria-label="Navigasi halaman laporan saya">
          <button
            type="button"
            className="btn-outline px-5"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || loading}
          >
            Sebelumnya
          </button>
          <p className="text-sm text-muted">
            Halaman <span className="font-semibold text-ink">{page}</span> dari{" "}
            <span className="font-semibold text-ink">{totalPages}</span>
          </p>
          <button
            type="button"
            className="btn-outline px-5"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Berikutnya
          </button>
        </nav>
      ) : null}
    </div>
  );
}
