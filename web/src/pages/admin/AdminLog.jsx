import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Alert, Field, TextInput } from "../../components/form";
import { api } from "../../lib/api";
import { formatDateTime, formatNumber } from "../../lib/format";

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

export default function AdminLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const actionParam = searchParams.get("action") ?? "";
  const dateFromParam = searchParams.get("date_from") ?? "";
  const dateToParam = searchParams.get("date_to") ?? "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actionText, setActionText] = useState(actionParam);

  useEffect(() => {
    setActionText(actionParam);
  }, [actionParam]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(page) });
    if (actionParam) query.set("action", actionParam);
    if (dateFromParam) query.set("date_from", dateFromParam);
    if (dateToParam) query.set("date_to", dateToParam);

    api
      .get(`/admin/audit?${query.toString()}`)
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
  }, [page, actionParam, dateFromParam, dateToParam, reloadKey, searchParams, setSearchParams]);

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

  const submitActionFilter = () => {
    const next = new URLSearchParams(searchParams);
    if (actionText.trim()) next.set("action", actionText.trim());
    else next.delete("action");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Panel Admin</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Log Aktivitas</h1>
          <p className="mt-1 text-sm text-muted">Riwayat tindakan admin yang tercatat di sistem.</p>
        </div>
      </div>

      <div className="card mt-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Aksi" htmlFor="log-action">
            <TextInput id="log-action" value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder="Contoh: report.verified" />
          </Field>
          <Field label="Dari tanggal" htmlFor="log-from">
            <TextInput id="log-from" type="date" value={dateFromParam} onChange={(event) => updateFilter("date_from", event.target.value)} />
          </Field>
          <Field label="Sampai tanggal" htmlFor="log-to">
            <TextInput id="log-to" type="date" value={dateToParam} onChange={(event) => updateFilter("date_to", event.target.value)} />
          </Field>
          <div className="flex items-end">
            <button type="button" className="btn-primary min-h-control rounded-btn px-4 text-sm font-bold" onClick={submitActionFilter}>
              Terapkan
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            className="text-sm font-semibold text-blue hover:text-navy"
            onClick={() => {
              setActionText("");
              updateFilter("action", "");
              updateFilter("date_from", "");
              updateFilter("date_to", "");
            }}
          >
            Reset filter
          </button>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Waktu</th>
                <th className="px-3 py-3">Aktor</th>
                <th className="px-3 py-3">Aksi</th>
                <th className="px-3 py-3">Target</th>
                <th className="px-3 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Memuat log aktivitas...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-status-ditolak-fg">{error}</p>
                    <button type="button" className="btn-outline mt-4" onClick={() => setReloadKey((current) => current + 1)}>
                      Coba lagi
                    </button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Belum ada catatan log yang cocok.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDateTime(item.created_at)}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{item.actor_name ?? "Sistem"}</td>
                    <td className="px-3 py-3 font-mono text-xs text-ink">{item.action}</td>
                    <td className="px-3 py-3 text-muted">{item.target ?? "-"}</td>
                    <td className="px-3 py-3 text-muted">{item.meta ? JSON.stringify(item.meta) : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && data && !error && total > 0 ? (
        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Navigasi halaman log admin">
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
