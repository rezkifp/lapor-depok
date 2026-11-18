import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Alert, Field, TextInput } from "../../components/form";
import AuthLayout from "../../layouts/AuthLayout";
import { api } from "../../lib/api";

export default function VerifikasiEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [resending, setResending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setStatus("error");
      setMessage("Tautan verifikasi tidak valid.");
      return;
    }

    api
      .post("/auth/verify-email", { token })
      .then((data) => {
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [token]);

  const handleResend = async (event) => {
    event.preventDefault();
    setNotice("");
    setResending(true);
    try {
      const data = await api.post("/auth/resend-verification", { email: email.trim() });
      setNotice(data.message);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Verifikasi email"
      title="Satu langkah lagi"
      description="Verifikasi email diperlukan agar notifikasi status laporan sampai ke akun Anda."
    >
      {status === "loading" ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">Memverifikasi email...</p>
        </div>
      ) : null}

      {status === "success" ? (
        <div className="py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-selesai-bg text-status-selesai-fg">
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-navy">Email terverifikasi</h2>
          <p className="mt-2 text-sm text-muted">{message}</p>
          <Link to="/masuk" className="btn-primary mt-6 w-full">
            Masuk ke akun
          </Link>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="space-y-5">
          <h2 className="text-2xl font-extrabold text-navy">Verifikasi gagal</h2>
          <Alert tone="error">{message}</Alert>

          <form className="space-y-4" onSubmit={handleResend}>
            <Field
              label="Kirim ulang tautan verifikasi"
              htmlFor="email"
              hint="Masukkan email yang Anda pakai saat mendaftar."
            >
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
            <button type="submit" className="btn-outline w-full" disabled={resending}>
              {resending ? "Mengirim..." : "Kirim ulang verifikasi"}
            </button>
          </form>

          {notice ? <Alert tone="info">{notice}</Alert> : null}

          <p className="text-center text-sm text-muted">
            <Link to="/masuk" className="link">
              Kembali ke halaman masuk
            </Link>
          </p>
        </div>
      ) : null}
    </AuthLayout>
  );
}
