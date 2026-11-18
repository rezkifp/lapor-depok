const STEPS = ["Laporan", "Verifikasi", "Tindak Lanjut", "Selesai & Nilai"];

export default function WizardChrome({ step, onSelect }) {
  const titles = [
    { title: "Buat Laporan", sub: "Mulai dengan memilih jenis dan topik laporan Anda." },
    { title: "Isi Detail Laporan", sub: "Data lengkap laporan akan Anda tinjau sebelum dikirim." },
    { title: "Data Pelapor & Privasi", sub: "Pastikan data yang tampil di publik sesuai keinginan Anda." },
    { title: "Konfirmasi & Kirim", sub: "Periksa ulang ringkasan laporan sebelum mengirim." },
  ];
  const current = titles[Math.min(Math.max(step, 1), titles.length) - 1];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Pengaduan Warga</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">{current.title}</h1>
          <p className="mt-1 text-sm text-muted">{current.sub}</p>
        </div>
      </div>

      <div className="mt-6">
        <ol className="flex items-center gap-2" aria-label="Langkah pengaduan">
          {STEPS.map((label, index) => {
            const state = index + 1 < step ? "done" : index + 1 === step ? "active" : "todo";
            const clickable = onSelect ? index + 1 : null;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => clickable && onSelect(clickable)}
                  disabled={clickable === null}
                  aria-current={state === "active" ? "step" : undefined}
                  className={`flex h-9 min-h-0 flex-1 items-center justify-center rounded-full px-2 text-xs font-bold transition ${
                    state === "active"
                      ? "bg-blue text-white"
                      : state === "done"
                        ? "bg-status-selesai-bg text-status-selesai-fg"
                        : "bg-surface text-muted"
                  } ${clickable === null ? "" : "hover:opacity-90"}`}
                >
                  {label}
                </button>
                {index < STEPS.length - 1 ? (
                  <span
                    className={`h-px flex-1 ${index + 1 < step ? "bg-status-selesai-fg/50" : "bg-line"}`}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
