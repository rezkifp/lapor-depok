"""Endpoint publik: statistik landing, daftar laporan publik, cek tiket.

Aturan privasi (AGENTS.md bagian 11):
- Daftar publik hanya memuat jenis `pengaduan`/`aspirasi` dan privasi
  `tampil`/`anonim`; `rahasia` dan jenis `informasi` tidak pernah muncul.
- Nama pelapor `anonim` selalu diganti "Anonim".
- Cek tiket tidak memuat identitas, alamat, atau lampiran.
"""

from __future__ import annotations

import re
import threading
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

import db

router = APIRouter(tags=["public"])

PER_PAGE = 12
SUMMARY_LENGTH = 140
STATS_TTL_SECONDS = 60

_stats_lock = threading.Lock()
_stats_cache: dict[str, Any] = {"value": None, "expires_at": 0.0}


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _summary(body: str, title: str) -> str:
    text = " ".join(body.split())
    if text.startswith(title):
        text = text[len(title) :].lstrip(" .")
    if len(text) <= SUMMARY_LENGTH:
        return text
    return text[: SUMMARY_LENGTH - 1].rstrip() + "…"


def _normalize_ticket(raw: str) -> str:
    ticket = re.sub(r"\s+", "", raw).upper()
    if re.fullmatch(r"\d{6}", ticket):
        year = datetime.now(timezone.utc).year
        return f"LPR-DPK-{year}-{ticket}"
    return ticket


# ---------------------------------------------------------------------------
# Statistik
# ---------------------------------------------------------------------------


def _load_stats() -> dict[str, Any]:
    with db.connection() as conn:
        report = conn.execute(
            """
            select count(*) as total_reports,
                   count(*) filter (where status = 'selesai') as resolved_reports,
                   avg(extract(epoch from (processed_at - created_at)) / 86400.0)
                       filter (where processed_at is not null) as avg_response_days
              from reports
            """
        ).fetchone()
        rating = conn.execute(
            "select count(*) as rating_count, avg(score) as avg_rating from ratings"
        ).fetchone()

    rating_count = int(rating["rating_count"])
    avg_rating = (
        round(float(rating["avg_rating"]), 1) if rating_count >= 5 else None
    )
    avg_days = report["avg_response_days"]

    return {
        "total_reports": int(report["total_reports"]),
        "resolved_reports": int(report["resolved_reports"]),
        "avg_response_days": round(float(avg_days), 1) if avg_days is not None else None,
        "avg_rating": avg_rating,
        "rating_count": rating_count,
    }


@router.get("/public/stats")
def public_stats() -> dict[str, Any]:
    now = time.monotonic()
    with _stats_lock:
        cached = _stats_cache["value"]
        if cached is not None and now < _stats_cache["expires_at"]:
            return cached

    value = _load_stats()
    with _stats_lock:
        _stats_cache["value"] = value
        _stats_cache["expires_at"] = time.monotonic() + STATS_TTL_SECONDS
    return value


# ---------------------------------------------------------------------------
# Daftar laporan publik
# ---------------------------------------------------------------------------


def _serialize_public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "ticket_no": row["ticket_no"],
        "title": row["title"],
        "summary": _summary(row["body"], row["title"]),
        "type": row["type"],
        "category": {"id": row["category_id"], "name": row["category_name"]},
        "district": row["district_name"],
        "status": row["status"],
        "created_at": _iso(row["created_at"]),
        "reporter_name": "Anonim" if row["privacy"] == "anonim" else row["user_name"],
    }


@router.get("/public/reports")
def public_reports(
    page: int = Query(1, ge=1),
    category: int | None = Query(None, gt=0),
) -> dict[str, Any]:
    where = [
        "r.type in ('pengaduan', 'aspirasi')",
        "r.privacy in ('tampil', 'anonim')",
    ]
    params: list[Any] = []
    if category is not None:
        where.append("r.category_id = %s")
        params.append(category)
    clause = " and ".join(where)

    with db.connection() as conn:
        total = conn.execute(
            f"select count(*) as n from reports r where {clause}", params
        ).fetchone()["n"]
        rows = conn.execute(
            f"""
            select r.ticket_no, r.title, r.body, r.type, r.status, r.privacy,
                   r.created_at, r.category_id, c.name as category_name,
                   d.name as district_name, u.name as user_name
              from reports r
              join categories c on c.id = r.category_id
              join users u on u.id = r.user_id
              left join districts d on d.id = r.district_id
             where {clause}
             order by r.created_at desc, r.id desc
             limit %s offset %s
            """,
            [*params, PER_PAGE, (page - 1) * PER_PAGE],
        ).fetchall()

    total = int(total)
    return {
        "items": [_serialize_public(row) for row in rows],
        "page": page,
        "per_page": PER_PAGE,
        "total": total,
        "total_pages": max(1, (total + PER_PAGE - 1) // PER_PAGE),
    }


# ---------------------------------------------------------------------------
# Cek tiket
# ---------------------------------------------------------------------------


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={
            "code": "ticket_not_found",
            "message": "Tiket tidak ditemukan. Periksa kembali nomor tiket Anda.",
        },
    )


@router.get("/public/lookup/{ticket}")
def public_lookup(ticket: str) -> dict[str, Any]:
    ticket_no = _normalize_ticket(ticket)
    if not ticket_no:
        raise _not_found()

    with db.connection() as conn:
        row = conn.execute(
            """
            select r.id, r.ticket_no, r.title, r.status, r.rejection_reason,
                   r.created_at, c.name as category_name,
                   d.name as district_name
              from reports r
              join categories c on c.id = r.category_id
              left join districts d on d.id = r.district_id
             where upper(r.ticket_no) = %s
            """,
            (ticket_no,),
        ).fetchone()
        if row is None:
            raise _not_found()

        events = conn.execute(
            """
            select status, note_public, created_at
              from report_events
             where report_id = %s and note_public is not null
             order by created_at, id
            """,
            (row["id"],),
        ).fetchall()

    return {
        "ticket_no": row["ticket_no"],
        "title": row["title"],
        "category": row["category_name"],
        "district": row["district_name"],
        "status": row["status"],
        "created_at": _iso(row["created_at"]),
        "rejection_reason": row["rejection_reason"],
        "timeline": [
            {
                "status": event["status"],
                "note_public": event["note_public"],
                "created_at": _iso(event["created_at"]),
            }
            for event in events
        ],
    }
