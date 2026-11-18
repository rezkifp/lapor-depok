import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Alert, Field, PasswordInput, PasswordStrength } from "../../components/form";
import AuthLayout from "../../layouts/AuthLayout";
import { api } from "../../lib/api";

export default function ResetSandi() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Ulangi kata sandi belum sama.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset", { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Reset kata sandi"
      title="Buat kata sandi baru"
      description="Pilih kata sandi yang kuat dan tidak dipakai di layanan lain."
    >
      <h2 className="text-2xl font-extrabold text-navy">Kata sandi baru</h2>

      {success ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">
            Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru Anda.
          </Alert>
          <Link to="/masuk" className="btn-primary w-full">
            Masuk
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          {!token ? (
            <Alert tone="error">
              Tautan reset tidak valid. Minta tautan baru dari halaman lupa kata sandi.
            </Alert>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label="Kata sandi baru" htmlFor="password" required>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <PasswordStrength password={password} />
          </Field>

          <Field label="Ulangi kata sandi baru" htmlFor="confirm" required>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting || !token}
          >
            {submitting ? "Menyimpan..." : "Simpan kata sandi"}
          </button>

          <p className="text-center text-sm text-muted">
            <Link to="/lupa-sandi" className="link">
              Minta tautan baru
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
