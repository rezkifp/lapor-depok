import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  Alert,
  Field,
  PasswordInput,
  PasswordStrength,
  Select,
  TextInput,
} from "../../components/form";
import AuthLayout from "../../layouts/AuthLayout";
import { api, ApiError } from "../../lib/api";

const EMPTY_FORM = {
  name: "",
  nik: "",
  email: "",
  phone: "",
  address: "",
  rt: "",
  rw: "",
  kecamatan_id: "",
  kelurahan_id: "",
  password: "",
  confirm: "",
};

function validate(form, terms) {
  const errors = {};

  if (form.name.trim().length < 3) errors.name = "Nama minimal 3 karakter.";
  if (!/^\d{16}$/.test(form.nik)) errors.nik = "NIK harus 16 digit angka.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Format email tidak valid.";
  }
  if (!/^[0-9+\-\s]{8,20}$/.test(form.phone.trim())) {
    errors.phone = "Nomor HP tidak valid (8-20 digit/karakter).";
  }
  if (form.address.trim().length < 5) errors.address = "Alamat minimal 5 karakter.";
  if (!/^\d{1,3}$/.test(form.rt)) errors.rt = "RT 1-3 digit angka.";
  if (!/^\d{1,3}$/.test(form.rw)) errors.rw = "RW 1-3 digit angka.";
  if (!form.kecamatan_id) errors.kecamatan_id = "Pilih kecamatan.";
  if (!form.kelurahan_id) errors.kelurahan_id = "Pilih kelurahan.";
  if (form.password.length < 8) errors.password = "Kata sandi minimal 8 karakter.";
  if (form.confirm !== form.password) errors.confirm = "Ulangi kata sandi belum sama.";
  if (!terms) errors.terms = "Centang persetujuan untuk melanjutkan.";

  return errors;
}

