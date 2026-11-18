-- Skema awal Lapor Depok (AGENTS.md bagian 8).
-- Semua waktu memakai timestamptz (UTC). NIK tidak pernah disimpan mentah.

create table if not exists schema_migrations (
    version    text primary key,
    applied_at timestamptz not null default now()
);

create table agencies (
    id   bigserial primary key,
    name text not null unique
);

create table districts (
    id   bigserial primary key,
    name text not null unique
);

create table villages (
    id          bigserial primary key,
    district_id bigint not null references districts (id) on delete restrict,
    name        text not null,
    unique (district_id, name)
);

create table categories (
    id                bigserial primary key,
    name              text not null unique,
    default_agency_id bigint references agencies (id) on delete set null
);

create table users (
    id             bigserial primary key,
    nik_enc        text not null,
    nik_hash       text not null unique,
    nik_last4      varchar(4) not null check (nik_last4 ~ '^[0-9]{4}$'),
    name           text not null,
    email          text not null unique,
    phone          text,
    address        text,
    rt             text,
    rw             text,
    kecamatan_id   bigint references districts (id) on delete set null,
    kelurahan_id   bigint references villages (id) on delete set null,
    password_hash  text not null,
    role           text not null check (role in ('warga', 'admin_verifikator', 'petugas_dinas', 'super_admin')),
    agency_id      bigint references agencies (id) on delete set null,
    email_verified boolean not null default false,
    created_at     timestamptz not null default now()
);

create table reports (
    id              bigserial primary key,
    ticket_no       text not null unique,
    user_id         bigint not null references users (id) on delete restrict,
    type            text not null check (type in ('pengaduan', 'aspirasi', 'informasi')),
    category_id     bigint not null references categories (id) on delete restrict,
    agency_id       bigint references agencies (id) on delete set null,
    priority        text not null default 'biasa' check (priority in ('biasa', 'mendesak')),
    title           text not null check (length(btrim(title)) > 0),
    body            text not null check (length(btrim(body)) > 0),
    incident_date   date not null,
    district_id     bigint references districts (id) on delete set null,
    village_id      bigint references villages (id) on delete set null,
    address         text,
    lat             double precision check (lat between -90 and 90),
    lng             double precision check (lng between -180 and 180),
    privacy         text not null check (privacy in ('tampil', 'rahasia', 'anonim')),
    status          text not null default 'diterima'
                    check (status in ('diterima', 'diverifikasi', 'diproses', 'selesai', 'ditolak')),
    rejection_reason text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    verified_at     timestamptz,
    processed_at    timestamptz,
    closed_at       timestamptz,
    constraint reports_rejection_reason_required
        check (status <> 'ditolak' or rejection_reason is not null)
);

create index reports_status_idx on reports (status);
create index reports_user_id_idx on reports (user_id);
create index reports_created_at_idx on reports (created_at desc);
create index reports_agency_status_idx on reports (agency_id, status);

create table attachments (
    id        bigserial primary key,
    report_id bigint not null references reports (id) on delete cascade,
    path      text not null,
    mime      text not null,
    size      bigint not null check (size > 0)
);

create index attachments_report_id_idx on attachments (report_id);

create table report_events (
    id            bigserial primary key,
    report_id     bigint not null references reports (id) on delete cascade,
    status        text not null
                  check (status in ('diterima', 'diverifikasi', 'diproses', 'selesai', 'ditolak')),
    note_public   text,
    note_internal text,
    actor_id      bigint references users (id) on delete set null,
    created_at    timestamptz not null default now()
);

create index report_events_report_id_idx on report_events (report_id, created_at);

create table followups (
    id         bigserial primary key,
    report_id  bigint not null references reports (id) on delete cascade,
    user_id    bigint not null references users (id) on delete restrict,
    body       text not null check (length(btrim(body)) between 10 and 1000),
    created_at timestamptz not null default now()
);

create index followups_report_id_idx on followups (report_id, created_at);

create table ratings (
    id         bigserial primary key,
    report_id  bigint not null unique references reports (id) on delete cascade,
    user_id    bigint not null references users (id) on delete restrict,
    score      smallint not null check (score between 1 and 5),
    aspects    text[],
    comment    varchar(500),
    created_at timestamptz not null default now()
);

create table email_tokens (
    id         bigserial primary key,
    user_id    bigint not null references users (id) on delete cascade,
    kind       text not null check (kind in ('verify', 'reset')),
    token_hash text not null unique,
    expires_at timestamptz not null,
    used_at    timestamptz,
    created_at timestamptz not null default now()
);

create index email_tokens_user_kind_idx on email_tokens (user_id, kind);

create table settings (
    key   text primary key,
    value text not null
);

create table audit_logs (
    id         bigserial primary key,
    actor_id   bigint references users (id) on delete set null,
    action     text not null,
    target     text,
    meta       jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on audit_logs (created_at desc);

create table ticket_counters (
    year     integer primary key,
    last_seq integer not null default 0 check (last_seq >= 0)
);
