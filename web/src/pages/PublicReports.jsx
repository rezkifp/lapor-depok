import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import StatusChip from "../components/StatusChip";
import { api } from "../lib/api";
import { formatNumber, formatShortDate } from "../lib/format";

function CardSkeleton() {
  return (
    <div className="card animate-pulse p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="h-6 w-20 rounded-full bg-surface" />
        <div className="h-3 w-24 rounded bg-surface" />
      </div>
      <div className="mt-4 h-4 w-4/5 rounded bg-surface" />
      <div className="mt-2 h-4 w-2/3 rounded bg-surface" />
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded bg-surface" />
        <div className="h-3 w-11/12 rounded bg-surface" />
      </div>
      <div className="mt-5 h-3 w-1/2 rounded bg-surface" />
    </div>
  );
}

export default function PublicReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .get("/master/categories")
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (categoryParam) query.set("category", categoryParam);

    api
      .get(`/public/reports?${query.toString()}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        if (page > result.total_pages) setPage(1);
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categoryParam, page, reloadKey]);

  const changeCategory = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set("category", value);
    } else {
      next.delete("category");
    }
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const goToPage = (next) => {
    setPage(next);
    requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const activeCategory = categories.find((item) => String(item.id) === categoryParam);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">
            Transparansi Layanan
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Laporan Publik</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pengaduan dan aspirasi warga yang dipublikasikan. Identitas pelapor dengan privasi
            rahasia dan anonim tidak ditampilkan.
          </p>
        </div>
        <Link to="/" className="btn-outline px-5">
          Kembali ke beranda
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-card border border-line bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="filter-kategori" className="field-label">
            Kategori
          </label>
          <select
            id="filter-kategori"
            className="field-input pr-9"
            value={categoryParam}
            onChange={(event) => changeCategory(event.target.value)}
          >
            <option value="">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted">
          {data ? `${formatNumber(data.total)} laporan` : "Memuat laporan..."}
          {activeCategory ? ` pada kategori ${activeCategory.name}` : ""}
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

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {loading
            ? [0, 1, 2, 3].map((index) => <CardSkeleton key={index} />)
            : items.map((report) => (
                <article key={report.ticket_no} className="card flex flex-col p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusChip status={report.status} />
                    <span className="text-xs text-muted">
                      {formatShortDate(report.created_at)}
                    </span>
                  </div>

                  <h2 className="mt-3 text-base font-bold leading-snug text-navy">
                    <Link
                      to={`/cek/${encodeURIComponent(report.ticket_no)}`}
                      className="hover:text-blue"
                    >
                      {report.title}
                    </Link>
                  </h2>

                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                    {report.summary}
                  </p>

                  <dl className="mt-4 grid gap-1 border-t border-line pt-3 text-xs text-muted">
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="sr-only">Nomor tiket</dt>
                      <dd className="font-mono font-semibold text-ink">{report.ticket_no}</dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="sr-only">Wilayah dan kategori</dt>
                      <dd>
                        Kec. {report.district} · {report.category.name}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="sr-only">Pelapor</dt>
                      <dd>Pelapor: {report.reporter_name}</dd>
                    </div>
                  </dl>
                </article>
              ))}
        </div>

        {!loading && !error && items.length === 0 ? (
          <div className="card mt-5 px-6 py-14 text-center">
            <h2 className="text-lg font-bold text-navy">Belum ada laporan</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {categoryParam
                ? "Tidak ada laporan publik pada kategori ini. Coba pilih kategori lain."
                : "Belum ada pengaduan atau aspirasi yang dipublikasikan."}
            </p>
            <Link to="/lapor" className="btn-primary mt-5">
              Buat laporan
            </Link>
          </div>
        ) : null}
      </div>

      {data && data.total > 0 ? (
        <nav
          className="mt-8 flex flex-wrap items-center justify-between gap-3"
          aria-label="Navigasi halaman laporan"
        >
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
