import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Data yang Dikumpulkan",
    body: "Kami mengumpulkan data identitas dasar saat pendaftaran (nama lengkap, NIK, alamat email, nomor telepon, dan alamat domisili) serta data laporan yang Anda kirimkan (judul, uraian, lokasi kejadian, dan lampiran).",
  },
  {
    title: "2. Keamanan & Enkripsi NIK",
    body: "NIK Anda disimpan dalam bentuk terenkripsi (Fernet) dan hanya digunakan untuk mencegah pendaftaran ganda serta memastikan keabsahan pelapor. Pada tampilan aplikasi, NIK hanya ditampilkan dalam format tersamarkan (4 digit terakhir).",
  },
  {
    title: "3. Pilihan Privasi Laporan",
    items: [
      "Tampil: Nama pelapor dan isi laporan dapat ditampilkan pada halaman laporan publik (khusus jenis Pengaduan dan Aspirasi).",
      "Rahasia: Nama pelapor disembunyikan di halaman publik, namun identitas tetap terlihat oleh admin verifikator dan petugas instansi terkait untuk keperluan tindak lanjut.",
      "Anonim: Nama pelapor disembunyikan di halaman publik dan tidak ditampilkan kepada verifikator maupun petugas dinas (hanya dapat diakses oleh super admin bila diperlukan untuk audit).",
      "Laporan bertipe Permintaan Informasi tidak pernah ditampilkan di halaman publik.",
    ],
  },
  {
    title: "4. Notifikasi Email",
    body: "Pembaruan status laporan—termasuk untuk laporan yang dikirim dengan mode Anonim—tetap dikirimkan melalui email ke alamat akun pelapor agar Anda dapat memantau perkembangan laporan.",
  },
  {
    title: "5. Penyimpanan Lampiran",
    body: "Lampiran foto atau dokumen disimpan secara aman di server dan hanya dapat diakses oleh pelapor pemilik tiket serta petugas yang berwenang melalui tautan terautentikasi.",
  },
];

export default function KebijakanPrivasi() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Perlindungan Data</p>
        <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Kebijakan Privasi</h1>
        <p className="mt-2 text-sm text-muted">
          Penjelasan pengelolaan data pribadi, enkripsi NIK, dan tingkat privasi laporan di Lapor Depok.
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
          <Link to="/syarat-ketentuan" className="btn-outline">
            Baca Syarat &amp; Ketentuan
          </Link>
          <Link to="/" className="btn-primary">
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
