import { Link } from "react-router-dom";

import { useAuth } from "../lib/auth";

const STEPS = [
  {
    number: 1,
    title: "Tulis Laporan",
    description:
      "Isi formulir pelaporan, pilih kategori (Infrastruktur, Kebersihan, dll.), tandai lokasi pada peta, dan lampirkan foto atau dokumen pendukung (maks. 3 file, 5 MB per file, JPG/PNG/PDF).",
  },
  {
    number: 2,
    title: "Verifikasi",
    description:
      "Admin memeriksa kelengkapan dan kesesuaian laporan dengan ketentuan yang berlaku. Laporan yang lolos verifikasi diteruskan ke instansi terkait.",
  },
  {
    number: 3,
    title: "Tindak Lanjut",
    description:
      "Instansi terkait menindaklanjuti laporan. Status laporan dapat Anda pantau secara berkala melalui nomor tiket.",
  },
  {
    number: 4,
    title: "Selesai & Nilai",
    description:
      "Setelah laporan selesai, Anda menerima tanggapan resmi dan dapat memberi penilaian atas layanan yang diterima.",
  },
];

const REQUIREMENTS = [
  "Akun warga terverifikasi (daftar dengan email dan NIK).",
  "Judul laporan singkat dan jelas (maks. 120 karakter).",
  "Uraian masalah minimal 20 karakter, sertakan kronologi dan dampak.",
  "Tanggal kejadian tidak boleh di masa depan.",
  "Alamat lokasi kejadian (kecamatan dan kelurahan wajib).",
  "Lampiran opsional: foto atau dokumen pendukung (JPG/PNG/PDF, maks. 5 MB per file).",
];

const TIPS = [
  "Gunakan judul yang spesifik, misalnya \"Lubang jalan di Jl. Margonda Raya dekat Depok Town Square\".",
  "Sertakan foto kondisi terkini agar verifikasi lebih cepat.",
  "Pilih kategori yang paling sesuai agar laporan langsung ke instansi yang tepat.",
  "Gunakan pilihan privasi \"Anonim\" jika tidak ingin identitas ditampilkan, tetapi ingat notifikasi tetap dikirim ke email Anda.",
  "Simpan nomor tiket (LPR-DPK-YYYY-XXXXXX) untuk melacak status laporan.",
];

export default function CaraMelapor() {
  const { user } = useAuth();
  const reportTarget = user ? "/lapor" : "/masuk?next=%2Flapor";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Cara Melapor</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Empat langkah sederhana dari laporan hingga penyelesaian. Setiap laporan
          tercatat dengan nomor tiket yang dapat dipantau.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold text-navy">Langkah Pelaporan</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.number} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-extrabold text-white">
                {step.number}
              </span>
              <h3 className="mt-4 text-base font-bold text-navy">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-extrabold text-navy">Syarat & Format</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {REQUIREMENTS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-extrabold text-navy">Tips Agar Laporan Cepat Ditangani</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {TIPS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to={reportTarget} className="btn-primary">
          Buat Laporan Sekarang
        </Link>
        <Link to="/faq" className="btn-outline">
          Lihat FAQ
        </Link>
      </div>
    </div>
  );
}