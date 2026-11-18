import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import CategoryIcon from "../components/CategoryIcon";
import StatusChip from "../components/StatusChip";
import TicketLookup from "../components/TicketLookup";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { formatDecimal, formatNumber, formatShortDate } from "../lib/format";

const STEPS = [
  {
    title: "Tulis Laporan",
    description:
      "Isi formulir, pilih kategori, tandai lokasi, dan lampirkan foto atau dokumen pendukung.",
  },
  {
    title: "Verifikasi",
    description:
      "Admin memeriksa kelengkapan dan kesesuaian laporan dengan ketentuan yang berlaku.",
  },
  {
    title: "Tindak Lanjut",
    description:
      "Laporan diteruskan ke dinas terkait dan statusnya dapat Anda pantau secara berkala.",
  },
  {
    title: "Selesai & Nilai",
    description:
      "Terima tanggapan resmi, lalu beri penilaian atas layanan yang Anda terima.",
  },
];

function StatItem({ value, label, hint }) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <p className="text-2xl font-extrabold leading-none text-navy sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function LatestSkeleton() {
  return (
    <div className="divide-y divide-line">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-surface" />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const reportTarget = user ? "/lapor" : "/masuk?next=%2Flapor";

  useEffect(() => {
    if (hash === "#statistik") {
      document.getElementById("statistik")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState(null);
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get("/public/stats")
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStats({});
      });

    api
      .get("/master/categories")
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setCategories([]);
      });

    api
      .get("/public/reports?page=1")
      .then((data) => {
        if (active) setLatest(data.items.slice(0, 3));
      })
      .catch(() => {
        if (active) setLatest([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const showRating = Boolean(stats?.avg_rating);

  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        <div
          className="pointer-events-none absolute -right-40 -top-32 h-[28rem] w-[28rem] rounded-full bg-blue/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-48 left-1/3 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:pb-28">
          <div className="pt-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
              Kanal Resmi Pengaduan Warga
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.12] sm:text-5xl">
              Suara Anda membangun Kota Depok yang lebih baik
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              Sampaikan keluhan, aspirasi, atau permintaan informasi langsung kepada perangkat
              daerah terkait. Setiap laporan memiliki nomor tiket dan dapat dipantau hingga
              selesai.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to={reportTarget} className="btn-primary">
                Buat Laporan
              </Link>
              <Link
                to="/cara-melapor"
                className="inline-flex min-h-control items-center justify-center gap-2 rounded-btn border border-white/30 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Lihat Cara Melapor
              </Link>
            </div>
          </div>

          <div className="rounded-card bg-white p-5 text-ink shadow-xl shadow-navy/20 sm:p-6 lg:mt-8">
            <TicketLookup />
          </div>
        </div>
      </section>

      <section
        className="relative z-10 mx-auto -mt-12 w-full max-w-6xl scroll-mt-32 px-4 sm:px-6"
        id="statistik"
      >
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-lg shadow-navy/5">
          <div
            className={`grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 ${
              showRating ? "lg:grid-cols-4" : "lg:grid-cols-3"
            }`}
          >
            <StatItem
              value={stats ? formatNumber(stats.total_reports) : "—"}
              label="Total laporan masuk"
            />
            <StatItem
              value={stats ? formatNumber(stats.resolved_reports) : "—"}
              label="Laporan selesai ditindaklanjuti"
            />
            <StatItem
              value={
                stats?.avg_response_days != null
                  ? `${formatDecimal(stats.avg_response_days)} hari`
                  : "—"
              }
              label="Rata-rata waktu respons"
            />
            {showRating ? (
              <StatItem
                value={`${formatDecimal(stats.avg_rating)} / 5`}
                label="Kepuasan pelapor"
                hint={`dari ${formatNumber(stats.rating_count)} penilaian`}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">Alur Pengaduan</h2>
          <p className="mt-2 text-sm text-muted">
            Empat langkah sederhana dari laporan hingga penyelesaian
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="card p-5">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold ${
                  index === STEPS.length - 1
                    ? "bg-gold text-navy"
                    : "bg-navy text-white"
                }`}
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-bold text-navy">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">Kategori Laporan</h2>
            <p className="mt-2 text-sm text-muted">
              Pilih topik yang paling sesuai dengan permasalahan Anda
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {categories === null
              ? [0, 1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className="h-[74px] animate-pulse rounded-card border border-line bg-surface"
                  />
                ))
              : categories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/laporan-publik?category=${category.id}`}
                    className="card flex items-center gap-3 p-3.5 transition hover:border-blue/40 hover:shadow-sm"
                  >
                    <CategoryIcon name={category.name} />
                    <span className="text-sm font-semibold leading-snug text-navy">
                      {category.name}
                    </span>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">Laporan Terbaru</h2>
            <p className="mt-1 text-sm text-muted">Laporan publik tanpa identitas pelapor</p>
          </div>
          <Link to="/laporan-publik" className="link text-sm">
            Lihat semua laporan
          </Link>
        </div>

        <div className="card mt-5 overflow-hidden">
          {latest === null ? <LatestSkeleton /> : null}
          {latest?.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Belum ada laporan yang dapat ditampilkan.
            </p>
          ) : null}
          {latest?.length > 0 ? (
            <div className="divide-y divide-line">
              {latest.map((report) => (
                <Link
                  key={report.ticket_no}
                  to={`/cek/${encodeURIComponent(report.ticket_no)}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-4 transition hover:bg-surface sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink sm:text-base">
                      {report.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {report.ticket_no} · Kec. {report.district} · {report.category.name} ·{" "}
                      {formatShortDate(report.created_at)}
                    </p>
                  </div>
                  <StatusChip status={report.status} />
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-card border border-line bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-bold text-navy">Punya keluhan atau aspirasi?</p>
            <p className="mt-1 text-sm text-muted">
              Sampaikan sekarang. Setiap laporan tercatat dengan nomor tiket.
            </p>
          </div>
          <Link to={reportTarget} className="btn-primary shrink-0">
            Buat Laporan
          </Link>
        </div>
      </section>
    </>
  );
}
