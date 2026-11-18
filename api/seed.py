"""Seed data dummy Lapor Depok (AGENTS.md bagian 11).

Jalankan dari folder `api`:

    python seed.py

Sifat:
- Menghapus seluruh data aplikasi (termasuk data non-seed) lalu mengisi ulang.
  Di APP_ENV=production hanya diizinkan jika database belum berisi laporan,
  atau dipanggil dengan `--force`.
- Deterministik: random.seed tetap, jadi hasilnya sama tiap kali dijalankan.
- Nomor tiket berurutan per tahun lewat tabel ticket_counters.
- NIK dummy 16 digit, unik, disimpan terenkripsi Fernet + hash HMAC-SHA256.

Development memakai sandi dummy; produksi wajib mengisi SEED_PASSWORD.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import os
import random
import sys
from datetime import datetime, timedelta, timezone

import bcrypt
from cryptography.fernet import Fernet
from psycopg.types.json import Jsonb

import config
import db
import migrate

DEFAULT_SEED_PASSWORD = "LaporDepok2026!"


def resolve_seed_password(env: dict[str, str] | None = None) -> tuple[str | None, str | None]:
    """Tentukan sandi seed. Return (sandi, error).

    Development: SEED_PASSWORD bila ada, selain itu sandi dummy.
    Produksi: SEED_PASSWORD wajib, minimal 12 karakter, bukan sandi dummy.
    """
    values = os.environ if env is None else env
    raw = (values.get("SEED_PASSWORD") or "").strip()
    app_env = (values.get("APP_ENV") or "").strip().lower()
    if app_env in ("production", "prod"):
        if not raw:
            return None, "APP_ENV=production: SEED_PASSWORD wajib diisi (min. 12 karakter, bukan sandi dummy)."
        if len(raw) < 12:
            return None, "APP_ENV=production: SEED_PASSWORD minimal 12 karakter."
        if raw == DEFAULT_SEED_PASSWORD:
            return None, "APP_ENV=production: SEED_PASSWORD tidak boleh sama dengan sandi dummy LaporDepok2026!."
        return raw, None
    return raw or DEFAULT_SEED_PASSWORD, None


SEED_EMAIL_DOMAIN = "lapor-depok.test"
RANDOM_SEED = 20261110
NOW = datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# Master data
# ---------------------------------------------------------------------------

DISTRICTS: dict[str, list[str]] = {
    "Beji": ["Beji", "Kemiri Muka", "Kukusan", "Tanah Baru"],
    "Cimanggis": ["Cisalak Pasar", "Harjamukti", "Mekarsari", "Tugu"],
    "Cinere": ["Cinere", "Gandul", "Pangkalan Jati"],
    "Limo": ["Grogol", "Krukut", "Limo", "Meruyung"],
    "Pancoran Mas": ["Depok", "Depok Jaya", "Mampang", "Rangkapan Jaya"],
    "Sawangan": ["Bedahan", "Pengasinan", "Sawangan", "Sawangan Baru"],
    "Sukmajaya": ["Abadijaya", "Baktijaya", "Mekarjaya", "Sukmajaya", "Tirtajaya"],
    "Tapos": ["Cilangkap", "Cimpaeun", "Jatijajar", "Sukatani", "Tapos"],
}

AGENCIES = [
    "Dinas Pekerjaan Umum dan Penataan Ruang",
    "Dinas Lingkungan Hidup dan Kebersihan",
    "Dinas Kependudukan dan Pencatatan Sipil",
    "Satuan Polisi Pamong Praja",
    "Dinas Kesehatan",
    "Dinas Pendidikan",
    "Dinas Perhubungan",
    "Dinas Sosial",
]

# (kategori, instansi default)
CATEGORIES: list[tuple[str, str]] = [
    ("Infrastruktur & Jalan", "Dinas Pekerjaan Umum dan Penataan Ruang"),
    ("Kebersihan & Lingkungan", "Dinas Lingkungan Hidup dan Kebersihan"),
    ("Pelayanan Administrasi", "Dinas Kependudukan dan Pencatatan Sipil"),
    ("Keamanan & Ketertiban", "Satuan Polisi Pamong Praja"),
    ("Kesehatan", "Dinas Kesehatan"),
    ("Transportasi & Lalu Lintas", "Dinas Perhubungan"),
]

TITLE_TEMPLATES: dict[str, list[str]] = {
    "Infrastruktur & Jalan": [
        "Jalan berlubang membahayakan pengendara",
        "Trotoar rusak dan tidak ramah pejalan kaki",
        "Drainase tersumbat menyebabkan genangan",
        "Lampu penerangan jalan mati",
        "Jembatan kecil rusak di akses warga",
        "Tembok penahan jalan retak",
    ],
    "Kebersihan & Lingkungan": [
        "Sampah menumpuk di bahu jalan",
        "Tempat sampah umum rusak",
        "Saluran air dipenuhi sampah rumah tangga",
        "Pembakaran sampah mengganggu warga",
        "Limbah cair dibuang ke kali",
        "Tumpukan ranting pasca angin kencang",
    ],
    "Pelayanan Administrasi": [
        "Antrean layanan kependudukan terlalu panjang",
        "Berkas KTP hilang setelah pengajuan",
        "Petugas loket kurang informatif",
        "Pengurusan akta kelahiran tertunda",
        "Jadwal layanan kelurahan tidak sesuai pengumuman",
        "Sistem antrean online sering gagal",
    ],
    "Keamanan & Ketertiban": [
        "Parkir liar menutup badan jalan",
        "Bangunan semi permanen di atas saluran",
        "Pedagang kaki lima menutup trotoar",
        "Balap liar malam hari meresahkan",
        "Reklame tanpa izin berbahaya",
        "Gangguan ketertiban di taman kota",
    ],
    "Kesehatan": [
        "Fogging belum dilakukan di lingkungan kami",
        "Posyandu kekurangan tenaga medis",
        "Air bersih keruh dan berbau",
        "Antrean puskesmas tidak tertib",
        "Sampah medis ditemukan di tempat umum",
        "Jentik nyamuk ditemukan di banyak rumah",
    ],
    "Transportasi & Lalu Lintas": [
        "Lampu lalu lintas mati di persimpangan",
        "Angkutan umum berhenti sembarangan",
        "Marka jalan sudah pudar",
        "Halte rusak dan tidak beratap",
        "Pedagang menutup akses halte",
        "Rambu lalu lintas hilang",
    ],
}

BODY_DETAILS = [
    "Warga sekitar sudah melaporkan hal ini ke pengurus RT, tetapi belum ada tindak lanjut.",
    "Kondisi ini semakin parah saat hujan dan membahayakan pengguna jalan.",
    "Kami berharap ada pemeriksaan langsung ke lokasi dalam waktu dekat.",
    "Mohon ada penjelasan mengenai jadwal penanganan agar warga tidak menunggu tanpa kepastian.",
    "Dokumentasi kondisi terbaru dapat kami serahkan jika diperlukan.",
]

FOLLOWUP_BODIES = [
    "Terima kasih atas responsnya. Saat ini kondisi di lokasi belum berubah, mohon dicek kembali.",
    "Kami ingin menambahkan bahwa gangguan ini terjadi hampir setiap hari pada pagi hari.",
    "Apakah ada perkiraan waktu penanganan? Warga sudah menunggu cukup lama.",
    "Foto terbaru sudah kami simpan dan siap dikirim bila petugas membutuhkan.",
]

REJECTION_REASONS = [
    "Laporan tidak dapat diproses karena lokasi kejadian di luar wilayah Kota Depok.",
    "Laporan merupakan duplikat dari laporan lain yang sudah ditangani.",
    "Informasi yang diberikan tidak cukup untuk ditindaklanjuti petugas.",
    "Laporan bukan merupakan kewenangan Pemerintah Kota Depok.",
    "Laporan tidak memenuhi syarat sebagai pengaduan layanan publik.",
]

RATING_COMMENTS = [
    "Tanggapan cepat dan petugasnya ramah.",
    "Penanganan sudah baik, hanya perlu lebih cepat.",
    "Terima kasih, masalah akhirnya selesai.",
    "Sosialisasi ke warga bisa ditingkatkan lagi.",
    None,
    None,
]

ASPECTS = ["kecepatan respons", "kejelasan tanggapan", "hasil penanganan", "keramahan petugas"]

WARGA_NAMES = [
    "Ahmad Fauzi",
    "Nur Aisyah",
    "Rizky Ramadhan",
    "Putri Handayani",
    "Dedi Kurniawan",
    "Sri Wahyuni",
    "Bagus Nugroho",
    "Intan Permata",
    "Hendra Gunawan",
    "Maya Sari",
    "Fajar Hidayat",
    "Lestari Ningsih",
    "Yoga Saputra",
    "Wulan Puspita",
    "Irfan Maulana",
    "Ratna Dewi",
    "Bayu Prasetyo",
    "Fitriani",
    "Dimas Anggara",
    "Siti Nurhaliza",
]

STREETS = [
    "Margonda Raya",
    "Akses UI",
    "Raya Bogor",
    "Kartini",
    "Siliwangi",
    "Juanda",
    "Pemuda",
    "Merdeka",
    "Anggrek",
    "Melati",
]

# (nama, email lokal, role, instansi)
STAFF = [
    ("Siti Rahmawati", "superadmin", "super_admin", None),
    ("Andi Pratama", "verifikator1", "admin_verifikator", None),
    ("Dewi Lestari", "verifikator2", "admin_verifikator", None),
    ("Budi Santoso", "petugas.dlhk", "petugas_dinas", "Dinas Lingkungan Hidup dan Kebersihan"),
    ("Rina Marlina", "petugas.dpupr", "petugas_dinas", "Dinas Pekerjaan Umum dan Penataan Ruang"),
    ("Agus Setiawan", "petugas.dishub", "petugas_dinas", "Dinas Perhubungan"),
]

SLA_VERIFY_DAYS = 2
SLA_PROCESS_DAYS = 14


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def seed_email(local: str) -> str:
    return f"{local}@{SEED_EMAIL_DOMAIN}"


def make_nik(index: int) -> str:
    """NIK dummy 16 digit dengan prefix Depok 3276, unik per index."""
    return f"3276{100_000_000_000 + index:012d}"


def encrypt_nik(fernet: Fernet, nik: str) -> str:
    return fernet.encrypt(nik.encode("ascii")).decode("ascii")


def hash_nik(pepper: str, nik: str) -> str:
    return hmac.new(pepper.encode("utf-8"), nik.encode("ascii"), hashlib.sha256).hexdigest()


def next_ticket_no(conn, year: int) -> str:
    """Ambil nomor urut berikutnya dengan row lock (AGENTS.md bagian 8)."""
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


def add_time(moment: datetime, days: float) -> datetime:
    return moment + timedelta(days=days, hours=random.uniform(0, 6))


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------


def truncate_all(conn) -> None:
    conn.execute(
        """
        truncate table reports, attachments, report_events, followups, ratings,
                       email_tokens, audit_logs, users, agencies, categories,
                       villages, districts, ticket_counters, settings
        restart identity cascade
        """
    )


def insert_master(conn) -> tuple[dict[str, int], dict[str, int], dict[tuple[str, str], int]]:
    agency_ids: dict[str, int] = {}
    for name in AGENCIES:
        row = conn.execute(
            "insert into agencies (name) values (%s) returning id", (name,)
        ).fetchone()
        agency_ids[name] = row["id"]

    district_ids: dict[str, int] = {}
    village_ids: dict[tuple[str, str], int] = {}
    for district, villages in DISTRICTS.items():
        row = conn.execute(
            "insert into districts (name) values (%s) returning id", (district,)
        ).fetchone()
        district_ids[district] = row["id"]
        for village in villages:
            vrow = conn.execute(
                "insert into villages (district_id, name) values (%s, %s) returning id",
                (row["id"], village),
            ).fetchone()
            village_ids[(district, village)] = vrow["id"]

    for name, agency_name in CATEGORIES:
        conn.execute(
            "insert into categories (name, default_agency_id) values (%s, %s)",
            (name, agency_ids[agency_name]),
        )

    conn.execute(
        "insert into settings (key, value) values ('sla_verify_days', %s), ('sla_process_days', %s)"
        " on conflict (key) do update set value = excluded.value",
        (str(SLA_VERIFY_DAYS), str(SLA_PROCESS_DAYS)),
    )
    return agency_ids, district_ids, village_ids


def insert_user(
    conn,
    *,
    name: str,
    email: str,
    role: str,
    password_hash: str,
    fernet: Fernet,
    pepper: str,
    nik_index: int,
    agency_id: int | None = None,
    district: str | None = None,
    village: str | None = None,
    address: str | None = None,
    phone: str | None = None,
    district_ids: dict[str, int],
    village_ids: dict[tuple[str, str], int],
) -> int:
    nik = make_nik(nik_index)
    row = conn.execute(
        """
        insert into users (nik_enc, nik_hash, nik_last4, name, email, phone, address,
                           rt, rw, kecamatan_id, kelurahan_id, password_hash, role,
                           agency_id, email_verified, created_at)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, %s)
        returning id
        """,
        (
            encrypt_nik(fernet, nik),
            hash_nik(pepper, nik),
            nik[-4:],
            name,
            email,
            phone,
            address,
            "03",
            "05",
            district_ids.get(district) if district else None,
            village_ids.get((district, village)) if district and village else None,
            password_hash,
            role,
            agency_id,
            NOW - timedelta(days=random.randint(60, 400)),
        ),
    ).fetchone()
    return row["id"]


def seed(conn, password: str) -> dict[str, int]:
    random.seed(RANDOM_SEED)
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
    fernet = Fernet(config.nik_enc_key())
    pepper = config.nik_hash_pepper()

    truncate_all(conn)
    agency_ids, district_ids, village_ids = insert_master(conn)

    nik_index = 1
    staff_ids: dict[str, int] = {}
    for name, local, role, agency_name in STAFF:
        staff_ids[local] = insert_user(
            conn,
            name=name,
            email=seed_email(local),
            role=role,
            password_hash=password_hash,
            fernet=fernet,
            pepper=pepper,
            nik_index=nik_index,
            agency_id=agency_ids.get(agency_name) if agency_name else None,
            district="Pancoran Mas",
            village="Depok",
            address="Jalan Margonda Raya No. 54, RT 03/RW 05, Depok, Pancoran Mas",
            phone="0812000000%02d" % nik_index,
            district_ids=district_ids,
            village_ids=village_ids,
        )
        nik_index += 1

    warga: list[dict] = []
    district_names = list(DISTRICTS)
    for i, name in enumerate(WARGA_NAMES, start=1):
        district = district_names[(i - 1) % len(district_names)]
        village = DISTRICTS[district][(i - 1) % len(DISTRICTS[district])]
        street = STREETS[(i - 1) % len(STREETS)]
        user_id = insert_user(
            conn,
            name=name,
            email=seed_email(f"warga{i:02d}"),
            role="warga",
            password_hash=password_hash,
            fernet=fernet,
            pepper=pepper,
            nik_index=nik_index,
            district=district,
            village=village,
            address=f"Jalan {street} No. {10 + i}, RT 03/RW 05, {village}, {district}",
            phone=f"0813{10000000 + i:08d}",
            district_ids=district_ids,
            village_ids=village_ids,
        )
        warga.append(
            {
                "id": user_id,
                "name": name,
                "district": district,
                "village": village,
                "district_id": district_ids[district],
                "village_id": village_ids[(district, village)],
            }
        )
        nik_index += 1

    verifikator_ids = [staff_ids["verifikator1"], staff_ids["verifikator2"]]
    petugas_by_agency = {
        agency_ids["Dinas Lingkungan Hidup dan Kebersihan"]: staff_ids["petugas.dlhk"],
        agency_ids["Dinas Pekerjaan Umum dan Penataan Ruang"]: staff_ids["petugas.dpupr"],
        agency_ids["Dinas Perhubungan"]: staff_ids["petugas.dishub"],
    }
    category_rows = {
        row["name"]: row
        for row in conn.execute(
            "select id, name, default_agency_id from categories order by id"
        )
    }

    # Tanggal dibuat diurutkan agar nomor tiket naik seiring waktu.
    created_times = sorted(
        NOW - timedelta(days=random.uniform(0, 240), hours=random.uniform(0, 20))
        for _ in range(150)
    )

    used_titles: set[str] = set()
    reports: list[dict] = []

    for index, created_at in enumerate(created_times):
        # Warga pertama sengaja diberi 12 laporan agar pagination Laporan Saya
        # (10 baris per halaman) bisa diuji; sisanya dibagi ke warga lain.
        if index < 12:
            owner = warga[0]
        else:
            owner = warga[1 + (index - 12) % (len(warga) - 1)]
        category = random.choice(list(category_rows))
        category_row = category_rows[category]
        agency_id = category_row["default_agency_id"]
        agency_name = next(name for name, aid in agency_ids.items() if aid == agency_id)

        rt = random.randint(1, 15)
        rw = random.randint(1, 12)
        template = TITLE_TEMPLATES[category][index % len(TITLE_TEMPLATES[category])]
        title = f"{template} di Kelurahan {owner['village']} (RT {rt:02d}/RW {rw:02d})"
        attempts = 0
        while title in used_titles:
            rt = random.randint(1, 15)
            rw = random.randint(1, 12)
            title = f"{template} di Kelurahan {owner['village']} (RT {rt:02d}/RW {rw:02d})"
            attempts += 1
            if attempts > 30:
                title = f"{title} #{index + 1}"
                break
        used_titles.add(title)

        report_type = random.choices(
            ["pengaduan", "aspirasi", "informasi"], weights=[70, 22, 8], k=1
        )[0]
        privacy = random.choices(["tampil", "rahasia", "anonim"], weights=[60, 28, 12], k=1)[0]
        priority = "mendesak" if random.random() < 0.18 else "biasa"

        age_days = (NOW - created_at).days
        if age_days < 3:
            status = "diterima"
        elif age_days < 7:
            status = random.choices(
                ["diterima", "diverifikasi", "ditolak"], weights=[55, 35, 10], k=1
            )[0]
        else:
            status = random.choices(
                ["diterima", "diverifikasi", "diproses", "selesai", "ditolak"],
                weights=[8, 14, 28, 40, 10],
                k=1,
            )[0]

        verified_at = processed_at = closed_at = None
        rejection_reason = None

        if status in ("diverifikasi", "diproses", "selesai"):
            verified_at = add_time(created_at, random.uniform(0.5, 2.5))
        elif status == "ditolak":
            if random.random() < 0.5:
                verified_at = add_time(created_at, random.uniform(0.5, 2.0))

        if status in ("diproses", "selesai") and verified_at:
            processed_at = add_time(verified_at, random.uniform(1, 4))
        if status == "selesai" and processed_at:
            closed_at = add_time(processed_at, random.uniform(2, 12))
        if status == "ditolak":
            closed_at = add_time(verified_at or created_at, random.uniform(0.5, 2.0))
            rejection_reason = random.choice(REJECTION_REASONS)

        # Jangan biarkan timestamp melewati "sekarang": turunkan status.
        if closed_at and closed_at > NOW:
            if status == "selesai":
                status, closed_at = "diproses", None
            elif status == "ditolak":
                status, rejection_reason, closed_at = "diverifikasi", None, None
                if verified_at is None:
                    verified_at = add_time(created_at, random.uniform(0.5, 2.0))
        if processed_at and processed_at > NOW:
            status, processed_at = "diverifikasi", None
        if verified_at and verified_at > NOW:
            status, verified_at = "diterima", None

        last_event_at = closed_at or processed_at or verified_at or created_at
        ticket_no = next_ticket_no(conn, created_at.year)

        row = conn.execute(
            """
            insert into reports (ticket_no, user_id, type, category_id, agency_id, priority,
                                 title, body, incident_date, district_id, village_id, address,
                                 lat, lng, privacy, status, rejection_reason, created_at,
                                 updated_at, verified_at, processed_at, closed_at)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s)
            returning id
            """,
            (
                ticket_no,
                owner["id"],
                report_type,
                category_row["id"],
                agency_id,
                priority,
                title,
                f"{title}. {random.choice(BODY_DETAILS)}",
                (created_at - timedelta(days=random.randint(0, 5))).date(),
                owner["district_id"],
                owner["village_id"],
                f"RT {rt:02d}/RW {rw:02d}, Kelurahan {owner['village']}, Kecamatan {owner['district']}",
                -6.4025 + random.uniform(-0.035, 0.035),
                106.7942 + random.uniform(-0.035, 0.035),
                privacy,
                status,
                rejection_reason,
                created_at,
                last_event_at,
                verified_at,
                processed_at,
                closed_at,
            ),
        ).fetchone()
        report_id = row["id"]

        verifikator = random.choice(verifikator_ids)
        petugas = petugas_by_agency.get(agency_id, verifikator)

        events: list[tuple[str, datetime, str, int | None, str | None]] = [
            (
                "diterima",
                created_at,
                "Laporan diterima dan menunggu verifikasi.",
                None,
                None,
            )
        ]
        if verified_at:
            events.append(
                (
                    "diverifikasi",
                    verified_at,
                    f"Laporan telah diverifikasi dan diteruskan ke {agency_name}.",
                    verifikator,
                    None,
                )
            )
        if processed_at:
            events.append(
                (
                    "diproses",
                    processed_at,
                    f"Laporan sedang ditangani oleh {agency_name}.",
                    petugas,
                    None,
                )
            )
        if closed_at and status == "selesai":
            events.append(
                (
                    "selesai",
                    closed_at,
                    "Laporan selesai ditangani. Terima kasih atas laporan Anda.",
                    petugas,
                    None,
                )
            )
        if closed_at and status == "ditolak":
            events.append(
                (
                    "ditolak",
                    closed_at,
                    rejection_reason,
                    verifikator,
                    "Laporan tidak memenuhi kriteria untuk diproses lebih lanjut.",
                )
            )

        audit_actions = {
            "diverifikasi": "report.verified",
            "diproses": "report.processed",
            "selesai": "report.closed",
            "ditolak": "report.rejected",
        }
        for event_status, event_at, note_public, actor_id, note_internal in events:
            conn.execute(
                """
                insert into report_events (report_id, status, note_public, note_internal,
                                           actor_id, created_at)
                values (%s, %s, %s, %s, %s, %s)
                """,
                (report_id, event_status, note_public, note_internal, actor_id, event_at),
            )
            if event_status != "diterima":
                conn.execute(
                    """
                    insert into audit_logs (actor_id, action, target, meta, created_at)
                    values (%s, %s, %s, %s, %s)
                    """,
                    (
                        actor_id,
                        audit_actions[event_status],
                        f"report:{ticket_no}",
                        Jsonb({"status": event_status, "ticket_no": ticket_no}),
                        event_at,
                    ),
                )

        reports.append(
            {
                "id": report_id,
                "user_id": owner["id"],
                "status": status,
                "created_at": created_at,
                "processed_at": processed_at,
                "closed_at": closed_at,
                "ticket_no": ticket_no,
            }
        )

    # Tanggapan pelapor pada sebagian laporan yang masih diproses.
    diproses = [r for r in reports if r["status"] == "diproses" and r["processed_at"]]
    for report in diproses[:15]:
        followup_at = add_time(report["processed_at"], random.uniform(0.5, 4))
        if followup_at > NOW:
            followup_at = report["processed_at"]
        conn.execute(
            "insert into followups (report_id, user_id, body, created_at) values (%s, %s, %s, %s)",
            (report["id"], report["user_id"], random.choice(FOLLOWUP_BODIES), followup_at),
        )

    # Penilaian: hanya laporan selesai, minimal 30 (ambil maksimal 45).
    selesai = [r for r in reports if r["status"] == "selesai"]
    if len(selesai) < 30:
        raise RuntimeError(
            f"Hanya {len(selesai)} laporan selesai; seed butuh minimal 30 untuk penilaian."
        )
    for report in selesai[:45]:
        rating_at = add_time(report["closed_at"], random.uniform(0.5, 7))
        if rating_at > NOW:
            rating_at = report["closed_at"]
        aspects = random.sample(ASPECTS, random.randint(1, 4))
        conn.execute(
            """
            insert into ratings (report_id, user_id, score, aspects, comment, created_at)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (
                report["id"],
                report["user_id"],
                random.choices([5, 4, 3, 2, 1], weights=[40, 35, 15, 7, 3], k=1)[0],
                aspects,
                random.choice(RATING_COMMENTS),
                rating_at,
            ),
        )

    return {
        "users": conn.execute("select count(*) as n from users").fetchone()["n"],
        "reports": conn.execute("select count(*) as n from reports").fetchone()["n"],
        "ratings": conn.execute("select count(*) as n from ratings").fetchone()["n"],
        "followups": conn.execute("select count(*) as n from followups").fetchone()["n"],
        "events": conn.execute("select count(*) as n from report_events").fetchone()["n"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Isi database Lapor Depok dengan data dummy.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="izinkan seed menghapus data walau APP_ENV=production",
    )
    args = parser.parse_args()

    password, password_error = resolve_seed_password()
    if password_error:
        print(password_error)
        return 1
    assert password is not None
    is_prod = os.getenv("APP_ENV", "").strip().lower() in ("production", "prod")

    if not os.getenv("NIK_ENC_KEY", "").strip():
        print("NIK_ENC_KEY kosong. Isi dulu di api/.env (lihat .env.dev.example).")
        return 1

    try:
        db.open_pool()
    except config.ConfigError as exc:
        print(exc)
        return 1
    try:
        applied = migrate.run_migrations()
        if applied:
            print(f"Migrasi diterapkan: {', '.join(applied)}")
        with db.connection() as conn:
            if is_prod and not args.force:
                existing = conn.execute("select count(*) as n from reports").fetchone()["n"]
                if existing:
                    print("APP_ENV=production: database sudah berisi laporan; seed ditolak. Pakai --force jika benar-benar yakin.")
                    return 1
            counts = seed(conn, password)
    finally:
        db.close_pool()

    print("Seed selesai. Data lama dihapus, data seed baru dibuat.")
    print(f"  users        : {counts['users']}")
    print(f"  reports      : {counts['reports']}")
    print(f"  ratings      : {counts['ratings']}")
    print(f"  followups    : {counts['followups']}")
    print(f"  report_events: {counts['events']}")
    if is_prod:
        print("  sandi akun seed diambil dari SEED_PASSWORD")
    else:
        print(f"  sandi semua akun: {password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
