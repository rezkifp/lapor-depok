import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import ProtectedRoute, { RoleGate } from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import PublicLayout from "./layouts/PublicLayout";
import WargaLayout from "./layouts/WargaLayout";
import { AuthProvider } from "./lib/auth";
import BuatLaporan from "./pages/BuatLaporan";
import CaraMelapor from "./pages/CaraMelapor";
import CekTiket from "./pages/CekTiket";
import KebijakanPrivasi from "./pages/KebijakanPrivasi";
import SyaratKetentuan from "./pages/SyaratKetentuan";
import FAQ from "./pages/FAQ";
import Home from "./pages/Home";
import LaporanDetail from "./pages/LaporanDetail";
import LaporanSaya from "./pages/LaporanSaya";
import LaporanSukses from "./pages/LaporanSukses";
import NotFound from "./pages/NotFound";
import Profil from "./pages/Profil";
import PublicReports from "./pages/PublicReports";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminExport from "./pages/admin/AdminExport";
import AdminLog from "./pages/admin/AdminLog";
import AdminMaster from "./pages/admin/AdminMaster";
import AdminReportDetail from "./pages/admin/AdminReportDetail";
import AdminReports from "./pages/admin/AdminReports";
import AdminUsers from "./pages/admin/AdminUsers";
import Daftar from "./pages/auth/Daftar";
import LupaSandi from "./pages/auth/LupaSandi";
import Masuk from "./pages/auth/Masuk";
import ResetSandi from "./pages/auth/ResetSandi";
import VerifikasiEmail from "./pages/auth/VerifikasiEmail";

const ADMIN_ROLES = ["admin_verifikator", "petugas_dinas", "super_admin"];

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/laporan-publik" element={<PublicReports />} />
            <Route path="/cek/:tiket" element={<CekTiket />} />
            <Route path="/cara-melapor" element={<CaraMelapor />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/syarat-ketentuan" element={<SyaratKetentuan />} />
            <Route path="/kebijakan-privasi" element={<KebijakanPrivasi />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/masuk" element={<Masuk />} />
          <Route path="/daftar" element={<Daftar />} />
          <Route path="/lupa-sandi" element={<LupaSandi />} />
          <Route path="/reset-sandi/:token" element={<ResetSandi />} />
          <Route path="/verifikasi-email/:token" element={<VerifikasiEmail />} />
          <Route path="/verifikasi-email" element={<VerifikasiEmail />} />

          <Route element={<ProtectedRoute roles={["warga"]} />}>
            <Route element={<WargaLayout />}>
              <Route path="/profil" element={<Profil />} />
              <Route path="/laporan-saya" element={<LaporanSaya />} />
              <Route path="/laporan/:tiket" element={<LaporanDetail />} />
              <Route path="/lapor" element={<BuatLaporan />} />
              <Route path="/lapor/sukses/:tiket" element={<LaporanSukses />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={ADMIN_ROLES} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/laporan" element={<AdminReports />} />
              <Route path="/admin/laporan/:id" element={<AdminReportDetail />} />
              <Route element={<RoleGate roles={["admin_verifikator", "super_admin"]} />}>
                <Route path="/admin/master" element={<AdminMaster />} />
                <Route path="/admin/ekspor" element={<AdminExport />} />
              </Route>
              <Route element={<RoleGate roles={["super_admin"]} />}>
                <Route path="/admin/pengguna" element={<AdminUsers />} />
                <Route path="/admin/log" element={<AdminLog />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
