import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function TicketLookup({ showHeading = true, defaultValue = "" }) {
  const inputId = useId();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const sample = `LPR-DPK-${currentYear}-000123`;
  const [ticket, setTicket] = useState(defaultValue);
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = ticket.trim().replace(/\s+/g, "").toUpperCase();
    if (!value) {
      setError("Masukkan nomor tiket terlebih dahulu.");
      return;
    }
    if (!/^(\d{6}|LPR-DPK-\d{4}-\d{6})$/.test(value)) {
      setError(`Gunakan format ${sample} atau 6 digit terakhir.`);
      return;
    }
    setError("");
    navigate(`/cek/${encodeURIComponent(value)}`);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {showHeading ? (
        <>
          <h2 className="text-lg font-extrabold text-navy">Cek Status Laporan</h2>
          <p className="mt-1 text-sm text-muted">
            Masukkan nomor tiket yang Anda terima setelah melapor.
          </p>
        </>
      ) : null}

      <label htmlFor={inputId} className={`field-label ${showHeading ? "mt-4" : ""}`}>
        Nomor Tiket
      </label>
      <div className={showHeading ? "mt-1 space-y-3" : "space-y-2"}>
        <input
          id={inputId}
          className={`field-input ${error ? "border-status-ditolak-fg" : ""}`}
          placeholder={sample}
          autoComplete="off"
          spellCheck="false"
          value={ticket}
          onChange={(event) => {
            setTicket(event.target.value);
            setError("");
          }}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <p className="text-xs font-medium text-status-ditolak-fg" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="inline-flex min-h-control w-full items-center justify-center rounded-btn bg-blue px-5 text-sm font-bold text-white transition hover:bg-navy"
        >
          Lacak Laporan
        </button>
      </div>

      {showHeading ? (
        <p className="mt-3 text-xs text-muted">
          Belum punya akun?{" "}
          <Link to="/daftar" className="link">
            Daftar sebagai warga
          </Link>
        </p>
      ) : null}
    </form>
  );
}
