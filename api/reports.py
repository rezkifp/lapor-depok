"""Laporan warga: buat laporan, detail milik sendiri, dan bukti PDF.

Batas unggah (AGENTS.md bagian 9): maksimal 3 file, 5 MB per file, JPG/PNG/PDF.
Lampiran divalidasi dari isi file (Pillow untuk gambar, magic bytes untuk PDF),
disimpan di volume `uploads/`, dan tidak pernah disajikan sebagai file statis.
"""

from __future__ import annotations

import io
import logging
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image, UnidentifiedImageError
from psycopg.types.json import Jsonb
from pydantic import BaseModel

import config
import db
import mailer
import notify
import pdf
from auth import get_current_user, require_role

logger = logging.getLogger("lapor.reports")
router = APIRouter(tags=["reports"])

MAX_FILES = 3
MAX_FILE_BYTES = 5 * 1024 * 1024
DAILY_LIMIT = 5

MINE_PER_PAGE = 10
FOLLOWUP_MIN = 10
FOLLOWUP_MAX = 1000
FOLLOWUP_LIMIT = 5
RATING_ASPECTS = {
    "Kecepatan respons",
    "Kejelasan tanggapan",
    "Hasil penanganan",
    "Keramahan petugas",
}
RATING_COMMENT_MAX = 500

REPORT_TYPES = {"pengaduan", "aspirasi", "informasi"}
PRIORITIES = {"biasa", "mendesak"}
PRIVACIES = {"tampil", "rahasia", "anonim"}

TYPE_LABELS = {
    "pengaduan": "Pengaduan",
    "aspirasi": "Aspirasi",
    "informasi": "Permintaan Informasi",
}
PRIORITY_LABELS = {"biasa": "Prioritas Biasa", "mendesak": "Mendesak"}
PRIVACY_LABELS = {
    "tampil": "Tampilkan identitas",
    "rahasia": "Rahasiakan dari publik",
    "anonim": "Anonim",
}
WIB = ZoneInfo("Asia/Jakarta")


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _next_ticket_no(conn, year: int) -> str:
    conn.execute(
        "insert into ticket_counters (year, last_seq) values (%s, 0) on conflict (year) do nothing",
        (year,),
    )
    row = conn.execute(
        "select last_seq from ticket_counters where year = %s for update", (year,)
    ).fetchone()
    seq = row["last_seq"] + 1
    conn.execute("update ticket_counters set last_seq = %s where year = %s", (seq, year))
    return f"LPR-DPK-{year}-{seq:06d}"


def _safe_name(name: str) -> str:
    base = Path(name or "lampiran").name
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip(".-")
    if not base:
        base = "lampiran"
    if len(base) > 80:
        stem = Path(base).stem[:60]
        suffix = Path(base).suffix[:10]
        base = stem + suffix
    return base


def _detect_file(raw: bytes, declared: str | None) -> tuple[str, str] | None:
    """Kembalikan (mime, ekstensi) dari isi file, atau None jika tidak valid."""
    if raw.startswith(b"%PDF-"):
        return "application/pdf", ".pdf"

    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.verify()
        with Image.open(io.BytesIO(raw)) as image:
            fmt = (image.format or "").upper()
    except (UnidentifiedImageError, OSError):
        return None

    if fmt == "JPEG":
        return "image/jpeg", ".jpg"
    if fmt == "PNG":
        return "image/png", ".png"

    logger.info("Lampiran diabaikan: format gambar %s tidak didukung (%s)", fmt, declared)
    return None


