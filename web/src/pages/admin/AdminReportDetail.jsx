import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AttachmentGrid from "../../components/AttachmentGrid";
import MapView from "../../components/MapView";
import StatusChip from "../../components/StatusChip";
import { Alert, Button } from "../../components/form";
import { api } from "../../lib/api";
import { formatDateTime, formatShortDate, maskNik } from "../../lib/format";

const PRIORITY_OPTIONS = [
  { value: "biasa", label: "Biasa" },
  { value: "mendesak", label: "Mendesak" },
];

const EMPTY_FORM = {
  status: "",
  agencyId: "",
  priority: "biasa",
  reply: "",
  note: "",
};

function StarIcon({ filled, className = "h-5 w-5" }) {
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

function InfoItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function ReporterRow({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" aria-hidden="true">
      <div className="space-y-4">
        <div className="card h-64 animate-pulse bg-surface" />
        <div className="card h-72 animate-pulse bg-surface" />
        <div className="card h-40 animate-pulse bg-surface" />
      </div>
      <div className="space-y-4">
        <div className="card h-52 animate-pulse bg-surface" />
        <div className="card h-96 animate-pulse bg-surface" />
      </div>
    </div>
  );
}

export default function AdminReportDetail() {
  const { id } = useParams();
  const [state, setState] = useState("loading");
  const [report, setReport] = useState(null);
  const [agencies, setAgencies] = useState([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/master/agencies")
      .then((rows) => {
        if (active) setAgencies(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        // Dropdown instansi kosong; data detail tetap tampil.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setState("loading");
    setError("");
    setFormError("");

    api
      .get(`/admin/reports/${encodeURIComponent(id)}`)
      .then((data) => {
        if (!active) return;
        setReport(data);
        setForm({
          status: "",
          agencyId: data.agency ? String(data.agency.id) : "",
          priority: data.priority,
          reply: "",
          note: "",
        });
        setState("success");
      })
      .catch((err) => {
        if (!active) return;
        setReport(null);
        if (err.status === 404) {
          setState("notfound");
        } else {
          setError(err.message);
          setState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setConfirmFinal(false);
    setFormError("");
    setNotice("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!report) return;

    const reply = form.reply.trim();
    const note = form.note.trim();
    if (form.status === "ditolak" && !reply) {
      setFormError("Alasan penolakan wajib diisi karena akan dikirim ke pelapor.");
      return;
    }

    const payload = {};
    if (form.status) payload.status = form.status;
    if (report.can_dispatch) {
      if (form.agencyId && Number(form.agencyId) !== report.agency?.id) {
        payload.agency_id = Number(form.agencyId);
      }
      if (form.priority !== report.priority) payload.priority = form.priority;
    }
    if (reply) payload.reply_public = reply;
    if (note) payload.note_internal = note;

    if (Object.keys(payload).length === 0) {
      setFormError("Ubah minimal satu bagian sebelum menyimpan.");
      return;
    }

    if ((form.status === "selesai" || form.status === "ditolak") && !confirmFinal) {
      setConfirmFinal(true);
      setFormError("");
      return;
    }

    setSaving(true);
    setConfirmFinal(false);
    setFormError("");
    setNotice("");
    try {
      const result = await api.patch(`/admin/reports/${report.id}/action`, payload);
      setNotice(`${result.message} Status sekarang: ${result.status_label}.`);
      setReloadKey((current) => current + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="h-5 w-40 animate-pulse rounded bg-surface" />
        <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-surface" />
        <div className="mt-6">
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="card px-6 py-12 text-center">
          <h1 className="text-xl font-extrabold text-navy">Laporan tidak ditemukan</h1>
          <p className="mt-2 text-sm text-muted">
            Laporan ini tidak ada atau berada di luar instansi Anda.
          </p>
          <Link to="/admin/laporan" className="btn-primary mt-5">
            Kembali ke daftar laporan
          </Link>
        </div>
      </div>
    );
  }

  if (state === "error" || !report) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="card px-6 py-12 text-center">
          <h1 className="text-xl font-extrabold text-navy">Gagal memuat laporan</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <button
            type="button"
            className="btn-outline mt-5"
            onClick={() => setReloadKey((current) => current + 1)}
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
  const allowed = report.allowed_statuses ?? [];
  const canDispatch = Boolean(report.can_dispatch);
  const targetIsReject = form.status === "ditolak";
  const reporter = report.reporter;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted" aria-label="Remah roti">
        <Link to="/admin/laporan" className="font-semibold text-blue hover:text-navy">
          Laporan Masuk
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-mono text-xs font-semibold">{report.ticket_no}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="max-w-3xl text-2xl font-extrabold leading-snug text-navy sm:text-3xl">
          {report.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {report.overdue ? (
            <span className="chip bg-status-ditolak-bg text-status-ditolak-fg">Lewat SLA</span>
          ) : null}
          <StatusChip status={report.status} />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        {report.type_label} · {report.category.name} · Dikirim {formatDateTime(report.created_at)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">Uraian Laporan</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
              {report.body}
            </p>

            {report.status === "ditolak" && report.rejection_reason ? (
              <div className="mt-4 rounded-btn border border-status-ditolak-fg/20 bg-status-ditolak-bg px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-status-ditolak-fg">
                  Alasan penolakan
                </p>
                <p className="mt-1 text-sm leading-relaxed text-status-ditolak-fg/90">
                  {report.rejection_reason}
                </p>
              </div>
            ) : null}

            <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <InfoItem label="Jenis">{report.type_label}</InfoItem>
              <InfoItem label="Kategori">{report.category.name}</InfoItem>
              <InfoItem label="Instansi">{report.agency?.name ?? "Belum ditentukan"}</InfoItem>
              <InfoItem label="Tanggal kejadian">{formatShortDate(report.incident_date)}</InfoItem>
              <InfoItem label="Prioritas">{report.priority_label}</InfoItem>
              <InfoItem label="Privasi">{report.privacy_label}</InfoItem>
            </dl>

            {report.attachments.length > 0 ? (
              <>
                <h3 className="mt-5 border-t border-line pt-4 text-sm font-bold text-navy">
                  Lampiran ({report.attachments.length})
                </h3>
                <AttachmentGrid
                  fetchUrlPrefix={`/api/admin/reports/${report.id}/attachments`}
                  attachments={report.attachments}
                />
              </>
            ) : (
              <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
                Tidak ada lampiran pada laporan ini.
              </p>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">Lokasi</h2>
            <p className="mt-1 text-sm text-muted">{location || "Lokasi tidak tercatat"}</p>
            {report.address ? <p className="text-sm text-ink">{report.address}</p> : null}
            <div className="mt-3">
              <MapView lat={report.lat} lng={report.lng} className="h-[260px]" />
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-navy">Tanggapan Pelapor</h2>
              <span className="text-xs font-semibold text-muted">
                {report.followups.length} tanggapan
              </span>
            </div>
            {report.followups.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Pelapor belum menambahkan tanggapan.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {report.followups.map((item) => (
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
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">Riwayat</h2>
            {report.events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Belum ada riwayat untuk laporan ini.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {report.events.map((event) => (
                  <li key={event.id} className="rounded-btn border border-line px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusChip status={event.status} />
                        <span className="text-xs text-muted">{event.actor_name}</span>
                      </div>
                      <time className="text-xs text-muted" dateTime={event.created_at}>
                        {formatDateTime(event.created_at)}
                      </time>
                    </div>
                    {event.note_public ? (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
                        {event.note_public}
                      </p>
                    ) : null}
                    {event.note_internal ? (
                      <div className="mt-3 rounded-btn border border-dashed border-line bg-surface px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                          Catatan internal
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                          {event.note_internal}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-base font-extrabold text-navy">Pelapor</h2>
            {reporter.hidden ? (
              <div className="mt-3 rounded-btn border border-dashed border-line bg-surface px-4 py-4">
                <p className="text-sm font-bold text-navy">Identitas disembunyikan (anonim)</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Hanya super admin yang dapat melihat identitas pelapor laporan anonim.
                  Notifikasi tetap dikirim ke email akun pelapor.
                </p>
              </div>
            ) : (
              <dl className="mt-3 space-y-3">
                <ReporterRow label="Nama">{reporter.name}</ReporterRow>
                <ReporterRow label="NIK">
                  {reporter.nik_last4 ? maskNik(reporter.nik_last4) : "-"}
                </ReporterRow>
                <ReporterRow label="No. HP">{reporter.phone ?? "-"}</ReporterRow>
                <ReporterRow label="Email">{reporter.email ?? "-"}</ReporterRow>
                <ReporterRow label="Alamat">
                  {reporter.address
                    ? `${reporter.address}${
                        reporter.village ? `, Kel. ${reporter.village}` : ""
                      }${reporter.district ? `, Kec. ${reporter.district}` : ""}`
                    : "-"}
                </ReporterRow>
                <ReporterRow label="Privasi">{reporter.privacy_label}</ReporterRow>
              </dl>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-base font-extrabold text-navy">Tindak Lanjut</h2>
            <form className="mt-4 space-y-4" onSubmit={submit}>
              <div>
                <label htmlFor="action-status" className="field-label">
                  Ubah status
                </label>
                <select
                  id="action-status"
                  className="field-input pr-9"
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value)}
                  disabled={allowed.length === 0 || saving}
                >
                  <option value="">
                    {allowed.length === 0 ? "Status final — tidak ada perubahan" : "Tidak diubah"}
                  </option>
                  {allowed.map((status) => (
                    <option key={status} value={status}>
                      {
                        {
                          diterima: "Diterima",
                          diverifikasi: "Diverifikasi",
                          diproses: "Diproses",
                          selesai: "Selesai",
                          ditolak: "Ditolak",
                        }[status]
                      }
                    </option>
                  ))}
                </select>
                {!canDispatch ? (
                  <p className="mt-1 text-xs text-muted">
                    Petugas dinas hanya dapat memproses atau menyelesaikan laporan instansinya.
                  </p>
                ) : null}
              </div>

              {targetIsReject ? (
                <div>
                  <label htmlFor="action-reply" className="field-label">
                    Alasan penolakan (dikirim ke pelapor)
                    <span className="ml-1 text-status-ditolak-fg" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <textarea
                    id="action-reply"
                    rows={4}
                    maxLength={2000}
                    className="field-input py-3"
                    value={form.reply}
                    onChange={(event) => updateForm("reply", event.target.value)}
                    placeholder="Jelaskan alasan laporan ditolak agar pelapor memahaminya..."
                    aria-required="true"
                  />
                  <p className="mt-1 text-right text-xs text-muted">{form.reply.length} / 2000</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="action-reply" className="field-label">
                    Balasan untuk pelapor (publik)
                  </label>
                  <textarea
                    id="action-reply"
                    rows={4}
                    maxLength={2000}
                    className="field-input py-3"
                    value={form.reply}
                    onChange={(event) => updateForm("reply", event.target.value)}
                    placeholder="Tanggapan ini terlihat oleh pelapor dan tersimpan di riwayat publik..."
                  />
                  <p className="mt-1 text-right text-xs text-muted">{form.reply.length} / 2000</p>
                </div>
              )}

              <div>
                <label htmlFor="action-agency" className="field-label">
                  Disposisi ke instansi
                </label>
                <select
                  id="action-agency"
                  className="field-input pr-9"
                  value={form.agencyId}
                  onChange={(event) => updateForm("agencyId", event.target.value)}
                  disabled={!canDispatch || saving}
                >
                  <option value="">Belum ditentukan</option>
                  {agencies.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="action-priority" className="field-label">
                  Prioritas
                </label>
                <select
                  id="action-priority"
                  className="field-input pr-9"
                  value={form.priority}
                  onChange={(event) => updateForm("priority", event.target.value)}
                  disabled={!canDispatch || saving}
                >
                  {PRIORITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {!canDispatch ? (
                  <p className="mt-1 text-xs text-muted">
                    Hanya verifikator dan super admin yang dapat mengubah instansi dan prioritas.
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="action-note" className="field-label">
                  Catatan internal
                </label>
                <textarea
                  id="action-note"
                  rows={3}
                  maxLength={2000}
                  className="field-input border-dashed py-3"
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  placeholder="Hanya terlihat oleh admin, tidak dikirim ke pelapor..."
                />
                <p className="mt-1 text-xs text-muted">Catatan ini tidak tampil di halaman warga.</p>
              </div>

              {formError ? <Alert tone="error">{formError}</Alert> : null}
              {notice ? <Alert tone="success">{notice}</Alert> : null}

              {confirmFinal ? (
                <div className="rounded-btn border border-status-diproses-fg/30 bg-status-diproses-bg/50 p-3 text-xs text-ink">
                  <p className="font-semibold">
                    Status{" "}
                    <span className="uppercase">{form.status}</span> bersifat final dan tidak dapat diubah lagi. Lanjutkan?
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Button type="submit" className="flex-1" disabled={saving}>
                      {saving ? "Menyimpan..." : "Ya, Simpan"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmFinal(false)}
                      disabled={saving}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              )}
            </form>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-extrabold text-navy">Penilaian Pelapor</h2>
            {report.rating ? (
              <div className="mt-3">
                <div
                  className="flex items-center gap-1 text-gold"
                  role="img"
                  aria-label={`Penilaian ${report.rating.score} dari 5 bintang`}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <StarIcon key={value} filled={value <= report.rating.score} />
                  ))}
                  <span className="ml-1 text-sm font-bold text-navy">
                    {report.rating.score} / 5
                  </span>
                </div>
                {report.rating.aspects.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {report.rating.aspects.map((aspect) => (
                      <li
                        key={aspect}
                        className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink"
                      >
                        {aspect}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {report.rating.comment ? (
                  <p className="mt-3 rounded-btn bg-surface px-3 py-2 text-sm leading-relaxed text-ink">
                    {report.rating.comment}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted">
                  Dikirim {formatDateTime(report.rating.created_at)}.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Belum ada penilaian. Penilaian tersedia setelah status laporan Selesai (skor 1–5
                dan komentar).
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
