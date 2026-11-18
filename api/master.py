"""Data master publik untuk dropdown halaman daftar dan profil."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

import db

router = APIRouter(tags=["master"])


@router.get("/master/categories")
def categories() -> list[dict[str, Any]]:
    with db.connection() as conn:
        return conn.execute(
            "select id, name, default_agency_id from categories order by name"
        ).fetchall()


@router.get("/master/agencies")
def agencies() -> list[dict[str, Any]]:
    with db.connection() as conn:
        return conn.execute("select id, name from agencies order by name").fetchall()


@router.get("/master/districts")
def districts() -> list[dict[str, Any]]:
    with db.connection() as conn:
        return conn.execute("select id, name from districts order by name").fetchall()


@router.get("/master/villages")
def villages(district_id: int = Query(..., gt=0)) -> list[dict[str, Any]]:
    with db.connection() as conn:
        return conn.execute(
            "select id, district_id, name from villages where district_id = %s order by name",
            (district_id,),
        ).fetchall()
