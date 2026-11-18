import { useState } from "react";
import { Link } from "react-router-dom";

import { Alert, Field, TextInput } from "../../components/form";
import AuthLayout from "../../layouts/AuthLayout";
import { api } from "../../lib/api";

export default function LupaSandi() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const data = await api.post("/auth/forgot", { email: email.trim() });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Lupa kata sandi"
      title="Atur ulang kata sandi"
      description="Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru."
    >
      <h2 className="text-2xl font-extrabold text-navy">Lupa kata sandi</h2>
      <p className="mt-1 text-sm text-muted">
        Tautan reset berlaku 1 jam dan hanya bisa dipakai sekali.
      </p>

      {message ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">{message}</Alert>
          <p className="text-sm text-muted">
            Periksa kotak masuk dan folder spam. Jika dalam beberapa menit email belum datang,
            coba lagi.
          </p>
          <Link to="/masuk" className="btn-primary w-full">
            Kembali ke halaman masuk
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Email" htmlFor="email" required>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Mengirim..." : "Kirim tautan"}
          </button>
          <p className="text-center text-sm text-muted">
            Ingat kata sandi?{" "}
            <Link to="/masuk" className="link">
              Masuk
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