def _public_detail(row: dict[str, Any], attachments: list[dict[str, Any]]) -> dict[str, Any]:
    location = ", ".join(
        part
        for part in (
            f"Kel. {row['village_name']}" if row["village_name"] else "",
            f"Kec. {row['district_name']}" if row["district_name"] else "",
        )
        if part
    )
    return {
        "ticket_no": row["ticket_no"],
        "title": row["title"],
        "body": row["body"],
        "type": row["type"],
        "priority": row["priority"],
        "privacy": row["privacy"],
        "status": row["status"],
        "incident_date": row["incident_date"].isoformat(),
        "created_at": row["created_at"].isoformat(),
        "category": {"id": row["category_id"], "name": row["category_name"]},
        "agency": (
            {"id": row["agency_id"], "name": row["agency_name"]}
            if row["agency_id"]
            else None
        ),
        "district": (
            {"id": row["district_id"], "name": row["district_name"]}
            if row["district_id"]
            else None
        ),
        "village": (
            {"id": row["village_id"], "name": row["village_name"]}
            if row["village_id"]
            else None
        ),
        "address": row["address"],
        "lat": row["lat"],
        "lng": row["lng"],
        "attachments": attachments,
    }


def _load_report(conn, ticket_no: str, user: dict[str, Any]) -> dict[str, Any]:
    row = conn.execute(
        """
        select r.id, r.ticket_no, r.user_id, r.title, r.body, r.type, r.priority,
               r.privacy, r.status, r.incident_date, r.created_at, r.address,
               r.lat, r.lng, r.category_id, c.name as category_name,
               r.agency_id, a.name as agency_name,
               r.district_id, d.name as district_name,
               r.village_id, v.name as village_name,
               r.rejection_reason, r.verified_at, r.processed_at, r.closed_at,
               u.name as reporter_name, u.email as reporter_email
          from reports r
          join categories c on c.id = r.category_id
          join users u on u.id = r.user_id
          left join agencies a on a.id = r.agency_id
          left join districts d on d.id = r.district_id
          left join villages v on v.id = r.village_id
         where upper(r.ticket_no) = %s
        """,
        (ticket_no.upper(),),
    ).fetchone()

    if row is None or (user["role"] == "warga" and row["user_id"] != user["id"]):
        raise _error(404, "report_not_found", "Laporan tidak ditemukan.")

    attachments = conn.execute(
        "select id, path, mime, size from attachments where report_id = %s order by id",
        (row["id"],),
    ).fetchall()
    row["attachments"] = [
        {
            "id": item["id"],
            "name": Path(item["path"]).name.split("_", 1)[-1],
            "mime": item["mime"],
            "size": item["size"],
        }
        for item in attachments
    ]
    return row


