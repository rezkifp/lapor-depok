# Lapor Depok

Aplikasi web layanan pengaduan dan aspirasi masyarakat Kota Depok.

## Fitur Utama

- **Publik:** Beranda & statistik real-time, daftar laporan publik (filter kategori), lacak tiket (`/cek/:tiket`), Cara Melapor, FAQ, Syarat & Ketentuan, Kebijakan Privasi.
- **Warga:** Daftar/masuk (NIK terenkripsi Fernet), wizard buat laporan 4 langkah dengan peta interaktif (cari alamat, GPS, mode satelit), upload lampiran, unduh bukti PDF + QR code, pantau laporan, tanggapan tambahan, dan penilaian layanan.
- **Admin Multi-Peran (`super_admin`, `admin_verifikator`, `petugas_dinas`):** Dashboard statistik & SLA, daftar & detail laporan, disposisi instansi/prioritas, konfirmasi status final, CRUD Master Data, daftar Pengguna, Log Audit, dan Ekspor CSV.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, React Router 7, Leaflet (`react-leaflet`), Recharts
- **Backend:** FastAPI, Uvicorn, PostgreSQL 16 (`psycopg` 3), ReportLab, Cryptography (Fernet)

---

## Cara Menjalankan di Localhost (Development)

### Opsi 1: Menggunakan Docker (Paling Cepat)

Prasyarat: **Docker Desktop** & **Node.js 20+**

1. Jalankan database PostgreSQL dan backend API:
   ```powershell
   docker compose up -d --build
   ```
2. Isi data awal (seed) — tunggu beberapa detik hingga container siap:
   ```powershell
   docker compose exec api python seed.py
   ```
3. Jalankan frontend di terminal baru:
   ```powershell
   cd web
   npm install
   npm run dev
   ```
4. Buka `http://localhost:5173` di browser.

### Opsi 2: Tanpa Docker (PostgreSQL Native Windows)

Prasyarat: **PostgreSQL 16+**, **Python 3.12**, **Node.js 20+**

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-dev.ps1
```

Lalu jalankan API dan Web di dua terminal terpisah:
```powershell
# Terminal 1 (API)
cd api
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --env-file .env

# Terminal 2 (Web)
cd web
npm run dev
```

*(Jika `SMTP_HOST` kosong, tautan verifikasi email dan reset sandi dicetak ke log terminal API agar alur tetap dapat diuji.)*

---

## Cara Deploy ke Server / VPS (Production)

Repo ini sudah menyediakan `docker-compose.prod.yml` dan `web/Dockerfile` agar siap di-deploy ke server mana pun.

1. Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
2. Isi seluruh variabel wajib di `.env`:
   - `APP_BASE_URL` (misal `https://lapor.domainanda.com`)
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`, `NIK_HASH_PEPPER`:
     ```bash
     python3 -c "import secrets; print(secrets.token_urlsafe(32))"
     ```
   - `NIK_ENC_KEY` (wajib format Fernet):
     ```bash
     python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
     ```
   - `SEED_PASSWORD` (minimal 12 karakter, tidak boleh memakai sandi demo).
3. Build dan jalankan seluruh stack (`db`, `lapor-api`, `lapor-web`):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Isi data master & akun awal (opsional, sekali saja):
   ```bash
   docker compose -f docker-compose.prod.yml exec lapor-api python seed.py
   ```
5. Aplikasi berjalan di port `WEB_PORT` (default `8080`). Pasang reverse proxy (Nginx/Caddy/Traefik) dengan HTTPS di depannya menuju `http://127.0.0.1:8080`.
   - Jika memasang **Content-Security-Policy (CSP)** di reverse proxy, izinkan `https://*.tile.openstreetmap.org` dan `https://server.arcgisonline.com` pada `img-src`, serta `https://nominatim.openstreetmap.org` pada `connect-src` agar fitur peta & pencarian lokasi bekerja penuh.

---

## Akun Demo (Development)

Sandi semua akun demo: `LaporDepok2026!`

- **Super Admin:** `superadmin@lapor-depok.test`
- **Verifikator:** `verifikator1@lapor-depok.test`, `verifikator2@lapor-depok.test`
- **Petugas Dinas:** `petugas.dlhk@lapor-depok.test`, `petugas.dpupr@lapor-depok.test`, `petugas.dishub@lapor-depok.test`
- **Warga:** `warga01@lapor-depok.test` s/d `warga20@lapor-depok.test`
