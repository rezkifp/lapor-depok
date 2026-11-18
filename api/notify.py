"""Webhook n8n (AGENTS.md bagian 11).

Kegagalan pengiriman hanya dicatat di log, tidak pernah menggagalkan request.
Jika `N8N_WEBHOOK_URL` kosong (n8n dimatikan), fungsi langsung kembali.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger("lapor.notify")

TIMEOUT_SECONDS = 3.0


def _settings() -> tuple[str, str] | None:
    url = os.getenv("N8N_WEBHOOK_URL", "").strip()
    if not url:
        return None
    return url, os.getenv("N8N_WEBHOOK_SECRET", "").strip()


def send_event(payload: dict[str, Any]) -> bool:
    settings = _settings()
    if settings is None:
        return False

    url, secret = settings
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode("utf-8") + raw,
        hashlib.sha256,
    ).hexdigest()

    request = urllib.request.Request(
        url,
        data=raw,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Timestamp": timestamp,
            "X-Signature": signature,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, OSError, ValueError):
        logger.warning("Webhook n8n gagal dikirim (%s)", url, exc_info=True)
        return False
