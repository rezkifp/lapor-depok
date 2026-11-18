import { useState } from "react";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: "Siapa yang bisa melapor?",
    a: "Setiap warga yang terdaftar dan terverifikasi emailnya. Pendaftaran gratis menggunakan NIK dan email.",
  },
  {
    q: "Apakah identitas saya aman?",
    a: "Ya. Anda memilih tingkat privasi: tampil (nama tampil di publik), rahasia (nama tidak tampil, admin/petugas tetap bisa melihat), atau anonim (identitas disembunyikan dari verifikator dan petugas; hanya super admin yang dapat melihat). Notifikasi tetap dikirim ke email akun Anda.",
  },
  {
    q: "Berapa lama proses penanganan?",
    a: "Verifikasi oleh admin maksimal 2 hari kerja. Penanganan oleh instansi terkait maksimal 14 hari kerja. Anda dapat memantau status melalui nomor tiket.",
  },
  {
    q: "Bagaimana cara melacak laporan?",
    a: "Gunakan nomor tiket (format LPR-DPK-YYYY-XXXXXX) di halaman Cek Tiket, atau masuk ke akun Anda dan buka Laporan Saya.",
  },
  {
    q: "Format lampiran apa yang diterima?",
    a: "Foto (JPG/PNG) atau dokumen (PDF), maksimal 5 MB per file, maksimal 3 file per laporan.",
  },
  {
    q: "Apakah bisa memberi tanggapan tambahan?",
    a: "Ya, Anda dapat menambah tanggapan (maks. 5 per laporan) selama laporan belum selesai atau ditolak.",
  },
  {
    q: "Kapan saya bisa memberi penilaian?",
    a: "Penilaian hanya dapat diberikan setelah laporan berstatus Selesai, satu kali per laporan. Skor 1-5 dan aspek (kecepatan, kejelasan, hasil, keramahan) opsional.",
  },
  {
    q: "Apa yang terjadi jika laporan ditolak?",
    a: "Anda menerima alasan penolakan. Laporan yang ditolak tidak dapat ditanggapi ulang, tetapi Anda dapat membuat laporan baru.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Pertanyaan Umum (FAQ)</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Kumpulan pertanyaan yang sering diajukan seputar privasi, proses, dan penilaian laporan.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {FAQS.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.q} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-bold text-navy sm:text-base">{item.q}</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {isOpen ? (
                <div className="border-t border-line px-5 py-4 text-sm leading-relaxed text-muted">
                  {item.a}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to="/cara-melapor" className="btn-outline">
          Cara Melapor
        </Link>
        <Link to="/laporan-publik" className="btn-primary">
          Lihat Laporan Publik
        </Link>
      </div>
    </div>
  );
}