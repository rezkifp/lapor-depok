import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AttachmentGrid from "../components/AttachmentGrid";
import CopyButton from "../components/CopyButton";
import StatusChip from "../components/StatusChip";
import { Alert, Button, TextArea } from "../components/form";
import { api, getToken } from "../lib/api";
import {
  formatDate,
  formatDateTime,
  STATUS_LABELS,
} from "../lib/format";

const RATING_ASPECTS = [
  "Kecepatan respons",
  "Kejelasan tanggapan",
  "Hasil penanganan",
  "Keramahan petugas",
];

const RATING_LABELS = {
  1: "Sangat tidak puas",
  2: "Tidak puas",
  3: "Cukup",
  4: "Puas",
  5: "Sangat puas",
};

const STATUS_TONES = {
  diterima: "bg-status-diterima-bg text-status-diterima-fg",
  diverifikasi: "bg-status-diverifikasi-bg text-status-diverifikasi-fg",
  diproses: "bg-status-diproses-bg text-status-diproses-fg",
  selesai: "bg-status-selesai-bg text-status-selesai-fg",
  ditolak: "bg-status-ditolak-bg text-status-ditolak-fg",
};

function StarIcon({ filled, className = "h-9 w-9" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3.4 2.7 5.4 6 .9-4.35 4.2 1.03 5.95L12 17l-5.38 2.85L7.65 13.9 3.3 9.7l6-.9z" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function RatingSummary({ rating }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-navy">Penilaian Anda</h2>
      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        role="img"
        aria-label={`Penilaian ${rating.score} dari 5 bintang`}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <span key={value} className={value <= rating.score ? "text-gold" : "text-line"}>
            <StarIcon filled={value <= rating.score} className="h-8 w-8" />
          </span>
        ))}
        <span className="ml-1 text-sm font-bold text-navy">{RATING_LABELS[rating.score]}</span>
      </div>

      {rating.aspects.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {rating.aspects.map((aspect) => (
            <li
              key={aspect}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
            >
              <CheckIcon className="h-3.5 w-3.5 text-status-selesai-fg" />
              {aspect}
            </li>
          ))}
        </ul>
      ) : null}

      {rating.comment ? (
        <p className="mt-4 rounded-btn bg-surface px-4 py-3 text-sm leading-relaxed text-ink">
          {rating.comment}
        </p>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Dikirim {formatDateTime(rating.created_at)}. Penilaian hanya dapat dikirim satu kali dan
        tidak dapat diubah.
      </p>
    </section>
  );
}

