import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  Alert,
  Field,
  Select,
  TextInput,
} from "../components/form";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { maskNik, safeNext } from "../lib/format";

const EMPTY = {
  name: "",
  phone: "",
  address: "",
  rt: "",
  rw: "",
  kecamatan_id: "",
  kelurahan_id: "",
};

function toForm(user) {
  return {
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    rt: user?.rt ?? "",
    rw: user?.rw ?? "",
    kecamatan_id: user?.kecamatan?.id ? String(user.kecamatan.id) : "",
    kelurahan_id: user?.kelurahan?.id ? String(user.kelurahan.id) : "",
  };
}

function validate(form) {
  const errors = {};
  if (form.name.trim().length < 3) errors.name = "Nama minimal 3 karakter.";
  if (!/^[0-9+\-\s]{8,20}$/.test(form.phone.trim())) {
    errors.phone = "Nomor HP tidak valid (8-20 digit/karakter).";
  }
  if (form.address.trim().length < 5) errors.address = "Alamat minimal 5 karakter.";
  if (!/^\d{1,3}$/.test(form.rt)) errors.rt = "RT 1-3 digit angka.";
  if (!/^\d{1,3}$/.test(form.rw)) errors.rw = "RW 1-3 digit angka.";
  if (!form.kecamatan_id) errors.kecamatan_id = "Pilih kecamatan.";
  if (!form.kelurahan_id) errors.kelurahan_id = "Pilih kelurahan.";
  return errors;
}

export default function Profil() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");

  const [form, setForm] = useState(() => toForm(user) ?? EMPTY);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(toForm(user) ?? EMPTY);
  }, [user]);

  useEffect(() => {
    let active = true;
    api
      .get("/master/districts")
      .then((rows) => {
        if (active) setDistricts(rows);
      })
      .catch(() => {
        if (active) setError("Daftar kecamatan gagal dimuat. Muat ulang halaman ini.");
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
        if (active) setError("Daftar kelurahan gagal dimuat. Coba pilih kecamatan lagi.");
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
    setError("");
    setNotice("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      const data = await api.patch("/me", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        rt: form.rt,
        rw: form.rw,
        kecamatan_id: Number(form.kecamatan_id),
        kelurahan_id: Number(form.kelurahan_id),
      });
      updateUser(data.user);
      if (next) {
        navigate(safeNext(next, "/profil"), { replace: true });
        return;
      }
      setNotice("Profil berhasil diperbarui.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Akun Warga</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Profil</h1>
          <p className="mt-1 text-sm text-muted">
            Data domisili dipakai untuk mengisi alamat laporan secara otomatis.
          </p>
        </div>
        <Link to="/laporan-saya" className="btn-outline px-5">
          Laporan Saya
        </Link>
      </div>

      {next ? (
        <div className="mt-4">
          <Alert tone="info">
            Perbarui data domisili Anda dulu. Setelah disimpan, Anda kembali ke halaman laporan.
          </Alert>
        </div>
      ) : null}

      <form className="card mt-6 p-5 sm:p-7" onSubmit={handleSubmit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? (
          <div className="mb-4">
            <Alert tone="success">{notice}</Alert>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nama lengkap" htmlFor="name" required error={errors.name}>
            <TextInput
              id="name"
              autoComplete="name"
              value={form.name}
              onChange={update("name")}
              error={errors.name}
              required
            />
          </Field>

          <Field
            label="NIK"
            htmlFor="nik"
            hint="NIK tidak dapat diubah. Hanya 4 digit terakhir yang ditampilkan."
          >
            <TextInput id="nik" value={maskNik(user.nik_last4)} readOnly disabled />
          </Field>

          <Field label="Email" htmlFor="email" hint="Email tidak dapat diubah dari halaman ini.">
            <div className="flex flex-wrap items-center gap-2">
              <TextInput id="email" value={user.email} readOnly disabled className="flex-1" />
              <span
                className={`chip ${
                  user.email_verified
                    ? "bg-status-selesai-bg text-status-selesai-fg"
                    : "bg-status-diproses-bg text-status-diproses-fg"
                }`}
              >
                {user.email_verified ? "Terverifikasi" : "Belum verifikasi"}
              </span>
            </div>
          </Field>

          <Field label="No. HP" htmlFor="phone" required error={errors.phone}>
            <TextInput
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={update("phone")}
              error={errors.phone}
              required
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Alamat jalan" htmlFor="address" required error={errors.address}>
              <TextInput
                id="address"
                autoComplete="street-address"
                value={form.address}
                onChange={update("address")}
                error={errors.address}
                required
              />
            </Field>
          </div>

          <Field label="RT" htmlFor="rt" required error={errors.rt}>
            <TextInput
              id="rt"
              inputMode="numeric"
              maxLength={3}
              value={form.rt}
              onChange={update("rt")}
              error={errors.rt}
              required
            />
          </Field>

          <Field label="RW" htmlFor="rw" required error={errors.rw}>
            <TextInput
              id="rw"
              inputMode="numeric"
              maxLength={3}
              value={form.rw}
              onChange={update("rw")}
              error={errors.rw}
              required
            />
          </Field>

          <Field label="Kecamatan" htmlFor="kecamatan_id" required error={errors.kecamatan_id}>
            <Select
              id="kecamatan_id"
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

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Link to={next ? safeNext(next, "/") : "/"} className="btn-outline sm:order-1">
            Batal
          </Link>
          <button type="submit" className="btn-primary sm:order-2" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>

      <p className="mt-4 text-xs text-muted">
        Ganti kata sandi akan tersedia di pembaruan berikutnya. Untuk saat ini, gunakan menu lupa
        kata sandi dari halaman masuk.
      </p>
    </div>
  );
}
