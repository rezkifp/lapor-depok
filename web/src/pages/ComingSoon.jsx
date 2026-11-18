import { Link } from "react-router-dom";

export default function ComingSoon({ title, description, backTo = "/", backLabel = "Kembali ke beranda" }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <div className="card px-6 py-12 text-center sm:px-10">
        <span className="chip bg-status-diverifikasi-bg text-status-diverifikasi-fg">
          Segera hadir
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{description}</p>
        <Link to={backTo} className="btn-outline mt-6">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
