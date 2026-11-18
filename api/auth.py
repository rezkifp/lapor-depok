"""Autentikasi: daftar, verifikasi email, login, lupa/reset sandi, profil,
dan dependency peran.

Aturan utama (AGENTS.md bagian 9 dan 11):
- NIK disimpan terenkripsi Fernet + hash HMAC, tidak pernah dikembalikan mentah.
- Token email hanya disimpan sebagai hash, sekali pakai, 24 jam (verify) / 1 jam (reset).
- Pesan lupa sandi dan kirim ulang verifikasi selalu generik agar tidak membocorkan akun.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

import bcrypt
import jwt
from cryptography.fernet import Fernet
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

import config
import db
import mailer

logger = logging.getLogger("lapor.auth")
router = APIRouter(tags=["auth"])

JWT_ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12
VERIFY_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)
PHONE_PATTERN = r"^[0-9+\-\s]{8,20}$"

bearer_scheme = HTTPBearer(auto_error=False)


def _validate_email(value: str) -> str:
    """Validasi format email.

    `test_environment=True` mengizinkan domain khusus pengujian seperti
    `lapor-depok.test` yang dipakai akun seed. Tidak ada pengiriman ke domain
    itu; SMTP kosong saat development.
    """
    try:
        result = validate_email(value, check_deliverability=False, test_environment=True)
    except EmailNotValidError as exc:
        raise ValueError(str(exc))
    return result.normalized.lower()


EmailAddress = Annotated[str, AfterValidator(_validate_email)]


# ---------------------------------------------------------------------------
# Helper keamanan
# ---------------------------------------------------------------------------


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _hash_nik(nik: str) -> str:
    pepper = config.nik_hash_pepper().encode("utf-8")
    return hmac.new(pepper, nik.encode("ascii"), hashlib.sha256).hexdigest()


def _encrypt_nik(nik: str) -> str:
    return Fernet(config.nik_enc_key()).encrypt(nik.encode("ascii")).decode("ascii")


def _create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=config.jwt_ttl_hours()),
    }
    return jwt.encode(payload, config.jwt_secret(), algorithm=JWT_ALGORITHM)


def _issue_email_token(conn, user_id: int, kind: str, ttl: timedelta) -> str:
    """Batalkan token lama yang belum terpakai, lalu buat token baru."""
    token = secrets.token_urlsafe(32)
    conn.execute(
        "update email_tokens set used_at = now()"
        " where user_id = %s and kind = %s and used_at is null",
        (user_id, kind),
    )
    conn.execute(
        "insert into email_tokens (user_id, kind, token_hash, expires_at)"
        " values (%s, %s, %s, %s)",
        (user_id, kind, _hash_token(token), datetime.now(timezone.utc) + ttl),
    )
    return token


def _consume_email_token(conn, token: str, kind: str) -> dict[str, Any]:
    row = conn.execute(
        "select id, user_id, expires_at, used_at from email_tokens"
        " where token_hash = %s and kind = %s for update",
        (_hash_token(token), kind),
    ).fetchone()
    if row is None or row["used_at"] is not None:
        raise _error(400, "token_invalid", "Tautan tidak valid atau sudah pernah dipakai.")
    if row["expires_at"] <= datetime.now(timezone.utc):
        raise _error(400, "token_expired", "Tautan sudah kedaluwarsa. Minta tautan baru.")
    conn.execute("update email_tokens set used_at = now() where id = %s", (row["id"],))
    return row


# ---------------------------------------------------------------------------
# Pengguna
# ---------------------------------------------------------------------------

USER_SELECT = """
select u.id, u.name, u.email, u.phone, u.address, u.rt, u.rw,
       u.kecamatan_id, u.kelurahan_id, u.role, u.agency_id, u.email_verified,
       u.created_at, u.nik_last4,
       d.name as kecamatan_name, v.name as kelurahan_name, a.name as agency_name
