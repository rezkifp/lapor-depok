"""Endpoint panel admin: dashboard, daftar laporan, detail, dan tindakan.

Semua endpoint memakai `require_role` (AGENTS.md bagian 6 dan 9).
- Petugas dinas hanya melihat laporan dengan `agency_id` instansinya.
- Identitas pelapor `anonim` hanya terbuka untuk super admin.
- Perubahan status ditulis dalam satu transaksi; email dan webhook dikirim
  setelah commit dan kegagalannya tidak menggagalkan request.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field
import re

import config
import db
import mailer
import notify
from auth import require_role

logger = logging.getLogger("lapor.admin")
router = APIRouter(tags=["admin"])

ADMIN_ROLES = ("admin_verifikator", "petugas_dinas", "super_admin")
VERIFIER_ROLES = ("admin_verifikator", "super_admin")
PER_PAGE = 10
WIB = ZoneInfo("Asia/Jakarta")

STATUSES = ("diterima", "diverifikasi", "diproses", "selesai", "ditolak")
STATUS_LABELS = {
    "diterima": "Diterima",
    "diverifikasi": "Diverifikasi",
    "diproses": "Diproses",
    "selesai": "Selesai",
    "ditolak": "Ditolak",
}
TYPE_LABELS = {
    "pengaduan": "Pengaduan",
    "aspirasi": "Aspirasi",
    "informasi": "Permintaan Informasi",
}
PRIVACY_LABELS = {
    "tampil": "Tampilkan identitas",
    "rahasia": "Rahasiakan dari publik",
    "anonim": "Anonim",
}
PRIORITY_LABELS = {"biasa": "Biasa", "mendesak": "Mendesak"}

# Transisi yang diizinkan (AGENTS.md bagian 7).
TRANSITIONS: dict[str, tuple[str, ...]] = {
    "diterima": ("diverifikasi", "ditolak"),
    "diverifikasi": ("diproses", "ditolak"),
    "diproses": ("selesai",),
    "selesai": (),
    "ditolak": (),
}

DEFAULT_EVENT_NOTES = {
    "diverifikasi": "Laporan telah diverifikasi dan diteruskan ke instansi terkait.",
    "diproses": "Laporan sedang ditangani oleh instansi terkait.",
    "selesai": "Laporan selesai ditangani. Terima kasih atas laporan Anda.",
}
AUDIT_ACTIONS = {
    "diverifikasi": "report.verified",
    "ditolak": "report.rejected",
    "diproses": "report.processed",
    "selesai": "report.closed",
}
MONTH_LABELS = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
)
MAX_NOTE_LENGTH = 2000


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    if len(phone) < 8:
        return phone
    return f"{phone[:4]}••••{phone[-3:]}"


def _user_agency_id(user: dict[str, Any]) -> int | None:
    agency = user.get("agency")
    return agency["id"] if isinstance(agency, dict) else None


def _scope_clause(user: dict[str, Any], alias: str = "r") -> tuple[str, list[Any]]:
    """Filter instansi untuk petugas dinas; peran lain melihat semua."""
    if user["role"] != "petugas_dinas":
        return "", []
    agency_id = _user_agency_id(user)
    if not agency_id:
        return "and false", []
    return f"and {alias}.agency_id = %s", [agency_id]


def _sla_settings(conn) -> tuple[int, int]:
    rows = conn.execute(
        "select key, value from settings where key in ('sla_verify_days', 'sla_process_days')"
    ).fetchall()
    values = {row["key"]: row["value"] for row in rows}

    def _parse(raw: Any, fallback: int) -> int:
        try:
            return max(0, int(str(raw)))
        except (TypeError, ValueError):
            return fallback

    return _parse(values.get("sla_verify_days"), 2), _parse(values.get("sla_process_days"), 14)


def _add_working_days(start: date, days: int) -> date:
    """Tambahkan hari kerja Senin-Jumat tanpa kalender libur."""
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


def _is_overdue(
    status: str,
    created_at: datetime,
    processed_at: datetime | None,
    now: datetime,
    verify_days: int,
    process_days: int,
) -> bool:
    today = now.astimezone(WIB).date()
    if status == "diterima":
        base = created_at.astimezone(WIB).date()
        return today > _add_working_days(base, verify_days)
    if status == "diproses":
        base = (processed_at or created_at).astimezone(WIB).date()
        return today > _add_working_days(base, process_days)
    return False


def _overdue_ids(
    conn,
    scope_sql: str,
    scope_params: list[Any],
    verify_days: int,
    process_days: int,
) -> set[int]:
    now = datetime.now(timezone.utc)
    rows = conn.execute(
        f"""
        select r.id, r.status, r.created_at, r.processed_at
          from reports r
         where r.status in ('diterima', 'diproses') {scope_sql}
        """,
        scope_params,
    ).fetchall()
    return {
        row["id"]
        for row in rows
        if _is_overdue(
            row["status"],
            row["created_at"],
            row["processed_at"],
            now,
            verify_days,
            process_days,
        )
    }


def _month_start(value: datetime, months_back: int) -> datetime:
    month_index = value.year * 12 + (value.month - 1) - months_back
    return datetime(month_index // 12, month_index % 12 + 1, 1, tzinfo=WIB)


def _allowed_statuses(
    status: str, user: dict[str, Any], agency_id: int | None
) -> list[str]:
    base = TRANSITIONS.get(status, ())
    if user["role"] == "petugas_dinas":
        if not _user_agency_id(user) or agency_id != _user_agency_id(user):
            return []
        return [item for item in base if item in ("diproses", "selesai")]
    return list(base)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@router.get("/admin/dashboard")
def dashboard(user: dict[str, Any] = Depends(require_role(*ADMIN_ROLES))) -> dict[str, Any]:
    scope_sql, scope_params = _scope_clause(user)

    with db.connection() as conn:
        status_rows = conn.execute(
            f"select r.status, count(*) as n from reports r where true {scope_sql} group by r.status",
            scope_params,
        ).fetchall()
        counts = {status: 0 for status in STATUSES}
        for row in status_rows:
            counts[row["status"]] = int(row["n"])
        total = sum(counts.values())

        verify_days, process_days = _sla_settings(conn)
        overdue = len(_overdue_ids(conn, scope_sql, scope_params, verify_days, process_days))

        now = datetime.now(WIB)
        start = _month_start(now, 5)
        trend_rows = conn.execute(
            f"""
            select to_char(r.created_at at time zone 'Asia/Jakarta', 'YYYY-MM') as month_key,
                   count(*) as n
              from reports r
             where r.created_at >= %s {scope_sql}
             group by month_key
            """,
            [start, *scope_params],
        ).fetchall()
        trend_map = {
            row["month_key"]: int(row["n"]) for row in trend_rows if row["month_key"]
        }
        trend: list[dict[str, Any]] = []
        for offset in range(6):
            bucket = _month_start(now, 5 - offset)
            key = f"{bucket.year:04d}-{bucket.month:02d}"
            trend.append(
                {
                    "month": key,
                    "label": MONTH_LABELS[bucket.month - 1],
                    "total": trend_map.get(key, 0),
                }
            )

        category_rows = conn.execute(
            f"""
            select c.id, c.name, count(*) as n
              from reports r
              join categories c on c.id = r.category_id
             where true {scope_sql}
             group by c.id, c.name
             order by n desc, c.name
            """,
            scope_params,
        ).fetchall()

        latest_rows = conn.execute(
            f"""
            select r.id, r.ticket_no, r.title, r.priority, r.status, r.created_at,
                   d.name as district_name
              from reports r
              left join districts d on d.id = r.district_id
             where true {scope_sql}
             order by r.created_at desc, r.id desc
             limit 5
            """,
            scope_params,
        ).fetchall()

    agency = user.get("agency")
    return {
        "scope": {
            "role": user["role"],
            "restricted": user["role"] == "petugas_dinas",
            "agency": agency,
        },
        "total_reports": total,
        "by_status": counts,
        "overdue": overdue,
        "sla": {"verify_days": verify_days, "process_days": process_days},
        "trend": trend,
        "by_category": [
            {"id": row["id"], "name": row["name"], "total": int(row["n"])}
            for row in category_rows
        ],
        "latest": [
            {
                "id": row["id"],
                "ticket_no": row["ticket_no"],
                "title": row["title"],
                "priority": row["priority"],
                "status": row["status"],
                "district": row["district_name"],
                "created_at": _iso(row["created_at"]),
            }
            for row in latest_rows
        ],
    }


# ---------------------------------------------------------------------------
# Daftar laporan
# ---------------------------------------------------------------------------


@router.get("/admin/reports")
def list_reports(
    status: str | None = Query(None),
    category: int | None = Query(None, gt=0),
    district: int | None = Query(None, gt=0),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    sla: str | None = Query(None),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    user: dict[str, Any] = Depends(require_role(*ADMIN_ROLES)),
) -> dict[str, Any]:
    if status and status not in STATUSES:
        raise _error(422, "invalid_status", "Status laporan tidak dikenal.")
    if sla and sla != "overdue":
        raise _error(422, "invalid_sla", "Filter SLA tidak dikenal.")
    if date_from and date_to and date_from > date_to:
        raise _error(422, "invalid_date_range", "Tanggal awal tidak boleh melewati tanggal akhir.")

    scope_sql, scope_params = _scope_clause(user)
    where = [f"true {scope_sql}"]
    params: list[Any] = list(scope_params)

    if status:
        where.append("r.status = %s")
        params.append(status)
    if category is not None:
        where.append("r.category_id = %s")
        params.append(category)
    if district is not None:
        where.append("r.district_id = %s")
        params.append(district)
    if date_from:
        where.append("r.created_at >= %s")
        params.append(datetime.combine(date_from, time.min, tzinfo=WIB))
    if date_to:
        where.append("r.created_at < %s")
        params.append(datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=WIB))
    if q:
        term = f"%{q.strip()}%"
        where.append("(r.ticket_no ilike %s or r.title ilike %s)")
        params.extend([term, term])

    with db.connection() as conn:
        verify_days, process_days = _sla_settings(conn)
        overdue = _overdue_ids(conn, scope_sql, scope_params, verify_days, process_days)
        if sla == "overdue":
            if overdue:
                where.append(f"r.id in ({', '.join(['%s'] * len(overdue))})")
                params.extend(sorted(overdue))
            else:
                where.append("false")

        clause = " and ".join(where)
        total = int(
            conn.execute(
                f"select count(*) as n from reports r where {clause}", params
            ).fetchone()["n"]
        )
        rows = conn.execute(
            f"""
            select r.id, r.ticket_no, r.title, r.priority, r.status, r.privacy,
                   r.created_at, r.processed_at,
                   r.category_id, c.name as category_name,
                   r.district_id, d.name as district_name,
                   r.agency_id, a.name as agency_name
              from reports r
              join categories c on c.id = r.category_id
              left join districts d on d.id = r.district_id
              left join agencies a on a.id = r.agency_id
             where {clause}
             order by r.created_at desc, r.id desc
             limit %s offset %s
            """,
            [*params, PER_PAGE, (page - 1) * PER_PAGE],
        ).fetchall()

        scope_counts = conn.execute(
            f"select count(*) as total,"
            f" count(*) filter (where r.status = 'diterima') as awaiting"
            f" from reports r where true {scope_sql}",
            scope_params,
        ).fetchone()

    total_pages = max(1, (total + PER_PAGE - 1) // PER_PAGE)
    return {
        "items": [
            {
                "id": row["id"],
                "ticket_no": row["ticket_no"],
                "title": row["title"],
                "priority": row["priority"],
                "status": row["status"],
                "privacy": row["privacy"],
                "created_at": _iso(row["created_at"]),
                "overdue": row["id"] in overdue,
                "category": {"id": row["category_id"], "name": row["category_name"]},
                "district": (
                    {"id": row["district_id"], "name": row["district_name"]}
                    if row["district_id"]
                    else None
                ),
                "agency": (
                    {"id": row["agency_id"], "name": row["agency_name"]}
                    if row["agency_id"]
                    else None
                ),
            }
            for row in rows
        ],
        "page": page,
        "per_page": PER_PAGE,
        "total": total,
        "total_pages": total_pages,
        "scope_total": int(scope_counts["total"]),
        "awaiting_verification": int(scope_counts["awaiting"]),
        "overdue": len(overdue),
        "scope": {
            "role": user["role"],
            "restricted": user["role"] == "petugas_dinas",
            "agency": user.get("agency"),
        },
    }


# ---------------------------------------------------------------------------
# Detail laporan
# ---------------------------------------------------------------------------


@router.get("/admin/reports/{report_id}")
def report_detail(
    report_id: int,
    user: dict[str, Any] = Depends(require_role(*ADMIN_ROLES)),
) -> dict[str, Any]:
    with db.connection() as conn:
        row = conn.execute(
            """
            select r.*, c.name as category_name,
                   a.name as agency_name,
                   d.name as district_name,
                   v.name as village_name,
                   u.name as reporter_name,
                   u.email as reporter_email,
                   u.phone as reporter_phone,
                   u.address as reporter_address,
                   u.nik_last4 as reporter_nik_last4,
                   ud.name as reporter_district,
                   uv.name as reporter_village
              from reports r
              join categories c on c.id = r.category_id
              join users u on u.id = r.user_id
              left join agencies a on a.id = r.agency_id
              left join districts d on d.id = r.district_id
              left join villages v on v.id = r.village_id
              left join districts ud on ud.id = u.kecamatan_id
              left join villages uv on uv.id = u.kelurahan_id
             where r.id = %s
            """,
            (report_id,),
        ).fetchone()

        if row is None:
            raise _error(404, "report_not_found", "Laporan tidak ditemukan.")
        if user["role"] == "petugas_dinas" and row["agency_id"] != _user_agency_id(user):
            raise _error(404, "report_not_found", "Laporan tidak ditemukan.")

        events = conn.execute(
            """
            select e.id, e.status, e.note_public, e.note_internal, e.created_at,
                   u.name as actor_name
              from report_events e
              left join users u on u.id = e.actor_id
             where e.report_id = %s
             order by e.created_at, e.id
            """,
            (report_id,),
        ).fetchall()
        followups = conn.execute(
            """
            select id, body, created_at
              from followups
             where report_id = %s
             order by created_at, id
            """,
            (report_id,),
        ).fetchall()
        rating = conn.execute(
            "select score, aspects, comment, created_at from ratings where report_id = %s",
            (report_id,),
        ).fetchone()
        attachments = conn.execute(
            "select id, path, mime, size from attachments where report_id = %s order by id",
            (report_id,),
        ).fetchall()
        verify_days, process_days = _sla_settings(conn)

    hidden = row["privacy"] == "anonim" and user["role"] != "super_admin"
    reporter = {
        "hidden": hidden,
        "privacy": row["privacy"],
        "privacy_label": PRIVACY_LABELS.get(row["privacy"], row["privacy"]),
        "name": None if hidden else row["reporter_name"],
        "email": None if hidden else row["reporter_email"],
        "phone": None if hidden else _mask_phone(row["reporter_phone"]),
        "nik_last4": None if hidden else row["reporter_nik_last4"],
        "address": None if hidden else row["reporter_address"],
        "village": None if hidden else row["reporter_village"],
        "district": None if hidden else row["reporter_district"],
        "note": "Identitas disembunyikan (anonim)" if hidden else None,
    }

    return {
        "id": row["id"],
        "ticket_no": row["ticket_no"],
        "title": row["title"],
        "body": row["body"],
        "type": row["type"],
        "type_label": TYPE_LABELS.get(row["type"], row["type"]),
        "priority": row["priority"],
        "priority_label": PRIORITY_LABELS.get(row["priority"], row["priority"]),
        "privacy": row["privacy"],
        "privacy_label": PRIVACY_LABELS.get(row["privacy"], row["privacy"]),
        "status": row["status"],
        "status_label": STATUS_LABELS.get(row["status"], row["status"]),
        "incident_date": row["incident_date"].isoformat(),
        "created_at": _iso(row["created_at"]),
        "updated_at": _iso(row["updated_at"]),
        "verified_at": _iso(row["verified_at"]),
        "processed_at": _iso(row["processed_at"]),
        "closed_at": _iso(row["closed_at"]),
        "rejection_reason": row["rejection_reason"],
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
        "overdue": _is_overdue(
            row["status"],
            row["created_at"],
            row["processed_at"],
            datetime.now(timezone.utc),
            verify_days,
            process_days,
        ),
        "attachments": [
            {
                "id": item["id"],
                "name": Path(item["path"]).name.split("_", 1)[-1],
                "mime": item["mime"],
                "size": item["size"],
            }
            for item in attachments
        ],
        "reporter": reporter,
        "events": [
            {
                "id": event["id"],
                "status": event["status"],
                "status_label": STATUS_LABELS.get(event["status"], event["status"]),
                "note_public": event["note_public"],
                "note_internal": event["note_internal"],
                "actor_name": event["actor_name"] or "Sistem",
                "created_at": _iso(event["created_at"]),
            }
            for event in events
        ],
        "followups": [
            {
                "id": item["id"],
                "body": item["body"],
                "created_at": _iso(item["created_at"]),
            }
            for item in followups
        ],
        "rating": (
            {
                "score": rating["score"],
                "aspects": rating["aspects"] or [],
                "comment": rating["comment"],
                "created_at": _iso(rating["created_at"]),
            }
            if rating
            else None
        ),
        "allowed_statuses": _allowed_statuses(row["status"], user, row["agency_id"]),
        "can_dispatch": user["role"] in VERIFIER_ROLES,
    }


# ---------------------------------------------------------------------------
# Tindakan admin
# ---------------------------------------------------------------------------


class ActionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str | None = None
    agency_id: int | None = None
    priority: str | None = None
    reply_public: str | None = None
    note_internal: str | None = None


class CategoryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=150)
    default_agency_id: int | None = Field(default=None, gt=0)


class CategoryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=150)
    default_agency_id: int | None = Field(default=None, gt=0)


class AgencyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=150)


class DistrictIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=150)


class VillageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=150)


class VillageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=2, max_length=150)


@router.patch("/admin/reports/{report_id}/action")
def report_action(
    report_id: int,
    payload: ActionIn,
    user: dict[str, Any] = Depends(require_role(*ADMIN_ROLES)),
) -> dict[str, Any]:
    provided = payload.model_fields_set
    if not provided:
        raise _error(422, "no_changes", "Tidak ada perubahan yang dikirim.")

    status = payload.status.strip() if payload.status is not None else None
    priority = payload.priority.strip() if payload.priority is not None else None
    reply_public = (payload.reply_public or "").strip()
    note_internal = (payload.note_internal or "").strip()

    if status is not None and status not in STATUSES:
        raise _error(422, "invalid_status", "Status laporan tidak dikenal.")
    if priority is not None and priority not in PRIORITY_LABELS:
        raise _error(422, "invalid_priority", "Prioritas tidak dikenal.")
    if len(reply_public) > MAX_NOTE_LENGTH or len(note_internal) > MAX_NOTE_LENGTH:
        raise _error(422, "note_too_long", f"Catatan maksimal {MAX_NOTE_LENGTH} karakter.")
    if user["role"] == "petugas_dinas" and (
        payload.agency_id is not None or payload.priority is not None
    ):
        raise _error(
            403,
            "forbidden",
            "Petugas dinas tidak dapat mengubah instansi atau prioritas laporan.",
        )

    with db.connection() as conn:
        row = conn.execute(
            """
            select r.id, r.ticket_no, r.title, r.status, r.agency_id, r.priority,
                   r.rejection_reason, r.verified_at, r.processed_at, r.closed_at,
                   u.name as reporter_name, u.email as reporter_email
              from reports r
              join users u on u.id = r.user_id
             where r.id = %s
             for update of r
            """,
            (report_id,),
        ).fetchone()
        if row is None:
            raise _error(404, "report_not_found", "Laporan tidak ditemukan.")
        if user["role"] == "petugas_dinas" and row["agency_id"] != _user_agency_id(user):
            raise _error(404, "report_not_found", "Laporan tidak ditemukan.")

        current_status = row["status"]
        new_status = status or current_status
        status_changed = status is not None and status != current_status

        if status_changed and new_status not in TRANSITIONS.get(current_status, ()):
            raise _error(
                409,
                "invalid_transition",
                f"Status tidak dapat diubah dari {STATUS_LABELS[current_status]}"
                f" ke {STATUS_LABELS.get(new_status, new_status)}.",
            )
        if (
            user["role"] == "petugas_dinas"
            and status_changed
            and new_status not in ("diproses", "selesai")
        ):
            raise _error(
                403,
                "forbidden",
                "Petugas dinas hanya dapat mengubah status ke Diproses atau Selesai.",
            )
        if new_status == "ditolak" and not reply_public:
            raise _error(
                422,
                "rejection_reason_required",
                "Alasan penolakan wajib diisi dan akan dikirim ke pelapor.",
            )

        if payload.agency_id is not None:
            agency = conn.execute(
                "select id from agencies where id = %s", (payload.agency_id,)
            ).fetchone()
            if agency is None:
                raise _error(422, "invalid_agency", "Instansi tujuan tidak ditemukan.")

        new_agency_id = payload.agency_id if payload.agency_id is not None else row["agency_id"]
        new_priority = priority if priority is not None else row["priority"]
        reply_for_event = reply_public or (
            DEFAULT_EVENT_NOTES.get(new_status) if status_changed else None
        )

        changes = {
            "status": status_changed,
            "agency": new_agency_id != row["agency_id"],
            "priority": new_priority != row["priority"],
            "reply_public": bool(reply_public),
            "note_internal": bool(note_internal),
        }
        if not any(changes.values()):
            raise _error(422, "no_changes", "Tidak ada perubahan yang perlu disimpan.")

        now = datetime.now(timezone.utc)
        verified_at = row["verified_at"]
        processed_at = row["processed_at"]
        closed_at = row["closed_at"]
        rejection_reason = row["rejection_reason"]

        if status_changed:
            if new_status == "diverifikasi":
                verified_at = verified_at or now
            elif new_status == "diproses":
                verified_at = verified_at or now
                processed_at = processed_at or now
            elif new_status == "selesai":
                processed_at = processed_at or now
                closed_at = now
            elif new_status == "ditolak":
                closed_at = now
                rejection_reason = reply_public

        conn.execute(
            """
            update reports
               set status = %s, agency_id = %s, priority = %s,
                   rejection_reason = %s, verified_at = %s, processed_at = %s,
                   closed_at = %s, updated_at = %s
             where id = %s
            """,
            (
                new_status,
                new_agency_id,
                new_priority,
                rejection_reason,
                verified_at,
                processed_at,
                closed_at,
                now,
                report_id,
            ),
        )

        writes_event = status_changed or bool(reply_for_event) or bool(note_internal) or (
            new_agency_id != row["agency_id"] or new_priority != row["priority"]
        )
        if writes_event:
            conn.execute(
                """
                insert into report_events (report_id, status, note_public, note_internal, actor_id)
                values (%s, %s, %s, %s, %s)
                """,
                (report_id, new_status, reply_for_event, note_internal or None, user["id"]),
            )

        action = AUDIT_ACTIONS.get(new_status) if status_changed else "report.updated"
        conn.execute(
            "insert into audit_logs (actor_id, action, target, meta) values (%s, %s, %s, %s)",
            (
                user["id"],
                action,
                row["ticket_no"],
                Jsonb(
                    {
                        "from_status": current_status,
                        "to_status": new_status,
                        "agency_id": new_agency_id,
                        "priority": new_priority,
                        "has_reply": bool(reply_public),
                        "has_internal_note": bool(note_internal),
                    }
                ),
            ),
        )

    # Di luar transaksi: kegagalan email/webhook tidak menggagalkan request.
    mailer.send_report_update_email(
        row["reporter_email"],
        row["reporter_name"],
        row["ticket_no"],
        row["title"],
        STATUS_LABELS.get(new_status, new_status),
        reply_for_event,
    )
    notify.send_event(
        {
            "event": "report.updated",
            "ticket_no": row["ticket_no"],
            "from_status": current_status,
            "status": new_status,
            "agency_id": new_agency_id,
            "priority": new_priority,
            "has_public_reply": bool(reply_public),
            "updated_at": now.isoformat(),
        }
    )

    return {
        "message": "Perubahan berhasil disimpan.",
        "id": report_id,
        "ticket_no": row["ticket_no"],
        "status": new_status,
        "status_label": STATUS_LABELS.get(new_status, new_status),
        "updated_at": now.isoformat(),
    }


@router.get("/admin/reports/{report_id}/attachments/{attachment_id}")
def report_attachment(
    report_id: int,
    attachment_id: int,
    user: dict[str, Any] = Depends(require_role(*ADMIN_ROLES)),
) -> FileResponse:
    with db.connection() as conn:
        report = conn.execute(
            "select id, agency_id from reports where id = %s", (report_id,)
        ).fetchone()
        if report is None:
            raise _error(404, "report_not_found", "Laporan tidak ditemukan.")
        if user["role"] == "petugas_dinas" and report["agency_id"] != _user_agency_id(user):
            raise _error(404, "report_not_found", "Laporan tidak ditemukan.")

        item = conn.execute(
            "select path, mime, size from attachments where id = %s and report_id = %s",
            (attachment_id, report_id),
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


# ---------------------------------------------------------------------------
# Admin: master data, pengguna, log, dan ekspor
# ---------------------------------------------------------------------------


MASTER_ADMIN_ROLES = ("admin_verifikator", "super_admin")
SUPER_ADMIN_ONLY = ("super_admin",)
ALL_USER_ROLES = ("warga", "admin_verifikator", "petugas_dinas", "super_admin")


def _audit(conn, actor_id: int, action: str, target: str, meta: dict[str, Any]) -> None:
    conn.execute(
        "insert into audit_logs (actor_id, action, target, meta) values (%s, %s, %s, %s)",
        (actor_id, action, target, Jsonb(meta)),
    )


def _csv_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    if text[:1] in ("=", "+", "-", "@", "\t", "\r", "\n"):
        text = f"'{text}"
    return f'"{text.replace(chr(34), chr(34) * 2)}"'


@router.get("/admin/master/categories")
def admin_list_categories(user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES))) -> list[dict[str, Any]]:
    with db.connection() as conn:
        rows = conn.execute(
            """
            select c.id, c.name, c.default_agency_id, a.id as agency_id, a.name as agency_name
              from categories c
              left join agencies a on a.id = c.default_agency_id
             order by c.name
            """
        ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "default_agency_id": row["default_agency_id"],
            "default_agency": (
                {"id": row["agency_id"], "name": row["agency_name"]}
                if row["default_agency_id"]
                else None
            ),
        }
        for row in rows
    ]


@router.post("/admin/master/categories")
def admin_create_category(
    payload: CategoryIn,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    name = payload.name.strip()
    agency_id = payload.default_agency_id
    if len(name) < 2 or len(name) > 150:
        raise _error(422, "invalid_name", "Nama kategori harus 2-150 karakter.")

    with db.connection() as conn:
        if conn.execute("select id from categories where name = %s", (name,)).fetchone():
            raise _error(409, "duplicate_category", f"Kategori '{name}' sudah ada.")
        if agency_id is not None:
            agency = conn.execute("select id from agencies where id = %s", (agency_id,)).fetchone()
            if agency is None:
                raise _error(422, "invalid_agency", "Instansi default tidak ditemukan.")

        row = conn.execute(
            "insert into categories (name, default_agency_id) values (%s, %s) returning id",
            (name, agency_id),
        ).fetchone()
        category_id = row["id"]
        _audit(conn, user["id"], "master.category.created", name, {"name": name})

    return {"message": "Kategori berhasil ditambahkan.", "id": category_id}


@router.patch("/admin/master/categories/{category_id}")
def admin_update_category(
    category_id: int,
    payload: CategoryUpdate,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    name = payload.name.strip() if payload.name is not None else None
    if name is not None and (len(name) < 2 or len(name) > 150):
        raise _error(422, "invalid_name", "Nama kategori harus 2-150 karakter.")
    agency_id = payload.default_agency_id

    with db.connection() as conn:
        row = conn.execute("select id, name from categories where id = %s", (category_id,)).fetchone()
        if row is None:
            raise _error(404, "category_not_found", "Kategori tidak ditemukan.")
        if name is not None and name != row["name"]:
            if conn.execute("select id from categories where name = %s and id <> %s", (name, category_id)).fetchone():
                raise _error(409, "duplicate_category", f"Kategori '{name}' sudah ada.")
        new_name = name if name is not None else row["name"]
        new_agency = agency_id if agency_id is not None else conn.execute(
            "select default_agency_id from categories where id = %s", (category_id,)
        ).fetchone()["default_agency_id"]

        conn.execute(
            "update categories set name = %s, default_agency_id = %s where id = %s",
            (new_name, new_agency, category_id),
        )
        _audit(conn, user["id"], "master.category.updated", str(category_id), {"name": new_name})

    return {"message": "Kategori berhasil diperbarui.", "id": category_id}


@router.delete("/admin/master/categories/{category_id}")
def admin_delete_category(
    category_id: int,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    with db.connection() as conn:
        row = conn.execute("select id, name from categories where id = %s", (category_id,)).fetchone()
        if row is None:
            raise _error(404, "category_not_found", "Kategori tidak ditemukan.")
        used = conn.execute("select count(*) as n from reports where category_id = %s", (category_id,)).fetchone()["n"]
        if used > 0:
            raise _error(409, "master_in_use", f"Kategori '{row['name']}' masih dipakai oleh {used} laporan dan tidak dapat dihapus.")

        conn.execute("delete from categories where id = %s", (category_id,))
        _audit(conn, user["id"], "master.category.deleted", str(category_id), {"name": row["name"]})

    return {"message": "Kategori berhasil dihapus."}


@router.get("/admin/master/agencies")
def admin_list_agencies(user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES))) -> list[dict[str, Any]]:
    with db.connection() as conn:
        rows = conn.execute(
            """
            select a.id, a.name,
                   (select count(*) from reports r where r.agency_id = a.id) as used_by_reports
              from agencies a
             order by a.name
            """
        ).fetchall()
    return [
        {"id": row["id"], "name": row["name"], "used_by_reports": int(row["used_by_reports"])}
        for row in rows
    ]


@router.post("/admin/master/agencies")
def admin_create_agency(
    payload: AgencyIn,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    name = payload.name.strip()
    if len(name) < 2 or len(name) > 150:
        raise _error(422, "invalid_name", "Nama instansi harus 2-150 karakter.")
    with db.connection() as conn:
        if conn.execute("select id from agencies where name = %s", (name,)).fetchone():
            raise _error(409, "duplicate_agency", f"Instansi '{name}' sudah ada.")
        row = conn.execute("insert into agencies (name) values (%s) returning id", (name,)).fetchone()
        agency_id = row["id"]
        _audit(conn, user["id"], "master.agency.created", name, {"name": name})

    return {"message": "Instansi berhasil ditambahkan.", "id": agency_id}


@router.patch("/admin/master/agencies/{agency_id}")
def admin_update_agency(
    agency_id: int,
    payload: AgencyIn,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    name = payload.name.strip()
    if len(name) < 2 or len(name) > 150:
        raise _error(422, "invalid_name", "Nama instansi harus 2-150 karakter.")
    with db.connection() as conn:
        row = conn.execute("select id, name from agencies where id = %s", (agency_id,)).fetchone()
        if row is None:
            raise _error(404, "agency_not_found", "Instansi tidak ditemukan.")
        if name != row["name"]:
            if conn.execute("select id from agencies where name = %s and id <> %s", (name, agency_id)).fetchone():
                raise _error(409, "duplicate_agency", f"Instansi '{name}' sudah ada.")
        conn.execute("update agencies set name = %s where id = %s", (name, agency_id))
        _audit(conn, user["id"], "master.agency.updated", str(agency_id), {"name": name})

    return {"message": "Instansi berhasil diperbarui.", "id": agency_id}


@router.delete("/admin/master/agencies/{agency_id}")
def admin_delete_agency(
    agency_id: int,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    with db.connection() as conn:
        row = conn.execute("select id, name from agencies where id = %s", (agency_id,)).fetchone()
        if row is None:
            raise _error(404, "agency_not_found", "Instansi tidak ditemukan.")
        used = conn.execute(
            """
            select (select count(*) from reports r where r.agency_id = a.id)
                 + (select count(*) from users u where u.agency_id = a.id)
                 + (select count(*) from categories c where c.default_agency_id = a.id) as n
              from agencies a
             where a.id = %s
            """,
            (agency_id,),
        ).fetchone()["n"]
        if used > 0:
            raise _error(409, "master_in_use", f"Instansi '{row['name']}' masih dipakai dan tidak dapat dihapus.")

        conn.execute("delete from agencies where id = %s", (agency_id,))
        _audit(conn, user["id"], "master.agency.deleted", str(agency_id), {"name": row["name"]})
    return {"message": "Instansi berhasil dihapus."}


@router.get("/admin/master/districts")
def admin_list_districts(user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES))) -> list[dict[str, Any]]:
    with db.connection() as conn:
        rows = conn.execute(
            """
            select d.id, d.name,
                   (select count(*) from villages v where v.district_id = d.id) as village_count
              from districts d
             order by d.name
            """
        ).fetchall()
    return [
        {"id": row["id"], "name": row["name"], "village_count": int(row["village_count"])}
        for row in rows
    ]


@router.post("/admin/master/districts")
def admin_create_district(
    payload: DistrictIn,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    name = payload.name.strip()
    if len(name) < 2 or len(name) > 150:
        raise _error(422, "invalid_name", "Nama kecamatan harus 2-150 karakter.")
    with db.connection() as conn:
        if conn.execute("select id from districts where name = %s", (name,)).fetchone():
            raise _error(409, "duplicate_district", f"Kecamatan '{name}' sudah ada.")
        row = conn.execute("insert into districts (name) values (%s) returning id", (name,)).fetchone()
        district_id = row["id"]
        _audit(conn, user["id"], "master.district.created", name, {"name": name})

    return {"message": "Kecamatan berhasil ditambahkan.", "id": district_id}


@router.patch("/admin/master/districts/{district_id}")
def admin_update_district(
    district_id: int,
    payload: DistrictIn,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    name = payload.name.strip()
    if len(name) < 2 or len(name) > 150:
        raise _error(422, "invalid_name", "Nama kecamatan harus 2-150 karakter.")
    with db.connection() as conn:
        row = conn.execute("select id, name from districts where id = %s", (district_id,)).fetchone()
        if row is None:
            raise _error(404, "district_not_found", "Kecamatan tidak ditemukan.")
        if name != row["name"]:
            if conn.execute("select id from districts where name = %s and id <> %s", (name, district_id)).fetchone():
                raise _error(409, "duplicate_district", f"Kecamatan '{name}' sudah ada.")
        conn.execute("update districts set name = %s where id = %s", (name, district_id))
        _audit(conn, user["id"], "master.district.updated", str(district_id), {"name": name})

    return {"message": "Kecamatan berhasil diperbarui.", "id": district_id}


@router.delete("/admin/master/districts/{district_id}")
def admin_delete_district(
    district_id: int,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    with db.connection() as conn:
        row = conn.execute("select id, name from districts where id = %s", (district_id,)).fetchone()
        if row is None:
            raise _error(404, "district_not_found", "Kecamatan tidak ditemukan.")
        used = conn.execute(
            """
            select (select count(*) from villages v where v.district_id = d.id)
                 + (select count(*) from reports r where r.district_id = d.id)
                 + (select count(*) from users u where u.kecamatan_id = d.id) as n
              from districts d
             where d.id = %s
            """,
            (district_id,),
        ).fetchone()["n"]
        if used > 0:
            raise _error(409, "master_in_use", f"Kecamatan '{row['name']}' masih dipakai dan tidak dapat dihapus.")

        conn.execute("delete from districts where id = %s", (district_id,))
        _audit(conn, user["id"], "master.district.deleted", str(district_id), {"name": row["name"]})

    return {"message": "Kecamatan berhasil dihapus."}


@router.get("/admin/master/villages")
def admin_list_villages(
    district_id: int | None = Query(None, gt=0),
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> list[dict[str, Any]]:
    with db.connection() as conn:
        if district_id is not None:
            rows = conn.execute(
                """
                select v.id, v.district_id, d.name as district_name, v.name
                  from villages v
                  join districts d on d.id = v.district_id
                 where v.district_id = %s
                 order by v.name
                """,
                (district_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                select v.id, v.district_id, d.name as district_name, v.name
                  from villages v
                  join districts d on d.id = v.district_id
                 order by d.name, v.name
                """
            ).fetchall()
    return [
        {
            "id": row["id"],
            "district_id": row["district_id"],
            "district": {"id": row["district_id"], "name": row["district_name"]},
            "name": row["name"],
        }
        for row in rows
    ]


