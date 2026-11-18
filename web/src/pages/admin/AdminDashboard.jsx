import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import StatusChip from "../../components/StatusChip";
import { api } from "../../lib/api";
import { formatNumber, formatShortDate } from "../../lib/format";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #DCE4F0",
  fontSize: 12,
  color: "#14213D",
};

function SearchBox() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/admin/laporan?q=${encodeURIComponent(query)}` : "/admin/laporan");
  };

  return (
    <form onSubmit={submit} className="w-full sm:w-72" role="search">
      <label htmlFor="dashboard-search" className="sr-only">
        Cari nomor tiket atau judul
      </label>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id="dashboard-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Cari nomor tiket atau judul"
          className="field-input pl-10"
        />
      </div>
    </form>
  );
}

function StatCard({ label, value, tone = "text-navy", to, accent = false }) {
  const body = (
    <>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${tone}`}>{formatNumber(value)}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`card block p-5 transition hover:border-blue/40 hover:shadow-sm ${
          accent ? "border-status-ditolak-fg/35" : ""
        }`}
      >
        {body}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue">
          Lihat laporan
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
    );
  }

  return <div className={`card p-5 ${accent ? "border-status-ditolak-fg/35" : ""}`}>{body}</div>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="card h-28 animate-pulse p-5">
            <div className="h-3 w-24 rounded bg-surface" />
            <div className="mt-4 h-8 w-16 rounded bg-surface" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card h-80 animate-pulse bg-surface" />
        <div className="card h-80 animate-pulse bg-surface" />
      </div>
      <div className="card h-64 animate-pulse bg-surface" />
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api
      .get("/admin/dashboard")
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const now = new Date();
  const period = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Panel Admin</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Ringkasan laporan · {period}</p>
        </div>
        <SearchBox />
      </div>

      {loading ? <div className="mt-6"><DashboardSkeleton /></div> : null}

      {!loading && error ? (
        <div className="card mt-6 p-6 text-center">
          <p className="text-sm font-semibold text-status-ditolak-fg">{error}</p>
          <button
            type="button"
            className="btn-outline mt-4"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : null}

      {!loading && !error && data ? (
        <div className="mt-6 space-y-4">
          {data.scope.restricted ? (
            <p className="rounded-btn border border-status-diverifikasi-fg/20 bg-status-diverifikasi-bg px-4 py-3 text-sm text-status-diverifikasi-fg">
              Angka pada halaman ini hanya mencakup laporan untuk instansi Anda
              {data.scope.agency ? `, ${data.scope.agency.name}` : ""}.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Laporan Baru" value={data.by_status.diterima} />
            <StatCard
              label="Sedang Diproses"
              value={data.by_status.diproses}
              tone="text-status-diproses-fg"
            />
            <StatCard
              label="Selesai"
              value={data.by_status.selesai}
              tone="text-status-selesai-fg"
            />
            <StatCard
              label="Lewat SLA"
              value={data.overdue}
              tone="text-status-ditolak-fg"
              to="/admin/laporan?sla=overdue"
              accent
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>
              Total <span className="font-bold text-ink">{formatNumber(data.total_reports)}</span>{" "}
              laporan
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Diverifikasi{" "}
              <span className="font-bold text-status-diverifikasi-fg">
                {formatNumber(data.by_status.diverifikasi)}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Ditolak{" "}
              <span className="font-bold text-status-ditolak-fg">
                {formatNumber(data.by_status.ditolak)}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              SLA verifikasi {data.sla.verify_days} hari kerja, penanganan{" "}
              {data.sla.process_days} hari kerja
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="text-base font-extrabold text-navy">Tren Laporan 6 Bulan Terakhir</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DCE4F0" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#4A5B7C", fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#4A5B7C", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "#F5F8FC" }}
                      formatter={(value) => [formatNumber(value), "Laporan"]}
                    />
                    <Bar dataKey="total" name="Laporan" radius={[6, 6, 0, 0]}>
                      {data.trend.map((item, index) => (
                        <Cell
                          key={item.month}
                          fill={index === data.trend.length - 1 ? "#F2B705" : "#1D5FD1"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card p-5">
              <h2 className="text-base font-extrabold text-navy">Laporan per Kategori</h2>
              {data.by_category.length === 0 ? (
                <p className="mt-6 text-sm text-muted">Belum ada laporan pada cakupan Anda.</p>
              ) : (
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.by_category}
                      layout="vertical"
                      margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#DCE4F0" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#4A5B7C", fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={196}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#4A5B7C", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: "#F5F8FC" }}
                        formatter={(value) => [formatNumber(value), "Laporan"]}
                      />
                      <Bar dataKey="total" name="Laporan" fill="#1D5FD1" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-base font-extrabold text-navy">Laporan Masuk Terbaru</h2>
              <Link to="/admin/laporan" className="text-sm font-semibold text-blue hover:text-navy">
                Lihat semua
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Tiket</th>
                    <th className="px-3 py-3">Judul</th>
                    <th className="px-3 py-3">Kecamatan</th>
                    <th className="px-3 py-3">Prioritas</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latest.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-muted">
                        Belum ada laporan pada cakupan Anda.
                      </td>
                    </tr>
                  ) : (
                    data.latest.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                        <td className="px-5 py-3">
                          <Link
                            to={`/admin/laporan/${item.id}`}
                            className="font-mono text-xs font-bold text-navy hover:text-blue"
                          >
                            {item.ticket_no}
                          </Link>
                        </td>
                        <td className="max-w-[320px] px-3 py-3">
                          <Link
                            to={`/admin/laporan/${item.id}`}
                            className="line-clamp-1 font-semibold text-ink hover:text-blue"
                            title={item.title}
                          >
                            {item.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatShortDate(item.created_at)}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-muted">{item.district ?? "-"}</td>
                        <td className="px-3 py-3">
                          <span
                            className={
                              item.priority === "mendesak"
                                ? "font-bold text-status-ditolak-fg"
                                : "text-muted"
                            }
                          >
                            {item.priority === "mendesak" ? "Mendesak" : "Biasa"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <StatusChip status={item.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