@router.post("/reports", status_code=201)
async def create_report(
    request: Request,
    report_type: str = Form(..., alias="type"),
    category_id: int = Form(...),
    agency_id: int | None = Form(None),
    priority: str = Form("biasa"),
    title: str = Form(...),
    body: str = Form(...),
    incident_date: date = Form(...),
    district_id: int = Form(...),
    village_id: int = Form(...),
    address: str = Form(...),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    privacy: str = Form("rahasia"),
    attachments: list[UploadFile] | None = File(None),
    user: dict[str, Any] = Depends(require_role("warga")),
) -> dict[str, Any]:
    title = _clean(title)
    body = _clean(body)
    address = _clean(address)
    report_type = _clean(report_type)
    priority = _clean(priority)
    privacy = _clean(privacy)

    if report_type not in REPORT_TYPES:
        raise _error(422, "invalid_type", "Jenis laporan tidak dikenal.")
    if priority not in PRIORITIES:
        raise _error(422, "invalid_priority", "Prioritas tidak dikenal.")
    if privacy not in PRIVACIES:
        raise _error(422, "invalid_privacy", "Pilihan privasi tidak dikenal.")
    if not 10 <= len(title) <= 100:
        raise _error(422, "invalid_title", "Judul laporan harus 10-100 karakter.")
    if not 30 <= len(body) <= 2000:
        raise _error(422, "invalid_body", "Uraian laporan harus 30-2000 karakter.")
    if len(address) < 5:
        raise _error(422, "invalid_address", "Alamat atau patokan lokasi minimal 5 karakter.")
    if incident_date > date.today():
        raise _error(422, "invalid_incident_date", "Tanggal kejadian tidak boleh di masa depan.")
    if (lat is None) != (lng is None):
        raise _error(422, "invalid_coordinate", "Titik peta tidak lengkap.")
    if lat is not None and not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise _error(422, "invalid_coordinate", "Koordinat peta tidak valid.")

    files = [item for item in (attachments or []) if item.filename]
    if len(files) > MAX_FILES:
        raise _error(422, "too_many_files", f"Maksimal {MAX_FILES} lampiran.")

    prepared: list[dict[str, Any]] = []
    for upload in files:
        raw = await upload.read(MAX_FILE_BYTES + 1)
        if len(raw) > MAX_FILE_BYTES:
            raise _error(413, "file_too_large", "Ukuran tiap lampiran maksimal 5 MB.")
        if not raw:
            continue
        detected = _detect_file(raw, upload.content_type)
        if detected is None:
            raise _error(
                422,
                "invalid_file_type",
                "Lampiran harus berupa gambar JPG/PNG atau dokumen PDF.",
            )
        mime, suffix = detected
        original = _safe_name(upload.filename or f"lampiran{suffix}")
        if not original.lower().endswith(suffix):
            original = f"{Path(original).stem}{suffix}"
        prepared.append({"raw": raw, "mime": mime, "name": original, "size": len(raw)})

    now = datetime.now(timezone.utc)
    year = now.year
    folder = config.upload_dir() / f"{year:04d}" / f"{now.month:02d}"
    stored: list[dict[str, Any]] = []

    try:
        folder.mkdir(parents=True, exist_ok=True)
        for item in prepared:
            filename = f"{uuid4().hex}_{item['name']}"
            target = folder / filename
            target.write_bytes(item["raw"])
            stored.append(
                {
                    "path": target.relative_to(config.upload_dir()).as_posix(),
                    "mime": item["mime"],
                    "size": item["size"],
                }
            )

        with db.connection() as conn:
            recent = conn.execute(
                "select count(*) as n from reports where user_id = %s and created_at >= now() - interval '1 day'",
                (user["id"],),
            ).fetchone()["n"]
            if recent >= DAILY_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "daily_limit",
                        "message": "Batas 5 laporan per hari sudah tercapai. Coba lagi besok.",
                    },
                    headers={"Retry-After": "86400"},
                )

            category = conn.execute(
                "select id, default_agency_id from categories where id = %s", (category_id,)
            ).fetchone()
            if category is None:
                raise _error(422, "invalid_category", "Kategori tidak ditemukan.")

            target_agency = agency_id if agency_id is not None else category["default_agency_id"]
            if target_agency is not None:
                exists = conn.execute(
                    "select 1 from agencies where id = %s", (target_agency,)
                ).fetchone()
                if exists is None:
                    raise _error(422, "invalid_agency", "Instansi tujuan tidak ditemukan.")

            village = conn.execute(
                "select id, district_id from villages where id = %s", (village_id,)
            ).fetchone()
            if village is None or village["district_id"] != district_id:
                raise _error(
                    422,
                    "invalid_region",
                    "Kelurahan tidak berada di kecamatan yang dipilih.",
                )

            ticket_no = _next_ticket_no(conn, year)
            row = conn.execute(
                """
                insert into reports (
                    ticket_no, user_id, type, category_id, agency_id, priority,
                    title, body, incident_date, district_id, village_id, address,
                    lat, lng, privacy, status
                ) values (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, 'diterima'
                )
                returning id, ticket_no, status, created_at
                """,
                (
                    ticket_no,
                    user["id"],
                    report_type,
                    category_id,
                    target_agency,
                    priority,
                    title,
                    body,
                    incident_date,
                    district_id,
                    village_id,
                    address,
                    lat,
                    lng,
                    privacy,
                ),
            ).fetchone()

            for item in stored:
                conn.execute(
                    "insert into attachments (report_id, path, mime, size) values (%s, %s, %s, %s)",
                    (row["id"], item["path"], item["mime"], item["size"]),
                )

            conn.execute(
                """
                insert into report_events (report_id, status, note_public, actor_id)
                values (%s, 'diterima', %s, %s)
                """,
                (
                    row["id"],
                    "Laporan diterima dan menunggu verifikasi admin.",
                    user["id"],
                ),
            )
            conn.execute(
                "insert into audit_logs (actor_id, action, target, meta) values (%s, %s, %s, %s)",
                (
                    user["id"],
                    "report.create",
                    ticket_no,
                    Jsonb(
                        {
                            "type": report_type,
                            "category_id": category_id,
                            "priority": priority,
                            "privacy": privacy,
                            "attachments": len(stored),
                        }
                    ),
                ),
            )
    except Exception:
        for item in stored:
            try:
                (config.upload_dir() / item["path"]).unlink(missing_ok=True)
            except OSError:
                logger.warning("Gagal menghapus lampiran yatim %s", item["path"])
        raise

    mailer.send_report_received_email(user["email"], user["name"], ticket_no, title)
    notify.send_event(
        {
            "event": "report.created",
            "ticket_no": ticket_no,
            "status": row["status"],
            "category_id": category_id,
            "agency_id": target_agency,
            "priority": priority,
            "privacy": privacy,
            "created_at": row["created_at"].isoformat(),
        }
    )

    return {
        "id": row["id"],
        "ticket_no": row["ticket_no"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
        "attachments": stored,
    }


@router.get("/reports/mine")
def my_reports(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    user: dict[str, Any] = Depends(require_role("warga")),
) -> dict[str, Any]:
    """Daftar laporan milik warga yang sedang masuk, 10 per halaman."""
    statuses = {"diterima", "diverifikasi", "diproses", "selesai", "ditolak"}
    if status and status not in statuses:
        raise _error(422, "invalid_status", "Status laporan tidak dikenal.")

    where = ["r.user_id = %s"]
    params: list[Any] = [user["id"]]
    if status:
        where.append("r.status = %s")
        params.append(status)
    clause = " and ".join(where)

    with db.connection() as conn:
        total = conn.execute(
            f"select count(*) as n from reports r where {clause}", params
        ).fetchone()["n"]
        rows = conn.execute(
            f"""
            select r.ticket_no, r.title, r.status, r.type, r.priority,
                   r.created_at, r.updated_at,
                   r.category_id, c.name as category_name,
                   r.agency_id, a.name as agency_name
              from reports r
              join categories c on c.id = r.category_id
              left join agencies a on a.id = r.agency_id
             where {clause}
             order by r.created_at desc, r.id desc
             limit %s offset %s
            """,
            [*params, MINE_PER_PAGE, (page - 1) * MINE_PER_PAGE],
        ).fetchall()

    total = int(total)
    return {
        "items": [
            {
                "ticket_no": row["ticket_no"],
                "title": row["title"],
                "status": row["status"],
                "type": row["type"],
                "priority": row["priority"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat(),
                "category": {"id": row["category_id"], "name": row["category_name"]},
                "agency": (
                    {"id": row["agency_id"], "name": row["agency_name"]}
                    if row["agency_id"]
                    else None
                ),
            }
            for row in rows
        ],
        "page": page,
        "per_page": MINE_PER_PAGE,
        "total": total,
        "total_pages": max(1, (total + MINE_PER_PAGE - 1) // MINE_PER_PAGE),
    }


@router.get("/reports/{ticket}")
def report_detail(
    ticket: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with db.connection() as conn:
        row = _load_report(conn, ticket.strip(), user)
        events = conn.execute(
            """
            select status, note_public, created_at
              from report_events
             where report_id = %s and note_public is not null
             order by created_at, id
            """,
            (row["id"],),
        ).fetchall()
        followups = conn.execute(
            """
            select id, body, created_at
              from followups
             where report_id = %s
             order by created_at, id
            """,
            (row["id"],),
        ).fetchall()
        rating = conn.execute(
            """
            select id, score, aspects, comment, created_at
              from ratings
             where report_id = %s
            """,
            (row["id"],),
        ).fetchone()

    detail = _public_detail(row, row["attachments"])
    detail["rejection_reason"] = row.get("rejection_reason")
    detail["verified_at"] = row["verified_at"].isoformat() if row.get("verified_at") else None
    detail["processed_at"] = (
        row["processed_at"].isoformat() if row.get("processed_at") else None
    )
    detail["closed_at"] = row["closed_at"].isoformat() if row.get("closed_at") else None
    detail["reporter"] = {
        "name": row["reporter_name"],
        "email": row["reporter_email"],
    }
    detail["timeline"] = [
        {
            "status": event["status"],
            "note_public": event["note_public"],
            "created_at": event["created_at"].isoformat(),
        }
        for event in events
    ]
    detail["followups"] = [
        {
            "id": item["id"],
            "body": item["body"],
            "created_at": item["created_at"].isoformat(),
        }
        for item in followups
    ]
    detail["rating"] = (
        {
            "id": rating["id"],
            "score": rating["score"],
            "aspects": rating["aspects"] or [],
            "comment": rating["comment"],
            "created_at": rating["created_at"].isoformat(),
        }
        if rating
        else None
    )
    return detail


class FollowupInput(BaseModel):
    body: str = ""


class RatingInput(BaseModel):
    score: int | None = None
    aspects: list[str] | None = None
    comment: str | None = None


@router.post("/reports/{ticket}/followups", status_code=201)
def add_followup(
    ticket: str,
    payload: FollowupInput,
    user: dict[str, Any] = Depends(require_role("warga")),
) -> dict[str, Any]:
    """Tanggapan tambahan pelapor, maksimal 5 per laporan."""
    body = _clean(payload.body)
    if not FOLLOWUP_MIN <= len(body) <= FOLLOWUP_MAX:
        raise _error(
            422,
            "invalid_followup_body",
            f"Tanggapan harus {FOLLOWUP_MIN}-{FOLLOWUP_MAX} karakter.",
        )

    with db.connection() as conn:
        row = _load_report(conn, ticket.strip(), user)
        locked = conn.execute(
            "select status from reports where id = %s for update", (row["id"],)
        ).fetchone()
        if locked["status"] in ("selesai", "ditolak"):
            raise _error(
                409,
                "report_closed",
                "Tanggapan tidak dapat ditambahkan karena laporan sudah final.",
            )
        total = int(
            conn.execute(
                "select count(*) as n from followups where report_id = %s", (row["id"],)
            ).fetchone()["n"]
        )
        if total >= FOLLOWUP_LIMIT:
            raise _error(
                409,
                "followup_limit",
                f"Tanggapan maksimal {FOLLOWUP_LIMIT} per laporan.",
            )
        created = conn.execute(
            """
            insert into followups (report_id, user_id, body)
            values (%s, %s, %s)
            returning id, body, created_at
            """,
            (row["id"], user["id"], body),
        ).fetchone()

    return {
        "id": created["id"],
        "body": created["body"],
        "created_at": created["created_at"].isoformat(),
        "total": total + 1,
        "remaining": max(0, FOLLOWUP_LIMIT - total - 1),
    }


@router.post("/reports/{ticket}/rating", status_code=201)
def submit_rating(
    ticket: str,
    payload: RatingInput,
    user: dict[str, Any] = Depends(require_role("warga")),
) -> dict[str, Any]:
    """Satu penilaian per laporan selesai, hanya oleh pelapor asli."""
    if payload.score is None or not 1 <= payload.score <= 5:
        raise _error(422, "invalid_score", "Skor penilaian harus antara 1 dan 5.")

    aspects: list[str] = []
    for raw in payload.aspects or []:
        text = _clean(raw)
        if not text:
            continue
        if text not in RATING_ASPECTS:
            raise _error(422, "invalid_aspect", "Aspek penilaian tidak dikenal.")
        if text not in aspects:
            aspects.append(text)

    comment = _clean(payload.comment)
    if len(comment) > RATING_COMMENT_MAX:
        raise _error(
            422,
            "invalid_comment",
            f"Komentar maksimal {RATING_COMMENT_MAX} karakter.",
        )

    with db.connection() as conn:
        row = _load_report(conn, ticket.strip(), user)
        locked = conn.execute(
            "select status from reports where id = %s for update", (row["id"],)
        ).fetchone()
        if locked["status"] != "selesai":
            raise _error(
                409,
                "report_not_completed",
                "Penilaian hanya dapat dikirim setelah laporan selesai.",
            )
        exists = conn.execute(
            "select 1 from ratings where report_id = %s", (row["id"],)
        ).fetchone()
        if exists is not None:
            raise _error(409, "already_rated", "Laporan ini sudah pernah dinilai.")

        created = conn.execute(
            """
            insert into ratings (report_id, user_id, score, aspects, comment)
            values (%s, %s, %s, %s, %s)
            returning id, score, aspects, comment, created_at
            """,
            (row["id"], user["id"], payload.score, aspects or None, comment or None),
        ).fetchone()

    return {
        "id": created["id"],
        "score": created["score"],
        "aspects": created["aspects"] or [],
        "comment": created["comment"],
        "created_at": created["created_at"].isoformat(),
    }


@router.get("/reports/{ticket}/attachments/{attachment_id}")
def report_attachment(
    ticket: str,
    attachment_id: int,
    user: dict[str, Any] = Depends(get_current_user),
) -> FileResponse:
    """Lampiran disajikan ber-auth; tidak ada folder publik."""
    with db.connection() as conn:
        row = _load_report(conn, ticket.strip(), user)
        item = conn.execute(
            """
            select path, mime, size
              from attachments
             where id = %s and report_id = %s
            """,
            (attachment_id, row["id"]),
        ).fetchone()

    if item is None:
        raise _error(404, "attachment_not_found", "Lampiran tidak ditemukan.")

    root = config.upload_dir().resolve()
    target = (root / item["path"]).resolve()
    if root != target and root not in target.parents:
        raise _error(404, "attachment_not_found", "Lampiran tidak ditemukan.")
    if not target.is_file():
        raise _error(404, "attachment_not_found", "Berkas lampiran tidak tersedia.")

    name = Path(item["path"]).name.split("_", 1)[-1]
    return FileResponse(
        target,
        media_type=item["mime"],
        headers={
            "Content-Disposition": f'inline; filename="{name}"',
            "Cache-Control": "private, max-age=300",
        },
    )


@router.get("/reports/{ticket}/receipt.pdf")
def report_receipt(
    ticket: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
    with db.connection() as conn:
        row = _load_report(conn, ticket.strip(), user)

    created = row["created_at"].astimezone(WIB)
    location_line = " - ".join(
        part
        for part in (
            ", ".join(
                item
                for item in (
                    f"Kel. {row['village_name']}" if row["village_name"] else "",
                    f"Kec. {row['district_name']}" if row["district_name"] else "",
                )
                if item
            ),
            row["address"] or "",
        )
        if part
    )
    origin = request.headers.get("origin") or config.app_base_url()
    content = pdf.build_receipt(
        {
            "ticket_no": row["ticket_no"],
            "created_at": row["created_at"].isoformat(),
            "reporter_name": row["reporter_name"],
            "type_label": TYPE_LABELS.get(row["type"], row["type"]),
            "category_name": row["category_name"],
            "agency_name": row["agency_name"],
            "priority_label": PRIORITY_LABELS.get(row["priority"], row["priority"]),
            "title": row["title"],
            "location_line": location_line or "-",
            "incident_date_label": row["incident_date"].strftime("%d-%m-%Y"),
            "privacy_label": PRIVACY_LABELS.get(row["privacy"], row["privacy"]),
            "created_label": created.strftime("%d-%m-%Y %H.%M WIB"),
        },
        origin,
    )

    headers = {
        "Content-Disposition": f'attachment; filename="bukti-{row["ticket_no"]}.pdf"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(io.BytesIO(content), media_type="application/pdf", headers=headers)