@router.post("/admin/master/villages")
def admin_create_village(
    payload: VillageIn,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    district_id = payload.district_id
    name = payload.name.strip()
    if len(name) < 2 or len(name) > 150:
        raise _error(422, "invalid_name", "Nama kelurahan harus 2-150 karakter.")
    with db.connection() as conn:
        district = conn.execute("select id, name from districts where id = %s", (district_id,)).fetchone()
        if district is None:
            raise _error(404, "district_not_found", "Kecamatan induk tidak ditemukan.")
        if conn.execute("select id from villages where district_id = %s and name = %s", (district_id, name)).fetchone():
            raise _error(409, "duplicate_village", f"Kelurahan '{name}' di {district['name']} sudah ada.")
        row = conn.execute("insert into villages (district_id, name) values (%s, %s) returning id", (district_id, name)).fetchone()
        village_id = row["id"]
        _audit(conn, user["id"], "master.village.created", name, {"name": name, "district_id": district_id})

    return {"message": "Kelurahan berhasil ditambahkan.", "id": village_id}


@router.patch("/admin/master/villages/{village_id}")
def admin_update_village(
    village_id: int,
    payload: VillageUpdate,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    district_id = payload.district_id
    name = payload.name.strip()
    if len(name) < 2 or len(name) > 150:
        raise _error(422, "invalid_name", "Nama kelurahan harus 2-150 karakter.")
    with db.connection() as conn:
        row = conn.execute(
            "select v.id, v.district_id, d.name as district_name, v.name from villages v join districts d on d.id = v.district_id where v.id = %s",
            (village_id,),
        ).fetchone()
        if row is None:
            raise _error(404, "village_not_found", "Kelurahan tidak ditemukan.")
        new_district = district_id if district_id is not None else row["district_id"]
        if new_district != row["district_id"]:
            district = conn.execute("select id, name from districts where id = %s", (new_district,)).fetchone()
            if district is None:
                raise _error(404, "district_not_found", "Kecamatan induk tidak ditemukan.")
        if (new_district, name) != (row["district_id"], row["name"]):
            if conn.execute(
                "select id from villages where district_id = %s and name = %s and id <> %s",
                (new_district, name, village_id),
            ).fetchone():
                raise _error(409, "duplicate_village", f"Kelurahan '{name}' di {district['name'] if district else ''} sudah ada.")
        conn.execute("update villages set district_id = %s, name = %s where id = %s", (new_district, name, village_id))
        _audit(conn, user["id"], "master.village.updated", str(village_id), {"name": name, "district_id": new_district})

    return {"message": "Kelurahan berhasil diperbarui.", "id": village_id}


@router.delete("/admin/master/villages/{village_id}")
def admin_delete_village(
    village_id: int,
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> dict[str, Any]:
    with db.connection() as conn:
        row = conn.execute(
            "select v.id, v.name, d.name as district_name from villages v join districts d on d.id = v.district_id where v.id = %s",
            (village_id,),
        ).fetchone()
        if row is None:
            raise _error(404, "village_not_found", "Kelurahan tidak ditemukan.")
        used = conn.execute(
            """
            select (select count(*) from users u where u.kelurahan_id = v.id)
                 + (select count(*) from reports r where r.village_id = v.id) as n
              from villages v
             where v.id = %s
            """,
            (village_id,),
        ).fetchone()["n"]
        if used > 0:
            raise _error(409, "master_in_use", f"Kelurahan '{row['name']}' di {row['district_name']} masih dipakai dan tidak dapat dihapus.")

        conn.execute("delete from villages where id = %s", (village_id,))
        _audit(conn, user["id"], "master.village.deleted", str(village_id), {"name": row["name"]})
    return {"message": "Kelurahan berhasil dihapus."}


@router.get("/admin/users")
def admin_list_users(
    role: str | None = Query(None),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    user: dict[str, Any] = Depends(require_role(*SUPER_ADMIN_ONLY)),
) -> dict[str, Any]:
    if role is not None and role not in ALL_USER_ROLES:
        raise _error(422, "invalid_role", "Peran tidak dikenal.")
    where = ["true"]
    params: list[Any] = []
    if role:
        where.append("u.role = %s")
        params.append(role)
    if q:
        term = f"%{q.strip()}%"
        where.append("(u.name ilike %s or u.email ilike %s)")
        params.extend([term, term])

    with db.connection() as conn:
        total = int(
            conn.execute(
                f"select count(*) as n from users u where {' and '.join(where)}",
                params,
            ).fetchone()["n"]
        )
        rows = conn.execute(
            f"""
            select u.id, u.name, u.email, u.phone, u.role, u.agency_id, a.name as agency_name,
                   u.kecamatan_id, d.name as kecamatan_name, u.kelurahan_id, v.name as kelurahan_name,
                   u.nik_last4, u.email_verified, u.created_at,
                   count(r.id) as reports_count
              from users u
              left join agencies a on a.id = u.agency_id
              left join districts d on d.id = u.kecamatan_id
              left join villages v on v.id = u.kelurahan_id
              left join reports r on r.user_id = u.id
             where {' and '.join(where)}
             group by u.id, u.name, u.email, u.phone, u.role, u.agency_id, a.name,
                      u.kecamatan_id, d.name, u.kelurahan_id, v.name, u.nik_last4,
                      u.email_verified, u.created_at
             order by u.created_at desc, u.id desc
             limit %s offset %s
            """,
            [*params, PER_PAGE, (page - 1) * PER_PAGE],
        ).fetchall()

    total_pages = max(1, (total + PER_PAGE - 1) // PER_PAGE)
    items = [
        {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "phone": _mask_phone(row["phone"]),
            "role": row["role"],
            "agency": (
                {"id": row["agency_id"], "name": row["agency_name"]} if row["agency_id"] else None
            ),
            "kecamatan": (
                {"id": row["kecamatan_id"], "name": row["kecamatan_name"]} if row["kecamatan_id"] else None
            ),
            "kelurahan": (
                {"id": row["kelurahan_id"], "name": row["kelurahan_name"]} if row["kelurahan_id"] else None
            ),
            "nik_last4": row["nik_last4"],
            "email_verified": row["email_verified"],
            "created_at": row["created_at"].isoformat(),
            "reports_count": int(row["reports_count"]),
        }
        for row in rows
    ]
    return {
        "items": items,
        "page": page,
        "per_page": PER_PAGE,
        "total": total,
        "total_pages": total_pages,
    }


@router.get("/admin/audit")
def admin_list_audit(
    action: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    user: dict[str, Any] = Depends(require_role(*SUPER_ADMIN_ONLY)),
) -> dict[str, Any]:
    where = ["true"]
    params: list[Any] = []
    if action:
        where.append("a.action ilike %s")
        params.append(f"%{action.strip()}%")
    if date_from:
        where.append("a.created_at >= %s")
        params.append(datetime.combine(date_from, time.min, tzinfo=WIB))
    if date_to:
        where.append("a.created_at < %s")
        params.append(datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=WIB))

    with db.connection() as conn:
        total = int(
            conn.execute(
                f"select count(*) as n from audit_logs a where {' and '.join(where)}",
                params,
            ).fetchone()["n"]
        )
        rows = conn.execute(
            f"""
            select a.id, a.actor_id, u.name as actor_name, a.action, a.target, a.meta, a.created_at
              from audit_logs a
              left join users u on u.id = a.actor_id
             where {' and '.join(where)}
             order by a.created_at desc, a.id desc
             limit %s offset %s
            """,
            [*params, PER_PAGE, (page - 1) * PER_PAGE],
        ).fetchall()

    total_pages = max(1, (total + PER_PAGE - 1) // PER_PAGE)
    items = [
        {
            "id": row["id"],
            "actor_id": row["actor_id"],
            "actor_name": row["actor_name"],
            "action": row["action"],
            "target": row["target"],
            "meta": row["meta"] or {},
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]
    return {
        "items": items,
        "page": page,
        "per_page": PER_PAGE,
        "total": total,
        "total_pages": total_pages,
    }


@router.get("/admin/export")
def admin_export(
    month: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    user: dict[str, Any] = Depends(require_role(*MASTER_ADMIN_ROLES)),
) -> Response:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month or ""):
        raise _error(422, "invalid_month", "Format bulan harus YYYY-MM, contoh 2026-11.")
    year = int(month[:4])
    mon = int(month[5:7])
    start = datetime(year, mon, 1, tzinfo=WIB)
    end = datetime(year + 1, 1, 1, tzinfo=WIB) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=WIB)

    with db.connection() as conn:
        rows = conn.execute(
            """
            select r.ticket_no, r.created_at, r.type, c.name as category_name, a.name as agency_name,
                   d.name as district_name, v.name as village_name, r.status, r.priority, r.privacy,
                   r.processed_at, r.closed_at
              from reports r
              join categories c on c.id = r.category_id
              left join agencies a on a.id = r.agency_id
              left join districts d on d.id = r.district_id
              left join villages v on v.id = r.village_id
             where r.created_at >= %s and r.created_at < %s
             order by r.created_at desc, r.id desc
            """,
            (start, end),
        ).fetchall()

    process_days: list[Any] = []
    lines: list[str] = [
        "Tiket,Tanggal,Jenis,Kategori,Instansi,Kecamatan,Kelurahan,Status,Prioritas,Privasi,Hari Proses"
    ]
    for row in rows:
        days = None
        if row["status"] in ("diproses", "selesai"):
            end_time = row["closed_at"] or datetime.now(timezone.utc)
            days = int((end_time - (row["processed_at"] or row["created_at"])).days)
        process_days.append(days)
        values = [
            row["ticket_no"],
            row["created_at"].astimezone(WIB).date().isoformat(),
            TYPE_LABELS.get(row["type"], row["type"]),
            row["category_name"],
            row["agency_name"] or "",
            row["district_name"] or "",
            row["village_name"] or "",
            STATUS_LABELS.get(row["status"], row["status"]),
            PRIORITY_LABELS.get(row["priority"], row["priority"]),
            PRIVACY_LABELS.get(row["privacy"], row["privacy"]),
            "" if days is None else str(days),
        ]
        lines.append(",".join(_csv_cell(value) for value in values))

    csv_body = "\ufeff" + "\r\n".join(lines) + "\r\n"
    with db.connection() as conn:
        conn.execute(
            "insert into audit_logs (actor_id, action, target, meta) values (%s, %s, %s, %s)",
            (user["id"], "admin.export", f"month={month}", Jsonb({"month": month, "rows": len(rows)})),
        )

    return Response(
        content=csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="lapor-export-{month}.csv"'},
    )
