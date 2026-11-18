export default function Footer() {
  return (
    <footer className="bg-footer text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1.5 px-6 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <p className="text-white/70">
          © {new Date().getFullYear()} Pemerintah Kota Depok
        </p>
        <p className="text-white/70">
          Dikembangkan oleh: Rezki Fajar P · Rafal Rialdi · Ryan Octafriansyah · Adi Rifaldi
        </p>
      </div>
    </footer>
  );
}
