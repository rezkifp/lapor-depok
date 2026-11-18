import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Alert, Field, PasswordInput, TextInput } from "../../components/form";
import AuthLayout from "../../layouts/AuthLayout";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { homeForRole, safeNext } from "../../lib/format";

export default function Masuk() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  if (!loading && user) {
    return <Navigate to={safeNext(next, homeForRole(user.role))} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password);
      navigate(safeNext(next, homeForRole(loggedIn.role)), { replace: true });
    } catch (err) {
      setError(err.message);
      if (err instanceof ApiError && err.code === "email_not_verified") {
        setNeedsVerification(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Isi email Anda terlebih dahulu, lalu klik kirim ulang verifikasi.");
      return;
    }
    setResending(true);
    try {
      const data = await api.post("/auth/resend-verification", { email: email.trim() });
      setNotice(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Masuk"
      title="Lapor Depok"
      description="Masuk untuk membuat laporan, memantau status tiket, dan memberi penilaian layanan."
    >
      <h2 className="text-center text-2xl font-extrabold text-navy">Masuk</h2>
      <p className="mt-1 text-center text-sm text-muted">Gunakan email dan kata sandi akun Anda.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        {error ? (
          <Alert tone="error">
            <p>{error}</p>
            {needsVerification ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-60"
              >
                {resending ? "Mengirim..." : "Kirim ulang verifikasi"}
              </button>
            ) : null}
          </Alert>
        ) : null}

        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <Field label="Email" htmlFor="email" required>
          <TextInput
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field label="Kata sandi" htmlFor="password" required>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        <div className="flex justify-end">
          <Link to="/lupa-sandi" className="link text-sm">
            Lupa kata sandi?
          </Link>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Belum punya akun?{" "}
        <Link to={`/daftar${suffix}`} className="link">
          Daftar sebagai warga
        </Link>
      </p>
    </AuthLayout>
  );
}
