import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import CopyButton from "../components/CopyButton";
import StatusChip from "../components/StatusChip";
import { Button } from "../components/form";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";

export default function LaporanSukses() {
  const { tiket } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState({ status: "loading", report: null, error: "" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let active = true;
    setState({ status: "loading", report: null, error: "" });

    if (!tiket) {
      setState({ status: "notfound", report: null, error: "" });
      return undefined;
    }

    api
      .get(`/reports/${encodeURIComponent(tiket)}`)
      .then((data) => {
        if (active) setState({ status: "success", report: data, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 404) setState({ status: "notfound", report: null, error: error.message });
        else setState({ status: "error", report: null, error: error.message });
      });

    return () => {
      active = false;
    };
  }, [tiket]);

  const download = async () => {
    if (!tiket) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const token = localStorage.getItem("lapor-depok.token");
      const response = await fetch(`/api/reports/${encodeURIComponent(tiket)}/receipt.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Gagal mengunduh bukti laporan.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bukti-${tiket}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error.message);
    } finally {
      setDownloading(false);
    }
  };

  const qrUrl = `${window.location.origin}/cek/${tiket ?? ""}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-selesai-bg text-status-selesai-fg">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-blue">Pengaduan Warga</p>
        <h1 className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">Laporan Berhasil Dikirim</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Terima kasih. Laporan Anda sudah diterima dan masuk antrean verifikasi admin.
        </p>
      </div>

      <div className="card mt-8 p-5 sm:p-7">
        {state.status === "loading" ? (
          <p className="py-10 text-center text-sm text-muted">Memuat bukti laporan...</p>
        ) : null}

        {state.status === "notfound" ? (
          <div className="py-10 text-center">
            <h2 className="text-xl font-extrabold text-navy">Tiket Tidak Ditemukan</h2>
            <p className="mt-2 text-sm text-muted">Nomor tiket yang Anda buka tidak dapat ditemukan.</p>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="py-10 text-center">
            <h2 className="text-xl font-extrabold text-navy">Gagal Memuat Laporan</h2>
            <p className="mt-2 text-sm text-muted">{state.error}</p>
          </div>
        ) : null}

        {state.status === "success" && state.report ? (
          <article>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-bold text-navy">{state.report.ticket_no}</p>
                <CopyButton value={state.report.ticket_no} />
              </div>
              <StatusChip status={state.report.status} />
            </div>
            <h2 className="mt-3 text-xl font-extrabold leading-snug text-navy sm:text-2xl">{state.report.title}</h2>
            <p className="mt-2 text-sm text-muted">Dikirim pada {formatDateTime(state.report.created_at)}</p>

            <div className="mt-6 flex flex-col items-center gap-6 rounded-card border border-line bg-surface p-6 sm:flex-row sm:justify-between">
              <div className="text-center sm:text-left">
                <h3 className="text-base font-bold text-navy">Simpan bukti laporan</h3>
                <p className="mt-1 text-sm text-muted">Unduh dokumen PDF berisi tiket dan kode QR untuk dipantau.</p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-card border border-line bg-white p-3">
                  <QRCodeSVG value={qrUrl} size={140} bgColor="#FFFFFF" fgColor="#0B2A5B" level="M" includeMargin={false} />
                </div>
                <p className="font-mono text-xs text-muted">{tiket}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={() => void download()} disabled={downloading} className="min-h-control">
                {downloading ? "Membuat PDF..." : "Unduh Bukti (PDF)"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  try {
                    localStorage.removeItem("lapor-depok.draft");
                  } catch {
                    /* abaikan */
                  }
                  navigate("/", { replace: true });
                }}
                className="min-h-control"
              >
                Buat Laporan Baru
              </Button>
            </div>
            {downloadError ? <p className="mt-3 text-xs font-medium text-status-ditolak-fg">{downloadError}</p> : null}

            <div className="mt-6">
              <Link to={`/cek/${encodeURIComponent(tiket ?? "")}`} className="btn-primary min-h-control w-full text-center">
                Pantau Status Laporan
              </Link>
            </div>

            <p className="mt-6 rounded-btn bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
              Pembaruan status laporan dikirim ke email akun Anda ({user?.email ?? "-"}). Admin akan memverifikasi laporan
              Anda dalam 2 hari kerja sebelum diteruskan ke instansi terkait.
            </p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
