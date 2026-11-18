import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import CopyButton from "../components/CopyButton";
import StatusChip from "../components/StatusChip";
import TicketLookup from "../components/TicketLookup";
import { api } from "../lib/api";
import { formatShortDate, STATUS_LABELS } from "../lib/format";

const DOT = {
  diterima: "bg-status-diterima-fg",
  diverifikasi: "bg-status-diverifikasi-fg",
  diproses: "bg-status-diproses-fg",
  selesai: "bg-status-selesai-fg",
  ditolak: "bg-status-ditolak-fg",
};

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-44 rounded bg-surface" />
        <div className="h-6 w-24 rounded-full bg-surface" />
      </div>
      <div className="h-6 w-4/5 rounded bg-surface" />
      <div className="h-3 w-2/3 rounded bg-surface" />
      <div className="mt-6 space-y-4 border-t border-line pt-5">
        <div className="h-3 w-1/3 rounded bg-surface" />
        <div className="h-3 w-full rounded bg-surface" />
        <div className="h-3 w-11/12 rounded bg-surface" />
      </div>
    </div>
  );
}

export default function CekTiket() {
  const { tiket } = useParams();
  const [state, setState] = useState({ status: "loading", data: null, message: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!tiket) {
      setState({ status: "notfound", data: null, message: "" });
      return undefined;
    }

    let active = true;
    setState({ status: "loading", data: null, message: "" });

    api
      .get(`/public/lookup/${encodeURIComponent(tiket)}`)
      .then((data) => {
        if (active) setState({ status: "success", data, message: "" });
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 404) {
          setState({ status: "notfound", data: null, message: err.message });
        } else {
          setState({ status: "error", data: null, message: err.message });
        }
      });

    return () => {
      active = false;
    };
  }, [tiket, reloadKey]);

  const { status, data, message } = state;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Lacak Laporan</p>
        <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Cek Status Laporan</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Masukkan nomor tiket untuk melihat perkembangan penanganan. Halaman ini tidak
          menampilkan identitas pelapor maupun lampiran.
        </p>
      </div>

      <div className="card mt-6 p-5 sm:p-7">
        {status === "loading" ? <DetailSkeleton /> : null}

        {status === "notfound" ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-ditolak-bg text-status-ditolak-fg">
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7v6M12 16.5v.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-navy">
              {tiket ? "Tiket tidak ditemukan" : "Masukkan nomor tiket"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {message ||
                "Periksa kembali nomor tiket Anda. Format yang diterima: LPR-DPK-2026-000123 atau 6 digit terakhir."}
            </p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="py-6 text-center">
            <h2 className="text-xl font-extrabold text-navy">Gagal memuat tiket</h2>
            <p className="mt-2 text-sm text-muted">{message}</p>
            <button
              type="button"
              className="btn-outline mt-4"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Coba lagi
            </button>
          </div>
        ) : null}

        {status === "success" && data ? (
          <article>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-bold text-navy">{data.ticket_no}</p>
                <CopyButton value={data.ticket_no} />
              </div>
              <StatusChip status={data.status} />
            </div>

            <h2 className="mt-3 text-xl font-extrabold leading-snug text-navy sm:text-2xl">
              {data.title}
            </h2>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Kategori</dt>
                <dd className="font-semibold text-ink">{data.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Kecamatan</dt>
                <dd className="font-semibold text-ink">{data.district ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Tanggal dibuat</dt>
                <dd className="font-semibold text-ink">{formatShortDate(data.created_at)}</dd>
              </div>
            </dl>

            {data.status === "ditolak" && data.rejection_reason ? (
              <div className="mt-5 rounded-btn border border-status-ditolak-fg/20 bg-status-ditolak-bg px-4 py-3">
                <p className="text-sm font-bold text-status-ditolak-fg">Alasan penolakan</p>
                <p className="mt-1 text-sm text-status-ditolak-fg/90">{data.rejection_reason}</p>
              </div>
            ) : null}

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-base font-bold text-navy">Riwayat Penanganan</h3>
              {data.timeline.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Belum ada riwayat yang dapat ditampilkan.</p>
              ) : (
                <ol className="mt-4 space-y-5">
                  {data.timeline.map((event, index) => (
                    <li key={`${event.created_at}-${index}`} className="relative pl-7">
                      {index < data.timeline.length - 1 ? (
                        <span
                          className="absolute left-[5px] top-5 h-[calc(100%+4px)] w-px bg-line"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span
                        className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${
                          DOT[event.status] ?? "bg-muted"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-bold text-ink">
                          {STATUS_LABELS[event.status] ?? event.status}
                        </p>
                        <p className="text-xs text-muted">{formatShortDate(event.created_at)}</p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{event.note_public}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <p className="mt-6 rounded-btn bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
              Identitas pelapor dan lampiran tidak ditampilkan di halaman ini. Untuk melihat detail
              laporan milik Anda beserta lampiran, masuk ke akun dan buka menu Laporan Saya.
            </p>
          </article>
        ) : null}
      </div>

      <div className="card mt-5 p-5">
        <p className="text-sm font-bold text-navy">Lacak tiket lain</p>
        <div className="mt-3">
          <TicketLookup key={tiket ?? "empty"} showHeading={false} defaultValue={tiket ?? ""} />
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-muted">
        Belum pernah melapor?{" "}
        <Link to="/lapor" className="link">
          Buat laporan sekarang
        </Link>
      </p>
    </div>
  );
}
