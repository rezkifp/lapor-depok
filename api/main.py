"""Aplikasi FastAPI Lapor Depok.

Tahap 1 hanya menyediakan health check dan menjalankan migrasi saat startup.
Endpoint lain ditambahkan bertahap sesuai AGENTS.md bagian 13.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import auth
import config
import db
import master
import migrate
import public
import reports
import admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lapor")


IS_PRODUCTION = config.is_production()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if IS_PRODUCTION:
        try:
            config.validate_production_config()
        except config.ConfigError as exc:
            logger.error("Konfigurasi produksi invalid: %s", exc)
            raise
    db.open_pool()
    try:
        applied = migrate.run_migrations()
        if applied:
            logger.info("Migrasi baru diterapkan: %s", ", ".join(applied))
        else:
            logger.info("Skema database sudah terbaru")
        yield
    finally:
        db.close_pool()


app = FastAPI(
    title="Lapor Depok API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path)
    detail = "Terjadi kesalahan internal." if IS_PRODUCTION else str(exc)
    return JSONResponse(status_code=500, content={"detail": detail})

app.include_router(auth.router, prefix="/api")
app.include_router(master.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, object]:
    """Dipakai healthcheck Docker dan pemantauan sederhana."""
    return {"status": "ok", "database": db.is_healthy()}
