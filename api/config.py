"""Konfigurasi aplikasi, dibaca dari environment.

Saat development di PC, salin `.env.dev.example` ke `api/.env`. Saat produksi,
nilai datang dari `env_file` Docker Compose. Tidak ada rahasia di file ini.
"""

from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# api/.env hanya untuk lokal. Variabel yang sudah diisi proses induk
# (mis. dari Compose) tidak ditimpa.
load_dotenv(BASE_DIR / ".env", override=False)


class ConfigError(RuntimeError):
    """Environment wajib belum diisi."""


def _get(name: str, default: str | None = None) -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value
    if default is not None:
        return default
    raise ConfigError(
        f"Environment variable {name} wajib diisi. Lihat .env.dev.example."
    )


def database_url() -> str:
    return _get("DATABASE_URL")


def app_base_url() -> str:
    return _get("APP_BASE_URL", "http://localhost:5173").rstrip("/")


def upload_dir() -> Path:
    raw = _get("UPLOAD_DIR", "./uploads")
    path = Path(raw)
    return path if path.is_absolute() else (BASE_DIR / path).resolve()


def jwt_secret() -> str:
    return _get("JWT_SECRET")


def nik_enc_key() -> str:
    return _get("NIK_ENC_KEY")


def nik_hash_pepper() -> str:
    return _get("NIK_HASH_PEPPER")


def jwt_ttl_hours() -> int:
    raw = os.getenv("JWT_TTL_HOURS", "12").strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = 12
    return max(1, min(hours, 24 * 30))


def smtp_settings() -> dict[str, object] | None:
    """None berarti email tidak dikirim; tautan dicetak ke log (development)."""
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        return None
    raw_port = os.getenv("SMTP_PORT", "587").strip()
    try:
        port = int(raw_port)
    except ValueError:
        port = 587
    user = os.getenv("SMTP_USER", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip() or user or "no-reply@lapor-depok.local"
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": os.getenv("SMTP_PASS", ""),
        "from": sender,
    }


def app_env() -> str:
    return os.getenv("APP_ENV", "development").strip().lower() or "development"


def is_production() -> bool:
    return app_env() in ("production", "prod")


def validate_production_config() -> None:
    """Validasi konfigurasi wajib saat APP_ENV=production. Raise ConfigError bila invalid."""
    if not is_production():
        return
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret or len(secret) < 32 or "dev-only" in secret.lower():
        raise ConfigError("JWT_SECRET wajib diisi kuat di produksi (min 32 karakter, bukan dev-only).")
    enc = os.getenv("NIK_ENC_KEY", "").strip()
    if not enc:
        raise ConfigError("NIK_ENC_KEY wajib diisi di produksi.")
    try:
        Fernet(enc.encode() if isinstance(enc, str) else enc)
    except Exception:
        raise ConfigError("NIK_ENC_KEY bukan Fernet key valid di produksi.")
    pepper = os.getenv("NIK_HASH_PEPPER", "").strip()
    if not pepper or "dev-only" in pepper.lower():
        raise ConfigError("NIK_HASH_PEPPER wajib diisi di produksi (bukan dev-only).")


def cors_origins() -> list[str]:
    """Origin frontend yang boleh memanggil API langsung (dev)."""
    origins = [
        app_base_url(),
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    seen: list[str] = []
    for origin in origins:
        if origin not in seen:
            seen.append(origin)
    return seen
