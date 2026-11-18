"""Pool koneksi PostgreSQL. SQL langsung, tanpa ORM.

Semua query memakai `psycopg` 3 dan mengembalikan dict (`dict_row`).
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

import config

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None


def _pool_max_size() -> int:
    raw = os.getenv("DB_POOL_MAX", "5").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 5
    return max(1, value)


def get_pool() -> ConnectionPool:
    """Pool dibuat sekali per proses, belum dibuka sampai startup."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=config.database_url(),
            min_size=1,
            max_size=_pool_max_size(),
            timeout=10,
            kwargs={"row_factory": dict_row},
            name="lapor-depok",
            open=False,
        )
    return _pool


def open_pool() -> None:
    pool = get_pool()
    if pool.closed:
        pool.open(wait=True, timeout=15)
        logger.info("Pool database terbuka (min=%s, max=%s)", pool.min_size, pool.max_size)


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        logger.info("Pool database ditutup")


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    """Koneksi dari pool; commit saat keluar normal, rollback saat error."""
    with get_pool().connection() as conn:
        yield conn


def is_healthy() -> bool:
    try:
        with get_pool().connection(timeout=3) as conn:
            conn.execute("select 1")
        return True
    except Exception:  # pool tertutup / database mati
        return False
