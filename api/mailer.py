"""Pengiriman email.

Jika SMTP_HOST kosong (development), email tidak dikirim: tujuan, subjek, dan
isi (termasuk tautan verifikasi/reset) dicetak ke log API supaya alur bisa diuji.
Kegagalan SMTP hanya dicatat di log, tidak menggagalkan request.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

import config

logger = logging.getLogger("lapor.mailer")


def _send(to: str, subject: str, body: str) -> bool:
    settings = config.smtp_settings()
    if settings is None:
        if config.is_production():
            logger.warning("SMTP_HOST kosong di produksi: email tidak dikirim ke %s", to)
        else:
            logger.info(
                "SMTP_HOST kosong: email tidak dikirim.\nTujuan: %s\nSubjek: %s\nIsi:\n%s",
                to,
                subject,
                body,
            )
        return False

    message = EmailMessage()
    message["From"] = str(settings["from"])
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    host = str(settings["host"])
    port = int(settings["port"])
    try:
        if port == 465:
            client = smtplib.SMTP_SSL(host, port, timeout=10, context=ssl.create_default_context())
        else:
            client = smtplib.SMTP(host, port, timeout=10)
        with client as smtp:
            smtp.ehlo()
            if port != 465 and port != 25:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            if settings["user"]:
                smtp.login(str(settings["user"]), str(settings["password"]))
            smtp.send_message(message)
        return True
    except Exception:
        logger.exception("Gagal mengirim email ke %s", to)
        return False


def send_verification_email(to: str, name: str, token: str) -> bool:
    link = f"{config.app_base_url()}/verifikasi-email/{token}"
    body = (
        f"Halo {name},\n\n"
        "Terima kasih telah mendaftar di Lapor Depok.\n"
        "Buka tautan berikut untuk memverifikasi email Anda (berlaku 24 jam):\n\n"
        f"{link}\n\n"
        "Jika Anda tidak merasa mendaftar, abaikan email ini.\n"
    )
    return _send(to, "Verifikasi email Lapor Depok", body)


def send_reset_email(to: str, name: str, token: str) -> bool:
    link = f"{config.app_base_url()}/reset-sandi/{token}"
    body = (
        f"Halo {name},\n\n"
        "Kami menerima permintaan untuk mengatur ulang kata sandi akun Lapor Depok Anda.\n"
        "Buka tautan berikut (berlaku 1 jam):\n\n"
        f"{link}\n\n"
        "Jika Anda tidak meminta reset kata sandi, abaikan email ini.\n"
    )
    return _send(to, "Reset kata sandi Lapor Depok", body)


def send_report_update_email(
    to: str,
    name: str,
    ticket_no: str,
    title: str,
    status_label: str,
    reply_public: str | None = None,
) -> bool:
    link = f"{config.app_base_url()}/laporan/{ticket_no}"
    body = (
        f"Halo {name},\n\n"
        "Ada pembaruan pada laporan Anda.\n\n"
        f"Nomor tiket : {ticket_no}\n"
        f"Judul       : {title}\n"
        f"Status      : {status_label}\n"
    )
    if reply_public:
        body += f"\nTanggapan:\n{reply_public}\n"
    body += (
        "\nLihat detail laporan melalui tautan berikut:\n\n"
        f"{link}\n\n"
        "Pembaruan status juga dikirim ke email akun Anda.\n"
    )
    return _send(to, f"Pembaruan laporan: {ticket_no}", body)


def send_report_received_email(to: str, name: str, ticket_no: str, title: str) -> bool:
    link = f"{config.app_base_url()}/laporan/{ticket_no}"
    body = (
        f"Halo {name},\n\n"
        "Laporan Anda sudah kami terima dengan detail berikut:\n\n"
        f"Nomor tiket : {ticket_no}\n"
        f"Judul       : {title}\n\n"
        "Admin akan memverifikasi laporan Anda dalam 2 hari kerja, lalu meneruskannya ke\n"
        "instansi terkait. Pantau perkembangan laporan melalui tautan berikut:\n\n"
        f"{link}\n\n"
        "Pembaruan status juga dikirim ke email akun Anda.\n"
    )
    return _send(to, f"Laporan diterima: {ticket_no}", body)

