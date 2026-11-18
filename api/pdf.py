"""Bukti laporan PDF (reportlab + QR).

QR mengarah ke `{origin}/cek/{ticket}` supaya bisa dipindai siapa pun yang
memegang dokumen. Dokumen hanya dibuat untuk pemilik laporan.
"""

from __future__ import annotations

import io
from datetime import datetime
from zoneinfo import ZoneInfo

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

NAVY = colors.HexColor("#0B2A5B")
BLUE = colors.HexColor("#1D5FD1")
GOLD = colors.HexColor("#F2B705")
LINE = colors.HexColor("#DCE4F0")
MUTED = colors.HexColor("#4A5B7C")
INK = colors.HexColor("#14213D")
WIB = ZoneInfo("Asia/Jakarta")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 46  # sekitar 16 mm


def _wrap(text: str, max_chars: int) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def _qr_image(url: str) -> ImageReader:
    qr = qrcode.QRCode(box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#0B2A5B", back_color="white")
    pil = image.get_image() if hasattr(image, "get_image") else image
    return ImageReader(pil)


def _label(pdf: canvas.Canvas, x: float, y: float, text: str) -> None:
    pdf.setFont("Helvetica", 8.5)
    pdf.setFillColor(MUTED)
    pdf.drawString(x, y, text.upper())


def _value(pdf: canvas.Canvas, x: float, y: float, text: str, size: float = 10.5) -> None:
    pdf.setFont("Helvetica-Bold", size)
    pdf.setFillColor(INK)
    pdf.drawString(x, y, text)


def build_receipt(report: dict, origin: str) -> bytes:
    """Kembalikan byte PDF bukti laporan."""
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"Bukti Laporan {report['ticket_no']}")
    pdf.setAuthor("Lapor Depok")

    # Kepala dokumen
    pdf.setFillColor(NAVY)
    pdf.rect(0, PAGE_HEIGHT - 96, PAGE_WIDTH, 96, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(MARGIN, PAGE_HEIGHT - 52, "Lapor Depok")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.HexColor("#C9D6EA"))
    pdf.drawString(MARGIN, PAGE_HEIGHT - 70, "Kanal pengaduan dan aspirasi warga Kota Depok")

    pdf.setFillColor(GOLD)
    pdf.rect(PAGE_WIDTH - MARGIN - 74, PAGE_HEIGHT - 68, 74, 6, stroke=0, fill=1)

    y = PAGE_HEIGHT - 140
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(MARGIN, y, "BUKTI LAPORAN")
    y -= 34

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(MUTED)
    pdf.drawString(MARGIN, y, "Nomor Tiket")
    y -= 22
    pdf.setFont("Helvetica-Bold", 19)
    pdf.setFillColor(BLUE)
    pdf.drawString(MARGIN, y, report["ticket_no"])

    # QR di kanan atas
    qr_size = 104
    qr_x = PAGE_WIDTH - MARGIN - qr_size
    qr_y = y - 18
    qr_url = f"{origin.rstrip('/')}/cek/{report['ticket_no']}"
    pdf.drawImage(_qr_image(qr_url), qr_x, qr_y, width=qr_size, height=qr_size)
    pdf.setFont("Helvetica", 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawCentredString(qr_x + qr_size / 2, qr_y - 10, "Pindai untuk memantau laporan")

    y -= 46
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(1)
    pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y -= 26

    left_x = MARGIN
    right_x = MARGIN + 250

    def row(label: str, value: str, extra: str | None = None, max_chars: int = 58) -> None:
        nonlocal y
        lines = _wrap(value, max_chars)
        _label(pdf, left_x, y, label)
        _value(pdf, left_x, y - 15, lines[0])
        if extra:
            pdf.setFont("Helvetica", 9)
            pdf.setFillColor(MUTED)
            pdf.drawString(left_x, y - 29, extra)
        for line in lines[1:]:
            y -= 15
            _value(pdf, left_x, y - 15, line)
        y -= 44 if not extra else 56

    created = datetime.fromisoformat(str(report["created_at"])).astimezone(WIB)
    row("Dibuat", report.get("created_label") or created.strftime("%d-%m-%Y %H.%M WIB"))
    row("Pelapor", report["reporter_name"])
    row("Jenis laporan", report["type_label"])
    row("Kategori", report["category_name"])
    row("Instansi tujuan", report["agency_name"] or "Belum ditentukan")
    row("Prioritas", report["priority_label"])
    row("Judul", report["title"], max_chars=62)

    location_line = report.get("location_line") or "-"
    lines = _wrap(location_line, 62)
    _label(pdf, left_x, y, "Lokasi")
    for index, line in enumerate(lines):
        _value(pdf, left_x, y - 15 - index * 15, line)
    y -= 40 + (len(lines) - 1) * 15

    row("Tanggal kejadian", report["incident_date_label"])
    row("Privasi", report["privacy_label"])

    pdf.setStrokeColor(LINE)
    pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y -= 24

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(MUTED)
    note = (
        "Simpan dokumen ini sebagai bukti laporan. Status terbaru dapat dilihat "
        "melalui nomor tiket di atas atau dengan memindai QR."
    )
    for index, line in enumerate(_wrap(note, 96)):
        pdf.drawString(MARGIN, y - index * 13, line)

    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(MUTED)
    pdf.drawString(
        MARGIN,
        52,
        "Dokumen dihasilkan otomatis oleh sistem Lapor Depok. Data pada dokumen ini bersifat rahasia.",
    )
    pdf.setFillColor(GOLD)
    pdf.rect(MARGIN, 44, 58, 3, stroke=0, fill=1)

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
