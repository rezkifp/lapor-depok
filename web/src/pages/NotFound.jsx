import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
      <div className="card px-6 py-14 text-center sm:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">404</p>
        <h1 className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.
        </p>
        <Link to="/" className="btn-primary mt-6">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