from users u
left join districts d on d.id = u.kecamatan_id
left join villages v on v.id = u.kelurahan_id
left join agencies a on a.id = u.agency_id
"""


def _get_user_row(conn, user_id: int) -> dict[str, Any] | None:
    return conn.execute(USER_SELECT + " where u.id = %s", (user_id,)).fetchone()


def _serialize_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "address": row["address"],
        "rt": row["rt"],
        "rw": row["rw"],
        "kecamatan": (
            {"id": row["kecamatan_id"], "name": row["kecamatan_name"]}
            if row["kecamatan_id"]
            else None
        ),
        "kelurahan": (
            {"id": row["kelurahan_id"], "name": row["kelurahan_name"]}
            if row["kelurahan_id"]
            else None
        ),
        "role": row["role"],
        "agency": (
            {"id": row["agency_id"], "name": row["agency_name"]}
            if row["agency_id"]
            else None
        ),
        "nik_last4": row["nik_last4"],
        "email_verified": row["email_verified"],
        "created_at": row["created_at"].isoformat(),
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _error(401, "unauthorized", "Silakan masuk terlebih dahulu.")
    try:
        payload = jwt.decode(
            credentials.credentials,
            config.jwt_secret(),
            algorithms=[JWT_ALGORITHM],
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise _error(401, "unauthorized", "Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.")

    with db.connection() as conn:
        row = _get_user_row(conn, user_id)
    if row is None:
        raise _error(401, "unauthorized", "Akun tidak ditemukan.")
    return _serialize_user(row)


def require_role(*roles: str):
    """Dependency factory: batasi endpoint ke peran tertentu."""

    def dependency(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if user["role"] not in roles:
            raise _error(403, "forbidden", "Anda tidak memiliki akses ke halaman ini.")
        return user

    return dependency


# ---------------------------------------------------------------------------
# Model input
# ---------------------------------------------------------------------------


class EmailIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailAddress


class TokenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=10, max_length=200)


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=3, max_length=100)
    nik: str = Field(pattern=r"^\d{16}$")
    email: EmailAddress
    phone: str = Field(min_length=8, max_length=20, pattern=PHONE_PATTERN)
    address: str = Field(min_length=5, max_length=255)
    rt: str = Field(pattern=r"^\d{1,3}$")
    rw: str = Field(pattern=r"^\d{1,3}$")
    kecamatan_id: int = Field(gt=0)
    kelurahan_id: int = Field(gt=0)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name", "address")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Kolom ini wajib diisi.")
        return value

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Kata sandi maksimal 72 byte.")
        return value


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailAddress
    password: str = Field(min_length=1, max_length=72)


class ResetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Kata sandi maksimal 72 byte.")
        return value


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=3, max_length=100)
    phone: str | None = Field(default=None, min_length=8, max_length=20, pattern=PHONE_PATTERN)
    address: str | None = Field(default=None, min_length=5, max_length=255)
    rt: str | None = Field(default=None, pattern=r"^\d{1,3}$")
    rw: str | None = Field(default=None, pattern=r"^\d{1,3}$")
    kecamatan_id: int | None = Field(default=None, gt=0)
    kelurahan_id: int | None = Field(default=None, gt=0)

    @field_validator("name", "address")
    @classmethod
    def _strip_optional(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn) -> dict[str, str]:
    email = str(payload.email).lower()
    nik_hash = _hash_nik(payload.nik)

    with db.connection() as conn:
        duplicate = conn.execute(
            "select 1 from users where email = %s or nik_hash = %s",
            (email, nik_hash),
        ).fetchone()
        if duplicate is not None:
            raise _error(
                409,
                "account_exists",
                "Email atau NIK sudah terdaftar. Gunakan data lain atau masuk ke akun Anda.",
            )

        village = conn.execute(
            "select district_id from villages where id = %s", (payload.kelurahan_id,)
        ).fetchone()
        if village is None or village["district_id"] != payload.kecamatan_id:
            raise _error(422, "invalid_region", "Kecamatan dan kelurahan tidak cocok.")

        password_hash = bcrypt.hashpw(
            payload.password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        ).decode("ascii")

        row = conn.execute(
            """
            insert into users (nik_enc, nik_hash, nik_last4, name, email, phone, address,
                               rt, rw, kecamatan_id, kelurahan_id, password_hash, role,
                               email_verified)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'warga', false)
            returning id
            """,
            (
                _encrypt_nik(payload.nik),
                nik_hash,
                payload.nik[-4:],
                payload.name,
                email,
                payload.phone,
                payload.address,
                payload.rt,
                payload.rw,
                payload.kecamatan_id,
                payload.kelurahan_id,
                password_hash,
            ),
        ).fetchone()
        token = _issue_email_token(conn, row["id"], "verify", VERIFY_TOKEN_TTL)

    mailer.send_verification_email(email, payload.name, token)
    return {
        "message": "Akun dibuat. Kami mengirim tautan verifikasi ke email Anda.",
        "email": email,
    }


@router.post("/auth/verify-email")
def verify_email(payload: TokenIn) -> dict[str, str]:
    with db.connection() as conn:
        token_row = _consume_email_token(conn, payload.token, "verify")
        conn.execute(
            "update users set email_verified = true where id = %s",
            (token_row["user_id"],),
        )
    return {"message": "Email berhasil diverifikasi. Silakan masuk."}


@router.post("/auth/resend-verification")
def resend_verification(payload: EmailIn) -> dict[str, str]:
    pending: tuple[str, str, str] | None = None
    with db.connection() as conn:
        row = conn.execute(
            "select id, name, email, email_verified from users where email = %s",
            (str(payload.email).lower(),),
        ).fetchone()
        if row is not None and not row["email_verified"]:
            token = _issue_email_token(conn, row["id"], "verify", VERIFY_TOKEN_TTL)
            pending = (row["email"], row["name"], token)

    if pending is not None:
        mailer.send_verification_email(*pending)
    return {
        "message": "Jika email terdaftar dan belum diverifikasi, tautan verifikasi telah dikirim."
    }


@router.post("/auth/login")
def login(payload: LoginIn) -> dict[str, Any]:
    with db.connection() as conn:
        row = conn.execute(
            "select id, role, password_hash, email_verified from users where email = %s",
            (str(payload.email).lower(),),
        ).fetchone()
        if row is None or not bcrypt.checkpw(
            payload.password.encode("utf-8"), row["password_hash"].encode("ascii")
        ):
            raise _error(401, "invalid_credentials", "Email atau kata sandi salah.")
        if not row["email_verified"]:
            raise _error(
                403,
                "email_not_verified",
                "Email belum diverifikasi. Buka tautan di email Anda atau kirim ulang verifikasi.",
            )
        user_row = _get_user_row(conn, row["id"])

    if user_row is None:
        raise _error(401, "unauthorized", "Akun tidak ditemukan.")
    return {
        "access_token": _create_access_token(row["id"], row["role"]),
        "token_type": "bearer",
        "user": _serialize_user(user_row),
    }


@router.post("/auth/forgot")
def forgot_password(payload: EmailIn) -> dict[str, str]:
    pending: tuple[str, str, str] | None = None
    with db.connection() as conn:
        row = conn.execute(
            "select id, name, email from users where email = %s",
            (str(payload.email).lower(),),
        ).fetchone()
        if row is not None:
            token = _issue_email_token(conn, row["id"], "reset", RESET_TOKEN_TTL)
            pending = (row["email"], row["name"], token)

    if pending is not None:
        mailer.send_reset_email(*pending)
    return {"message": "Jika email terdaftar, tautan reset kata sandi telah dikirim."}


@router.post("/auth/reset")
def reset_password(payload: ResetIn) -> dict[str, str]:
    password_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode("ascii")
    with db.connection() as conn:
        token_row = _consume_email_token(conn, payload.token, "reset")
        conn.execute(
            "update users set password_hash = %s where id = %s",
            (password_hash, token_row["user_id"]),
        )
        conn.execute(
            "update email_tokens set used_at = now()"
            " where user_id = %s and kind = 'reset' and used_at is null",
            (token_row["user_id"],),
        )
    return {"message": "Kata sandi berhasil diubah. Silakan masuk."}


@router.get("/me")
def me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": user}


@router.patch("/me")
def update_me(
    payload: ProfileIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    changes = {
        key: value
        for key, value in payload.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if not changes:
        raise _error(422, "no_changes", "Tidak ada data yang diubah.")

    with db.connection() as conn:
        current = conn.execute("select * from users where id = %s", (user["id"],)).fetchone()
        if current is None:
            raise _error(401, "unauthorized", "Akun tidak ditemukan.")

        district_id = changes.get("kecamatan_id", current["kecamatan_id"])
        village_id = changes.get("kelurahan_id", current["kelurahan_id"])
        if village_id is not None:
            village = conn.execute(
                "select district_id from villages where id = %s", (village_id,)
            ).fetchone()
            if village is None or (
                district_id is not None and village["district_id"] != district_id
            ):
                raise _error(422, "invalid_region", "Kecamatan dan kelurahan tidak cocok.")

        conn.execute(
            """
            update users
               set name = %s, phone = %s, address = %s, rt = %s, rw = %s,
                   kecamatan_id = %s, kelurahan_id = %s
             where id = %s
            """,
            (
                changes.get("name", current["name"]),
                changes.get("phone", current["phone"]),
                changes.get("address", current["address"]),
                changes.get("rt", current["rt"]),
                changes.get("rw", current["rw"]),
                district_id,
                village_id,
                user["id"],
            ),
        )
        row = _get_user_row(conn, user["id"])

    if row is None:
        raise _error(401, "unauthorized", "Akun tidak ditemukan.")
    return {"message": "Profil diperbarui.", "user": _serialize_user(row)}
