import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Ketentuan Umum",
    body: "Layanan Lapor Depok disediakan sebagai saluran resmi pengaduan, aspirasi, dan permintaan informasi masyarakat Kota Depok. Dengan mendaftar atau menggunakan layanan ini, Anda menyetujui seluruh ketentuan yang berlaku.",
  },
  {
    title: "2. Akun & Verifikasi Identitas",
    body: "Setiap warga wajib mendaftar menggunakan data identitas yang benar, termasuk Nomor Induk Kependudukan (NIK) yang sah dan alamat email aktif. Satu NIK hanya dapat digunakan untuk satu akun.",
  },
  {
    title: "3. Tata Tertib Pelaporan",
    items: [
      "Laporan harus berisi fakta kejadian yang jelas, sopan, dan tidak mengandung ujaran kebencian, SARA, fitnah, atau informasi palsu.",
      "Lampiran foto atau dokumen harus relevan dengan laporan dan tidak melanggar privasi pihak lain secara melawan hukum.",
      "Batas pengiriman laporan adalah maksimal 5 laporan per akun dalam satu hari.",
    ],
  },
  {
    title: "4. Proses Verifikasi & Penanganan",
    body: "Laporan yang masuk akan diverifikasi oleh admin dalam target waktu 2 hari kerja sebelum diteruskan ke instansi terkait. Laporan yang tidak memenuhi syarat atau di luar kewenangan dapat ditolak dengan disertai alasan penolakan.",
  },
  {
    title: "5. Perubahan Ketentuan",
    body: "Pengelola berhak memperbarui syarat dan ketentuan ini sewaktu-waktu sesuai kebutuhan layanan dan peraturan yang berlaku.",
  },
];

export default function SyaratKetentuan() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Informasi Layanan</p>
        <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Syarat &amp; Ketentuan</h1>
        <p className="mt-2 text-sm text-muted">
          Ketentuan penggunaan layanan pengaduan masyarakat Lapor Depok.
        </p>
      </div>

      <div className="card space-y-6 p-6 sm:p-8">
        {SECTIONS.map((sec) => (
          <section key={sec.title}>
            <h2 className="text-base font-bold text-navy">{sec.title}</h2>
            {sec.body ? (
              <p className="mt-2 text-sm leading-relaxed text-muted">{sec.body}</p>
            ) : null}
            {sec.items ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
                {sec.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          <Link to="/kebijakan-privasi" className="btn-outline">
            Baca Kebijakan Privasi
          </Link>
          <Link to="/" className="btn-primary">
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
