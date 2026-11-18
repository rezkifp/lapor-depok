# setup-dev.ps1
# Setup pengembangan lokal Lapor Depok (PostgreSQL native, tanpa Docker).
# Jalankan dari root repo: .\setup-dev.ps1

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $Root "api"
$WebDir = Join-Path $Root "web"
$EnvFile = Join-Path $ApiDir ".env"
$EnvExample = Join-Path $Root ".env.dev.example"

Write-Host "=== Lapor Depok - Setup Dev (PostgreSQL native) ===" -ForegroundColor Cyan

# 1. Cek psql (PATH atau lokasi default Windows)
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) {
        $env:Path += ";$($found.DirectoryName)"
        $psql = Get-Command psql -ErrorAction SilentlyContinue
    }
}
if (-not $psql) {
    Write-Host "ERROR: psql tidak ditemukan. Pasang PostgreSQL 16+ terlebih dahulu." -ForegroundColor Red
    Write-Host "  Windows: https://www.postgresql.org/download/windows/"
    exit 1
}
Write-Host "psql ditemukan: $($psql.Source)"

# 2. Pastikan service Postgres berjalan (Windows)
$svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($svc -and $svc.Status -ne "Running") {
    Write-Host "Menyalakan service $($svc.Name)..."
    Start-Service $svc.Name
}

# 3. Buat role dan database "lapor" jika belum ada
$roleExists = & psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='lapor'" 2>$null
if ($roleExists -ne "1") {
    Write-Host "Membuat role 'lapor'..."
    & psql -U postgres -c "CREATE ROLE lapor LOGIN PASSWORD 'lapor';" | Out-Null
} else {
    Write-Host "Role 'lapor' sudah ada."
}

$dbExists = & psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='lapor'" 2>$null
if ($dbExists -ne "1") {
    Write-Host "Membuat database 'lapor'..."
    & psql -U postgres -c "CREATE DATABASE lapor OWNER lapor;" | Out-Null
} else {
    Write-Host "Database 'lapor' sudah ada."
}

# 4. venv
$venvPython = Join-Path $ApiDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Membuat venv..."
    & python -m venv (Join-Path $ApiDir ".venv")
}
Write-Host "Menginstall dependensi Python..."
& $venvPython -m pip install --upgrade pip | Out-Null
& $venvPython -m pip install -r (Join-Path $ApiDir "requirements.txt")

# 5. api/.env
if (-not (Test-Path $EnvFile)) {
    Write-Host "Membuat api/.env dari .env.dev.example..."
    Copy-Item $EnvExample $EnvFile
    # Generate NIK_ENC_KEY jika kosong
    $content = Get-Content $EnvFile -Raw
    if ($content -match "NIK_ENC_KEY=\s*$" -or $content -match "NIK_ENC_KEY=\r?\n") {
        $key = & $venvPython -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
        $content = $content -replace "NIK_ENC_KEY=.*", "NIK_ENC_KEY=$key"
        Set-Content -Path $EnvFile -Value $content -NoNewline
        Write-Host "NIK_ENC_KEY dibuat otomatis."
    }
} else {
    Write-Host "api/.env sudah ada, tidak ditimpa."
}

# 6. npm install di web
if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
    Write-Host "npm install di web/..."
    Push-Location $WebDir
    & npm install
    Pop-Location
} else {
    Write-Host "node_modules sudah ada, lewati npm install."
}

# 7. Seed
Write-Host "Menjalankan seed (menghapus data lama)..."
Push-Location $ApiDir
& $venvPython seed.py
Pop-Location

Write-Host ""
Write-Host "=== Setup selesai ===" -ForegroundColor Green
Write-Host "Jalankan API:  cd api; .venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --env-file .env"
Write-Host "Jalankan Web:  cd web; npm run dev  (buka http://localhost:5173)"
Write-Host "Akun seed: lihat README.md (sandi semua: LaporDepok2026!)"