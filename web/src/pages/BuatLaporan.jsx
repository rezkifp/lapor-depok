import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import MapPicker from "../components/MapPicker";
import WizardChrome from "../components/WizardChrome";
import { Alert, Button, Field, Select, TextArea, TextInput } from "../components/form";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { maskNik, maskPhone } from "../lib/format";

const DRAFT_KEY = "lapor-depok.draft";
const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];

const EMPTY_DRAFT = {
  type: "pengaduan",
  category_id: "",
  agency_id: "",
  priority: "biasa",
  title: "",
  body: "",
  incident_date: "",
  district_id: "",
  village_id: "",
  address: "",
  lat: null,
  lng: null,
  privacy: "rahasia",
};

const TYPE_OPTIONS = [
  {
    value: "pengaduan",
    label: "Pengaduan",
    text: "Keluhan atau permintaan perbaikan layanan pemerintah.",
  },
  {
    value: "aspirasi",
    label: "Aspirasi",
    text: "Ide atau usulan pembangunan dan perbaikan kota.",
  },
  {
    value: "informasi",
    label: "Permintaan Informasi",
    text: "Permintaan informasi publik atau data pemerintah.",
  },
];

const PRIVACY_OPTIONS = [
  { value: "tampil", title: "Tampilkan identitas", text: "Nama Anda tampil di laporan publik." },
  {
    value: "rahasia",
    title: "Rahasiakan",
    text: "Nama Anda tidak tampil di publik. Admin dan petugas dinas terkait tetap dapat melihat identitas Anda.",
  },
  {
    value: "anonim",
    title: "Anonim",
    text: "Nama Anda tidak tampil di publik dan disembunyikan dari verifikator serta petugas dinas. Hanya super admin yang dapat melihatnya. Notifikasi tetap dikirim ke email akun Anda.",
  },
];

const NEXT_LABELS = {
  1: "Lanjut",
  2: "Lanjut",
  3: "Lanjut",
};