export default function Daftar() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";

  const [form, setForm] = useState(EMPTY_FORM);
  const [terms, setTerms] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/master/districts")
      .then((rows) => {
        if (active) setDistricts(rows);
      })
      .catch(() => {
        if (active) setServerError("Daftar kecamatan gagal dimuat. Muat ulang halaman ini.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!form.kecamatan_id) {
      setVillages([]);
      return undefined;
    }
    let active = true;
    api
      .get(`/master/villages?district_id=${form.kecamatan_id}`)
      .then((rows) => {
        if (active) setVillages(rows);
      })
      .catch(() => {
        if (active) setServerError("Daftar kelurahan gagal dimuat. Coba pilih kecamatan lagi.");
      });
    return () => {
      active = false;
    };
  }, [form.kecamatan_id]);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "kecamatan_id" ? { kelurahan_id: "" } : {}),
    }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setServerError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError("");
    setNotice("");
    const validation = validate(form, terms);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      document.getElementById("daftar-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.post("/auth/register", {
        name: form.name.trim(),
        nik: form.nik,
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        rt: form.rt,
        rw: form.rw,
        kecamatan_id: Number(form.kecamatan_id),
        kelurahan_id: Number(form.kelurahan_id),
        password: form.password,
      });
      setSentEmail(data.email ?? form.email.trim());
    } catch (err) {
      setServerError(err.message);
      if (err instanceof ApiError && err.code === "account_exists") {
        setErrors({ email: err.message, nik: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setNotice("");
    setServerError("");
    setResending(true);
    try {
      const data = await api.post("/auth/resend-verification", { email: sentEmail });
      setNotice(data.message);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setResending(false);
    }
  };

  if (sentEmail) {
    return (
      <AuthLayout
        eyebrow="Pendaftaran Warga"
        title="Buat akun Lapor Depok"
        description="Data identitas diperlukan agar laporan dapat dipertanggungjawabkan. Data Anda dijaga sesuai kebijakan privasi."
      >
        <div className="py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-selesai-bg text-status-selesai-fg">
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-navy">Periksa email Anda</h2>
          <p className="mt-2 text-sm text-muted">
            Kami mengirim tautan verifikasi ke{" "}
            <span className="font-semibold text-ink">{sentEmail}</span>.
          </p>
          <p className="mt-1 text-xs text-muted">
            Tautan berlaku 24 jam. Setelah email diverifikasi, Anda bisa masuk.
          </p>

          {notice ? (
            <div className="mt-4 text-left">
              <Alert tone="success">{notice}</Alert>
            </div>
          ) : null}
          {serverError ? (
            <div className="mt-4 text-left">
              <Alert tone="error">{serverError}</Alert>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={handleResend} disabled={resending} className="btn-outline">
              {resending ? "Mengirim..." : "Kirim ulang verifikasi"}
            </button>
            <Link to={`/masuk${suffix}`} className="btn-primary">
              Ke halaman masuk
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Pendaftaran Warga"
      title="Buat akun Lapor Depok"
      description="Data identitas diperlukan agar laporan dapat dipertanggungjawabkan. Data Anda dijaga sesuai kebijakan privasi."
      wide
      centered={false}
    >
      <h2 className="text-center text-2xl font-extrabold text-navy">Daftar</h2>
      <p className="mt-1 text-center text-sm text-muted">
        Lengkapi data diri sesuai KTP. NIK tidak dapat diubah setelah mendaftar.
      </p>

      <form id="daftar-form" className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}

        <Field label="Nama lengkap (sesuai KTP)" htmlFor="name" required error={errors.name}>
          <TextInput
            id="name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={update("name")}
            error={errors.name}
            required
          />
        </Field>

        <Field
          label="NIK (16 digit)"
          htmlFor="nik"
          required
          error={errors.nik}
          hint="Contoh: 3276xxxxxxxxxxxx"
        >
          <TextInput
            id="nik"
            name="nik"
            inputMode="numeric"
            maxLength={16}
            autoComplete="off"
            value={form.nik}
            onChange={update("nik")}
            error={errors.nik}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" required error={errors.email}>
            <TextInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              error={errors.email}
              required
            />
          </Field>
          <Field label="No. HP" htmlFor="phone" required error={errors.phone}>
            <TextInput
              id="phone"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xx xxxx xxxx"
              value={form.phone}
              onChange={update("phone")}
              error={errors.phone}
              required
            />
          </Field>
        </div>

        <Field label="Alamat jalan" htmlFor="address" required error={errors.address}>
          <TextInput
            id="address"
            name="address"
            autoComplete="street-address"
            placeholder="Nama jalan dan nomor rumah"
            value={form.address}
            onChange={update("address")}
            error={errors.address}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="RT" htmlFor="rt" required error={errors.rt}>
            <TextInput
              id="rt"
              name="rt"
              inputMode="numeric"
              maxLength={3}
              placeholder="001"
              value={form.rt}
              onChange={update("rt")}
              error={errors.rt}
              required
            />
          </Field>
          <Field label="RW" htmlFor="rw" required error={errors.rw}>
            <TextInput
              id="rw"
              name="rw"
              inputMode="numeric"
              maxLength={3}
              placeholder="005"
              value={form.rw}
              onChange={update("rw")}
              error={errors.rw}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kecamatan" htmlFor="kecamatan_id" required error={errors.kecamatan_id}>
            <Select
              id="kecamatan_id"
              name="kecamatan_id"
              value={form.kecamatan_id}
              onChange={update("kecamatan_id")}
              error={errors.kecamatan_id}
              required
            >
              <option value="">Pilih kecamatan</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kelurahan" htmlFor="kelurahan_id" required error={errors.kelurahan_id}>
            <Select
              id="kelurahan_id"
              name="kelurahan_id"
              value={form.kelurahan_id}
              onChange={update("kelurahan_id")}
              error={errors.kelurahan_id}
              disabled={!form.kecamatan_id}
              required
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Kata sandi"
            htmlFor="password"
            required
            error={errors.password}
            hint="Minimal 8 karakter."
          >
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              error={errors.password}
              required
            />
            <PasswordStrength password={form.password} />
          </Field>
          <Field label="Ulangi kata sandi" htmlFor="confirm" required error={errors.confirm}>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              value={form.confirm}
              onChange={update("confirm")}
              error={errors.confirm}
              required
            />
          </Field>
        </div>

        <p className="text-xs text-muted">
          Kami mengirim tautan verifikasi ke email Anda. Tidak ada kode OTP lewat SMS.
        </p>

        <div>
          <label className="flex items-start gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => {
                setTerms(event.target.checked);
                setErrors((previous) => ({ ...previous, terms: "" }));
              }}
              className="mt-0.5 h-4 w-4 rounded border-line"
              style={{ accentColor: "var(--color-gold)" }}
            />
            <span>
              Saya menyetujui{" "}
              <Link to="/syarat-ketentuan" className="link">
                Syarat &amp; Ketentuan
              </Link>{" "}
              dan{" "}
              <Link to="/kebijakan-privasi" className="link">
                Kebijakan Privasi
              </Link>
              .
            </span>
          </label>
          {errors.terms ? (
            <p className="mt-1.5 text-xs font-medium text-status-ditolak-fg" role="alert">
              {errors.terms}
            </p>
          ) : null}
        </div>

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Mendaftar..." : "Daftar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link to={`/masuk${suffix}`} className="link">
          Masuk
        </Link>
      </p>
    </AuthLayout>
  );
}
