"""Runner migrasi SQL sederhana.

File `migrations/NNN_nama.sql` dijalankan berurutan saat API start. Versi yang
sudah jalan dicatat di tabel `schema_migrations`, jadi aman dijalankan berulang.
Satu advisory lock mencegah dua proses migrasi berjalan bersamaan.
"""

from __future__ import annotations

import logging
from pathlib import Path

import db

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
# Kunci bebas, hanya perlu sama di semua proses API.
MIGRATION_LOCK_ID = 815_042_001


def run_migrations() -> list[str]:
    """Terapkan migrasi yang belum tercatat. Kembalikan nama file yang baru jalan."""
    applied: list[str] = []
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        logger.warning("Tidak ada file migrasi di %s", MIGRATIONS_DIR)
        return applied

    with db.connection() as conn:
        conn.execute(
            """
            create table if not exists schema_migrations (
                version    text primary key,
                applied_at timestamptz not null default now()
            )
            """
        )
        # Lock dilepas otomatis saat transaksi selesai.
        conn.execute("select pg_advisory_xact_lock(%s)", (MIGRATION_LOCK_ID,))

        done = {
            row["version"]
            for row in conn.execute("select version from schema_migrations")
        }

        for path in files:
            if path.name in done:
                continue
            sql_text = path.read_text(encoding="utf-8")
            with conn.transaction():
                conn.execute(sql_text)
                conn.execute(
                    "insert into schema_migrations (version) values (%s)",
                    (path.name,),
                )
            applied.append(path.name)
            logger.info("Migrasi diterapkan: %s", path.name)

    return applied