function loadDraft() {
  const fallback = { ...EMPTY_DRAFT };
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function BuatLaporan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedStep = Number(searchParams.get("step"));
  const [step, setStep] = useState(
    Number.isInteger(parsedStep) && parsedStep >= 1 && parsedStep <= 4 ? parsedStep : 1,
  );
  const [draft, setDraft] = useState(loadDraft);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState({ laporan: false, privasi: false });
  const [categories, setCategories] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  useEffect(() => {
    let active = true;
    api.get("/master/categories").then(setCategories).catch(() => {});
    api.get("/master/agencies").then(setAgencies).catch(() => {});
    api.get("/master/districts").then(setDistricts).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draft.district_id) {
      setVillages([]);
      return undefined;
    }
    let active = true;
    api
      .get(`/master/villages?district_id=${draft.district_id}`)
      .then((data) => {
        if (active) setVillages(data);
      })
      .catch(() => {
        if (active) setVillages([]);
      });
    return () => {
      active = false;
    };
  }, [draft.district_id]);

  useEffect(() => {
    const raw = Number(searchParams.get("step"));
    if (Number.isInteger(raw) && raw >= 1 && raw <= 4) setStep(raw);
  }, [searchParams]);

  const update = (patch, errorKey) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        /* localStorage bisa diblokir */
      }
      return next;
    });
    if (errorKey) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[errorKey];
        return copy;
      });
    }
  };

  const set = (key, value) => update({ [key]: value }, key);

  const pickCategory = (id) => {
    const category = categories.find((item) => String(item.id) === String(id));
    update(
      {
        category_id: id,
        agency_id: category && category.default_agency_id ? String(category.default_agency_id) : "",
      },
      "category_id",
    );
  };

  const pickDistrict = (id) => {
    update({ district_id: id, village_id: "" }, "district_id");
  };

  const validateStep = (target) => {
    const errs = {};
    if (target === 1) {
      if (!draft.type) errs.type = "Pilih jenis laporan.";
      if (!draft.category_id) errs.category_id = "Pilih kategori laporan.";
      if (!draft.agency_id) errs.agency_id = "Pilih instansi tujuan.";
      return errs;
    }
    if (target === 2) {
      const title = draft.title.trim();
      if (!title) errs.title = "Judul laporan wajib diisi.";
      else if (title.length < 10) errs.title = "Judul laporan minimal 10 karakter.";
      else if (title.length > 100) errs.title = "Judul laporan maksimal 100 karakter.";
      const body = draft.body.trim();
      if (!body) errs.body = "Uraian laporan wajib diisi.";
      else if (body.length < 30) errs.body = "Uraian laporan minimal 30 karakter.";
      else if (body.length > 2000) errs.body = "Uraian laporan maksimal 2000 karakter.";
      if (!draft.incident_date) errs.incident_date = "Pilih tanggal kejadian.";
      else if (draft.incident_date > todayIso()) errs.incident_date = "Tanggal kejadian tidak boleh di masa depan.";
      if (!draft.district_id) errs.district_id = "Pilih kecamatan.";
      if (!draft.village_id) errs.village_id = "Pilih kelurahan.";
      if (draft.address.trim().length < 5) errs.address = "Alamat atau patokan lokasi minimal 5 karakter.";
      if (files.length > MAX_FILES) errs.attachments = `Maksimal ${MAX_FILES} lampiran.`;
      return errs;
    }
    if (target === 3) {
      if (!draft.privacy) errs.privacy = "Pilih tingkat privasi laporan.";
      return errs;
    }
    return {};
  };

  const pickFiles = (list) => {
    const next = [...files];
    let message = null;
    for (const picked of Array.from(list || [])) {
      const ext = "." + (picked.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        message = `File ${picked.name} tidak didukung. Lampiran harus JPG, PNG, atau PDF.`;
        break;
      }
      if (picked.size > MAX_FILE_BYTES) {
        message = `File ${picked.name} melebihi batas ukuran 5 MB.`;
        break;
      }
      if (next.length >= MAX_FILES) {
        message = `Maksimal ${MAX_FILES} lampiran.`;
        break;
      }
      next.push({ id: `${picked.name}:${picked.size}:${picked.lastModified}`, file: picked, name: picked.name, size: picked.size, type: picked.type });
    }
    setFiles(next);
    if (message) setErrors((prev) => ({ ...prev, attachments: message }));
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const submit = async () => {
    const errs = validateStep(step);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      window.scrollTo(0, 0);
      return;
    }
    if (step === 4 && (!agreed.laporan || !agreed.privasi)) {
      setErrors({ consent: "Centang kedua persetujuan sebelum mengirim laporan." });
      return;
    }
    setSubmitting(true);
    setAlert(null);
    const formData = new FormData();
    formData.append("type", draft.type);
    formData.append("category_id", String(draft.category_id));
    if (draft.agency_id) formData.append("agency_id", String(draft.agency_id));
    formData.append("priority", draft.priority);
    formData.append("title", draft.title.trim());
    formData.append("body", draft.body.trim());
    formData.append("incident_date", draft.incident_date);
    formData.append("district_id", String(draft.district_id));
    formData.append("village_id", String(draft.village_id));
    formData.append("address", draft.address.trim());
    if (draft.lat != null) {
      formData.append("lat", String(draft.lat));
      formData.append("lng", String(draft.lng));
    }
    formData.append("privacy", draft.privacy);
    for (const item of files) {
      formData.append("attachments", item.file, item.file.name);
    }
    try {
      const result = await api.post("/reports", formData);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* abaikan */
      }
      navigate(`/lapor/sukses/${result.ticket_no}`);
      return;
    } catch (error) {
      setAlert({ tone: "error", message: error.message });
      return;
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    const errs = validateStep(step);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      window.scrollTo(0, 0);
      return;
    }
    if (step >= 4) {
      void submit();
      return;
    }
    setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) {
      setErrors({});
      setStep(step - 1);
    }
    window.scrollTo(0, 0);
  };

  const showError = (key) => errors[key] ?? null;
  const primaryLabel = submitting ? "Mengirim Laporan..." : "Kirim Laporan";
  const categoryName = categories.find((item) => String(item.id) === String(draft.category_id))?.name ?? "-";
  const agencyName = agencies.find((item) => String(item.id) === String(draft.agency_id))?.name ?? "-";
  const locationLine = draft.address.trim() || "-";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <WizardChrome step={step} />

      <div className="card mt-6 p-5 sm:p-7">
        {step === 1 ? (
          <div className="space-y-6">
            <Field label="Jenis Laporan" required error={showError("type")}>
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Jenis laporan">
                {TYPE_OPTIONS.map((option) => {
                  const selected = draft.type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => set("type", option.value)}
                      className={`min-h-24 rounded-card border px-4 py-3 text-left transition ${
                        selected ? "border-blue bg-blue/5" : "border-line bg-white"
                      }`}
                    >
                      <span className="block text-sm font-bold text-navy">{option.label}</span>
                      <span className="mt-1 block text-xs leading-snug text-muted">{option.text}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Kategori Laporan" required error={showError("category_id")}>
              <Select
                id="lapor-kategori"
                className="pr-9"
                value={draft.category_id}
                onChange={(event) => pickCategory(event.target.value)}
              >
                <option value="">Pilih kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Instansi Tujuan" required error={showError("agency_id")}>
              <Select
                id="lapor-agensi"
                className="pr-9"
                value={draft.agency_id}
                onChange={(event) => set("agency_id", event.target.value)}
              >
                <option value="">Pilih instansi</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Prioritas" hint="Gunakan prioritas mendesarkan untuk kecepatan penanganan.">
              <div className="grid grid-cols-2 gap-3">
                {["biasa", "mendesak"].map((priority) => {
                  const selected = draft.priority === priority;
                  return (
                    <button
                      key={priority}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => set("priority", priority)}
                      className={`min-h-12 rounded-card border px-4 py-3 text-sm font-bold transition ${
                        selected ? "border-blue bg-blue/5 text-blue" : "border-line bg-white text-ink"
                      }`}
                    >
                      {priority === "biasa" ? "Biasa" : "Mendesak"}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <Field label="Judul Laporan" required error={showError("title")}>
              <TextInput
                id="lapor-judul"
                value={draft.title}
                maxLength={100}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Singkat dan jelas, misalnya: Penerangan listrik di RT 01"
              />
              <p className="mt-1.5 text-xs text-muted">Karakter: {draft.title.trim().length}/100</p>
            </Field>

            <Field label="Uraian Laporan" required error={showError("body")}>
              <TextArea
                id="lapor-uraian"
                rows={6}
                maxLength={2000}
                value={draft.body}
                onChange={(event) => set("body", event.target.value)}
                placeholder="Jelaskan kronologi, lokasi, dan dampaknya secara faktual."
              />
              <p className="mt-1.5 text-xs text-muted">Karakter: {draft.body.trim().length}/2000</p>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal Kejadian" required error={showError("incident_date")}>
                <TextInput
                  id="lapor-tanggal"
                  type="date"
                  max={todayIso()}
                  value={draft.incident_date}
                  onChange={(event) => set("incident_date", event.target.value)}
                />
              </Field>
              <Field label="Alamat / Patokan Lokasi" required error={showError("address")}>
                <TextInput
                  id="lapor-alamat"
                  value={draft.address}
                  maxLength={255}
                  onChange={(event) => set("address", event.target.value)}
                  placeholder="Jl. ..., RT/RW, nama gang"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kecamatan" required error={showError("district_id")}>
                <Select
                  id="lapor-kecamatan"
                  className="pr-9"
                  value={draft.district_id}
                  onChange={(event) => pickDistrict(event.target.value)}
                >
                  <option value="">Pilih kecamatan</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kelurahan" required error={showError("village_id")}>
                <Select
                  id="lapor-kelurahan"
                  className="pr-9"
                  value={draft.village_id}
                  onChange={(event) => set("village_id", event.target.value)}
                >
                  <option value="">Pilih kelurahan</option>
                  {villages.map((village) => (
                    <option key={village.id} value={village.id}>
                      {village.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Lokasi di Peta" hint="Opsional. Klik atau geser pin untuk menandai lokasi laporan.">
              <MapPicker
                lat={draft.lat}
                lng={draft.lng}
                onChange={(next) => update({ lat: next?.lat ?? null, lng: next?.lng ?? null }, "lat")}
              />
            </Field>

            <Field label="Lampiran Bukti" error={showError("attachments")}>
              <div className="rounded-card border border-dashed border-line bg-surface p-4 text-center">
                <label htmlFor="lapor-lampiran" className="btn-outline inline-flex min-h-44 cursor-pointer items-center justify-center rounded-btn border border-navy px-6 py-3 text-sm font-semibold text-navy">
                  Pilih atau seret file ke sini
                </label>
                <input
                  id="lapor-lampiran"
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) pickFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-muted">Maksimal 3 file, masing-masing maksimal 5 MB. JPG, PNG, atau PDF.</p>
              </div>
              {files.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {files.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-btn border border-line bg-white px-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-ink">{item.name}</span>
                      <span className="shrink-0 text-xs text-muted">{(item.size / 1024).toFixed(0)} KB</span>
                      <button type="button" className="shrink-0 text-xs font-bold text-status-ditolak-fg hover:underline" onClick={() => removeFile(item.id)}>
                        Hapus
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Field>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div className="rounded-card border border-line bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-navy">Data Pelapor</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Nama</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{user?.name ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">NIK</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{maskNik(user?.nik_last4)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Nomor HP</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{maskPhone(user?.phone) || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Status Verifikasi</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{user?.email_verified ? "Terverifikasi" : "Belum terverifikasi"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">Alamat Domisili</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{user?.address || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">RT / RW</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{`${user?.rt ?? "-"} / ${user?.rw ?? "-"}`}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Kecamatan</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{user?.kecamatan?.name ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Kelurahan</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{user?.kelurahan?.name ?? "-"}</dd>
                </div>
              </dl>
              {(!user?.address || !user?.kecamatan || !user?.kelurahan) ? (
                <div className="mt-4">
                  <Alert tone="info">
                    Alamat domisili Anda belum lengkap. Data alamat dipakai untuk keperluan tindak lanjut.
                    <Link to="/profil?next=/lapor" className="link">
                      Perbarui data di profil
                    </Link>
                    .
                  </Alert>
                </div>
              ) : null}
            </div>

            <Field label="Privasi Laporan" required error={showError("privacy")}>
              <div className="space-y-3">
                {PRIVACY_OPTIONS.map((option) => {
                  const selected = draft.privacy === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => set("privacy", option.value)}
                      className={`min-h-16 rounded-card border px-4 py-3 text-left transition ${
                        selected ? "border-blue bg-blue/5" : "border-line bg-white"
                      }`}
                    >
                      <span className="block text-sm font-bold text-navy">{option.title}</span>
                      <span className="mt-1 block text-sm text-muted">{option.text}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <div className="rounded-card border border-line bg-white p-5">
              <h2 className="text-base font-bold text-navy">Ringkasan Laporan</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Jenis</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{draft.type ? TYPE_OPTIONS.find((item) => item.value === draft.type)?.label : "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Kategori</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{categoryName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Instansi</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{agencyName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Judul</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{draft.title || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Tanggal Kejadian</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{draft.incident_date || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Lokasi</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{locationLine || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Lampiran</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{files.length > 0 ? `${files.length} file` : "Tidak ada"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Privasi</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{PRIVACY_OPTIONS.find((item) => item.value === draft.privacy)?.title ?? draft.privacy}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-card border border-line bg-white p-5">
              <label className="flex min-h-11 items-start gap-3 rounded-btn border border-line px-4 py-3">
                <input
                  type="checkbox"
                  checked={agreed.laporan}
                  onChange={(event) => setAgreed((prev) => ({ ...prev, laporan: event.target.checked }))}
                  className="mt-1 h-4 w-4 accent-[#1D5FD1]"
                />
                <span className="text-sm text-ink">Saya menyatakan bahwa isi laporan saya akurat dan dapat saya pertanggungjawabkan.</span>
              </label>
              <label className="mt-3 flex min-h-11 items-start gap-3 rounded-btn border border-line px-4 py-3">
                <input
                  type="checkbox"
                  checked={agreed.privasi}
                  onChange={(event) => setAgreed((prev) => ({ ...prev, privasi: event.target.checked }))}
                  className="mt-1 h-4 w-4 accent-[#1D5FD1]"
                />
                <span className="text-sm text-ink">
                  Saya menyetujui pemrosesan data pribadi untuk keperluan penanganan laporan, termasuk penyimpanan lampiran. Baca{" "}
                  <Link to="/kebijakan-privasi" className="link">
                    Kebijakan Privasi
                  </Link>
                  .
                </span>
              </label>
              {errors.consent ? (
                <p className="mt-2 text-xs font-medium text-status-ditolak-fg" role="alert">
                  {errors.consent}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <Button variant="outline" type="button" onClick={goBack} className="w-auto">
              Kembali
            </Button>
          ) : (
            <Button variant="outline" type="button" onClick={() => navigate("/")}>
              Batal
            </Button>
          )}
          {step < 4 ? (
            <Button type="button" onClick={goNext} className="min-h-control">
              Lanjut
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting} className="min-h-control">
              {primaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