export default function LaporanDetail() {
  const { tiket } = useParams();
  const [status, setStatus] = useState("loading");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const [followupBody, setFollowupBody] = useState("");
  const [followupError, setFollowupError] = useState("");
  const [followupNotice, setFollowupNotice] = useState("");
  const [submittingFollowup, setSubmittingFollowup] = useState(false);

  const [ratingScore, setRatingScore] = useState(0);
  const [ratingAspects, setRatingAspects] = useState([]);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingError, setRatingError] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    setDownloadError("");
    setFollowupError("");
    setFollowupNotice("");
    setFollowupBody("");
    setRatingError("");
    setRatingScore(0);
    setRatingAspects([]);
    setRatingComment("");

    if (!tiket) {
      setStatus("notfound");
      return undefined;
    }

    api
      .get(`/reports/${encodeURIComponent(tiket)}`)
      .then((data) => {
        if (!active) return;
        setReport(data);
        setStatus("success");
      })
      .catch((err) => {
        if (!active) return;
        setReport(null);
        if (err.status === 404) setStatus("notfound");
        else {
          setStatus("error");
          setError(err.message);
        }
      });

    return () => {
      active = false;
    };
  }, [tiket, reloadKey]);

  const timeline = report?.timeline ?? [];
  const followups = report?.followups ?? [];
  const attachments = report?.attachments ?? [];

  const latestStaffReply = useMemo(() => {
    const replies = timeline.filter(
      (event) => event.status !== "diterima" && event.note_public,
    );
    return replies.length > 0 ? replies[replies.length - 1] : null;
  }, [timeline]);

  const isFinal = report ? ["selesai", "ditolak"].includes(report.status) : false;
  const canFollowup = report && !isFinal;
  const followupFull = followups.length >= 5;
  const staffLabel = report?.agency?.name ? `Petugas ${report.agency.name}` : "Petugas";

  const download = async () => {
    if (!tiket) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const token = getToken();
      const response = await fetch(
        `/api/reports/${encodeURIComponent(tiket)}/receipt.pdf`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!response.ok) throw new Error("Gagal mengunduh bukti laporan.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bukti-${tiket}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const scrollToFollowup = () => {
    document.getElementById("tanggapan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitFollowup = async (event) => {
    event.preventDefault();
    const body = followupBody.trim();
    if (body.length < 10 || body.length > 1000) {
      setFollowupError("Tanggapan harus 10-1000 karakter.");
      return;
    }

    setSubmittingFollowup(true);
    setFollowupError("");
    setFollowupNotice("");
    try {
      const created = await api.post(
        `/reports/${encodeURIComponent(tiket)}/followups`,
        { body },
      );
      setReport((current) =>
        current
          ? {
              ...current,
              followups: [
                ...current.followups,
                { id: created.id, body: created.body, created_at: created.created_at },
              ],
            }
          : current,
      );
      setFollowupBody("");
      setFollowupNotice(
        created.remaining > 0
          ? `Tanggapan terkirim. Anda masih bisa menambahkan ${created.remaining} tanggapan.`
          : "Tanggapan terkirim. Batas 5 tanggapan sudah tercapai.",
      );
    } catch (err) {
      setFollowupError(err.message);
    } finally {
      setSubmittingFollowup(false);
    }
  };

  const toggleAspect = (aspect) => {
    setRatingAspects((current) =>
      current.includes(aspect)
        ? current.filter((item) => item !== aspect)
        : [...current, aspect],
    );
  };

  const submitRating = async (event) => {
    event.preventDefault();
    if (!ratingScore) {
      setRatingError("Pilih skor penilaian 1-5 terlebih dahulu.");
      return;
    }

    setRatingSubmitting(true);
    setRatingError("");
    try {
      const created = await api.post(`/reports/${encodeURIComponent(tiket)}/rating`, {
        score: ratingScore,
        aspects: ratingAspects,
        comment: ratingComment.trim(),
      });
      setReport((current) => (current ? { ...current, rating: created } : current));
    } catch (err) {
      setRatingError(err.message);
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="card animate-pulse p-6">
              <div className="h-4 w-40 rounded bg-surface" />
              <div className="mt-5 h-6 w-4/5 rounded bg-surface" />
              <div className="mt-3 h-3 w-2/3 rounded bg-surface" />
              <div className="mt-6 h-3 w-full rounded bg-surface" />
            </div>
            <div className="card h-48 animate-pulse bg-surface" />
          </div>
          <div className="card h-40 animate-pulse bg-surface" />
        </div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-14 sm:px-6">
        <div className="card px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-ditolak-bg text-status-ditolak-fg">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-navy">Laporan tidak ditemukan</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Laporan ini tidak tersedia di akun Anda. Periksa kembali nomor tiket atau buka daftar
            laporan Anda.
          </p>
          <Link to="/laporan-saya" className="btn-primary mt-5">
            Kembali ke Laporan Saya
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error" || !report) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-14 sm:px-6">
        <div className="card px-6 py-12 text-center">
          <h1 className="text-xl font-extrabold text-navy">Gagal memuat laporan</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <button
            type="button"
            className="btn-outline mt-5"
            onClick={() => {
              setReloadKey((current) => current + 1);
            }}
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const location = [
    report.village ? `Kel. ${report.village.name}` : "",
    report.district ? `Kec. ${report.district.name}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const closedLabel =
    report.closed_at && ["selesai", "ditolak"].includes(report.status)
      ? `${report.status === "ditolak" ? "Ditolak" : "Selesai"} ${formatDate(report.closed_at)}`
      : "";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/laporan-saya"
        className="inline-flex min-h-control items-center gap-1.5 text-sm font-semibold text-blue hover:text-navy"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Laporan Saya
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <article className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-bold text-navy">{report.ticket_no}</p>
                <CopyButton value={report.ticket_no} />
              </div>
              <StatusChip status={report.status} />
            </div>

            <h1 className="mt-3 text-xl font-extrabold leading-snug text-navy sm:text-2xl">
              {report.title}
            </h1>

            <div className="mt-4 space-y-1 text-sm text-muted">
              <p>
                Kategori: <span className="font-semibold text-ink">{report.category.name}</span>
                {report.agency ? (
                  <>
                    {" "}
                    · Tujuan: <span className="font-semibold text-ink">{report.agency.name}</span>
                  </>
                ) : null}
              </p>
              <p>
                Lokasi:{" "}
                <span className="font-semibold text-ink">
                  {location || report.address || "-"}
                </span>
              </p>
              <p>
                Dikirim {formatDate(report.created_at)}
                {closedLabel ? ` · ${closedLabel}` : ""}
              </p>
            </div>

            {report.status === "ditolak" ? (
              <div className="mt-5 rounded-btn border border-status-ditolak-fg/20 bg-status-ditolak-bg px-4 py-3">
                <p className="text-sm font-bold text-status-ditolak-fg">Alasan penolakan</p>
                <p className="mt-1 text-sm leading-relaxed text-status-ditolak-fg/90">
                  {report.rejection_reason ||
                    "Laporan tidak dapat diproses. Silakan hubungi admin untuk keterangan lebih lanjut."}
                </p>
              </div>
            ) : null}

            {report.status === "selesai" && latestStaffReply ? (
              <div className="mt-5 rounded-btn bg-surface px-4 py-3">
                <p className="text-xs font-bold text-navy">
                  Tanggapan akhir · {staffLabel}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {latestStaffReply.note_public}
                </p>
              </div>
            ) : null}
          </article>

          {attachments.length > 0 ? (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-navy">Lampiran</h2>
              <p className="mt-1 text-sm text-muted">
                Lampiran hanya dapat dilihat oleh Anda melalui sesi yang sudah masuk.
              </p>
              <AttachmentGrid
                fetchUrlPrefix={`/api/reports/${encodeURIComponent(report.ticket_no)}/attachments`}
                attachments={attachments}
              />
            </section>
          ) : null}

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">Riwayat Status</h2>
            {timeline.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Belum ada riwayat yang dapat ditampilkan.</p>
            ) : (
              <ol className="mt-5 space-y-5">
                {timeline.map((event, index) => {
                  const last = index === timeline.length - 1;
                  return (
                    <li key={`${event.created_at}-${index}`} className="relative flex gap-4">
                      {!last ? (
                        <span
                          className="absolute left-4 top-9 h-[calc(100%-8px)] w-px bg-line"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                          last
                            ? STATUS_TONES[event.status] ?? "bg-surface text-muted"
                            : "bg-status-selesai-bg text-status-selesai-fg"
                        }`}
                      >
                        {last ? index + 1 : <CheckIcon />}
                      </span>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <p className="text-sm font-bold text-ink">
                            {STATUS_LABELS[event.status] ?? event.status}
                          </p>
                          <p className="text-xs text-muted">{formatDateTime(event.created_at)}</p>
                        </div>
                        {event.note_public ? (
                          <p className="mt-1 text-sm leading-relaxed text-muted">
                            {event.note_public}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {latestStaffReply && ["diverifikasi", "diproses"].includes(report.status) ? (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-navy">Tanggapan Petugas</h2>
              <div className="mt-3 rounded-btn bg-surface px-4 py-3">
                <p className="text-xs font-semibold text-muted">
                  {staffLabel} · {formatDateTime(latestStaffReply.created_at)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink">
                  {latestStaffReply.note_public}
                </p>
              </div>
            </section>
          ) : null}

          {canFollowup ? (
            <section id="tanggapan" className="card scroll-mt-28 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-navy">Tanggapan Anda</h2>
                <span className="text-xs font-semibold text-muted">
                  {followups.length} / 5 tanggapan
                </span>
              </div>

              {followups.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Belum ada tanggapan. Tambahkan informasi baru bila diperlukan agar petugas dapat
                  menindaklanjuti laporan Anda.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {followups.map((item) => (
                    <li key={item.id} className="rounded-btn border border-line px-4 py-3">
                      <p className="text-xs font-semibold text-muted">
                        {formatDateTime(item.created_at)}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {followupFull ? (
                <p className="mt-4 rounded-btn bg-surface px-4 py-3 text-sm text-muted">
                  Batas 5 tanggapan per laporan sudah tercapai.
                </p>
              ) : (
                <form className="mt-5 border-t border-line pt-5" onSubmit={submitFollowup}>
                  <label htmlFor="followup-body" className="field-label">
                    Tambah tanggapan
                  </label>
                  <TextArea
                    id="followup-body"
                    rows={4}
                    value={followupBody}
                    maxLength={1000}
                    onChange={(event) => {
                      setFollowupBody(event.target.value);
                      setFollowupNotice("");
                    }}
                    placeholder="Tuliskan informasi tambahan untuk petugas..."
                  />
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">Minimal 10 karakter.</p>
                    <p className="text-xs text-muted">{followupBody.length} / 1000</p>
                  </div>

                  {followupError ? (
                    <div className="mt-3">
                      <Alert tone="error">{followupError}</Alert>
                    </div>
                  ) : null}
                  {followupNotice ? (
                    <div className="mt-3">
                      <Alert tone="success">{followupNotice}</Alert>
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    className="mt-4 w-full sm:w-auto"
                    disabled={submittingFollowup || followupBody.trim().length < 10}
                  >
                    {submittingFollowup ? "Mengirim..." : "Kirim Tanggapan"}
                  </Button>
                </form>
              )}
            </section>
          ) : null}

          {report.status === "selesai" ? (
            report.rating ? (
              <RatingSummary rating={report.rating} />
            ) : (
              <form className="card p-5 sm:p-6" onSubmit={submitRating}>
                <h2 className="text-lg font-extrabold text-navy">Bagaimana penilaian Anda?</h2>
                <p className="mt-1 text-sm text-muted">
                  Penilaian Anda membantu kami meningkatkan layanan.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Beri ${value} bintang`}
                      aria-pressed={ratingScore === value}
                      onClick={() => setRatingScore(value)}
                      className={`flex h-11 w-11 items-center justify-center rounded-btn transition hover:bg-surface ${
                        value <= ratingScore ? "text-gold" : "text-muted"
                      }`}
                    >
                      <StarIcon filled={value <= ratingScore} className="h-9 w-9" />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-bold text-navy">
                    {RATING_LABELS[ratingScore] ?? "Pilih bintang"}
                  </span>
                </div>
                <div className="mt-1 flex max-w-xs justify-between text-xs text-muted">
                  <span>Sangat tidak puas</span>
                  <span>Sangat puas</span>
                </div>

                <p className="mt-5 text-sm font-semibold text-ink">
                  Apa yang sudah baik? <span className="font-normal text-muted">(opsional)</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {RATING_ASPECTS.map((aspect) => {
                    const active = ratingAspects.includes(aspect);
                    return (
                      <button
                        key={aspect}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleAspect(aspect)}
                        className={`inline-flex min-h-control items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
                          active
                            ? "border border-navy bg-navy text-white"
                            : "border border-line bg-white text-ink hover:border-navy"
                        }`}
                      >
                        {active ? <CheckIcon className="h-4 w-4" /> : null}
                        {aspect}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <label htmlFor="rating-comment" className="field-label">
                    Komentar <span className="font-normal text-muted">(opsional)</span>
                  </label>
                  <TextArea
                    id="rating-comment"
                    rows={4}
                    maxLength={500}
                    value={ratingComment}
                    onChange={(event) => setRatingComment(event.target.value)}
                    placeholder="Ceritakan pengalaman Anda terhadap penanganan laporan ini..."
                  />
                  <p className="mt-1 text-right text-xs text-muted">{ratingComment.length} / 500</p>
                </div>

                {ratingError ? (
                  <div className="mt-3">
                    <Alert tone="error">{ratingError}</Alert>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-sm text-xs leading-relaxed text-muted">
                    Penilaian hanya dapat dikirim satu kali dan dihitung dalam skor kepuasan di
                    halaman utama. Komentar tidak ditampilkan ke publik.
                  </p>
                  <Button type="submit" disabled={ratingSubmitting}>
                    {ratingSubmitting ? "Mengirim..." : "Kirim Penilaian"}
                  </Button>
                </div>
              </form>
            )
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-base font-extrabold text-navy">Tindakan</h2>
            <div className="mt-3 space-y-3">
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => void download()}
                disabled={downloading}
              >
                {downloading ? "Membuat PDF..." : "Unduh Bukti Laporan (PDF)"}
              </button>

              {canFollowup && !followupFull ? (
                <button type="button" className="btn-outline w-full" onClick={scrollToFollowup}>
                  Tambah Tanggapan
                </button>
              ) : null}

              {report.status === "ditolak" ? (
                <Link to="/lapor" className="btn-outline w-full">
                  Buat Laporan Baru
                </Link>
              ) : null}
            </div>

            {downloadError ? (
              <p className="mt-3 text-xs font-medium text-status-ditolak-fg">{downloadError}</p>
            ) : null}
          </div>

          {report.status !== "selesai" ? (
            <div className="card p-5">
              <h2 className="text-base font-extrabold text-navy">Penilaian Layanan</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {report.status === "ditolak"
                  ? "Penilaian tidak tersedia untuk laporan yang ditolak."
                  : "Penilaian dibuka setelah laporan berstatus Selesai."}
              </p>
            </div>
          ) : null}

          <div className="card p-5">
            <h2 className="text-base font-extrabold text-navy">Privasi</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Halaman ini hanya dapat dibuka dari akun pemilik laporan. Identitas dan lampiran
              tidak pernah disajikan tanpa sesi masuk.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
