import { useState } from "react";

import { Alert, Button, Field, TextInput } from "../../components/form";
import { api } from "../../lib/api";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default function AdminExport() {
  const [month, setMonth] = useState(currentMonth);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleDownload = async () => {
    setError("");
    setSuccess("");
    if (!MONTH_PATTERN.test(month)) {
      setError("Format bulan tidak valid. Gunakan format YYYY-MM, contoh 2026-11.");
      return;
    }
    setLoading(true);
    try {
      await api.download(`/admin/export?month=${month}`, `lapor-export-${month}.csv`);
      setSuccess(`Ekspor bulan ${month} berhasil diunduh.`);
    } catch (err) {
      setError(err.message || "Gagal mengunduh berkas CSV.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Panel Admin</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Ekspor</h1>
          <p className="mt-1 text-sm text-muted">
            Unduh rekap laporan bulanan dalam format CSV untuk pelaporan atau backup data.
          </p>
        </div>
      </div>

      <div className="card mt-6 max-w-2xl p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleDownload();
          }}
          className="grid gap-4"
        >
          <Field label="Bulan ekspor" htmlFor="export-month" required>
            <TextInput
              id="export-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Membuat CSV..." : "Unduh CSV"}
            </Button>
          </div>
        </form>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <p className="mt-4 text-xs text-muted">
          Berkas berisi tiket, tanggal, jenis, kategori, instansi, kecamatan, kelurahan, status, prioritas, privasi, dan hari proses.
          Identitas pelapor tidak disertakan dalam ekspor.
        </p>
      </div>

    </div>
  );
}
