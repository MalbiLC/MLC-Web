-- ============================================================
-- TUTORBIRD — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────
create type employment_type   as enum ('full_time', 'part_time');
create type student_type      as enum ('current', 'potential');
create type student_status    as enum ('ongoing', 'expired');
create type session_status    as enum ('scheduled', 'completed', 'cancelled', 'rescheduled');
create type teacher_status    as enum ('active', 'inactive');
create type invoice_status    as enum ('draft', 'sent', 'paid');
create type payslip_status    as enum ('draft', 'finalised', 'paid');
create type adjustment_type   as enum ('addition', 'deduction');
create type item_type         as enum ('package', 'registration', 'material', 'custom');
create type room_type         as enum ('physical', 'zoom');
create type user_role         as enum ('owner', 'admin');

-- ── Profiles (extends Supabase auth.users) ───────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'admin',
  created_at  timestamptz default now()
);

-- ── App settings (single row) ────────────────────────────────
create table app_settings (
  id                  uuid primary key default uuid_generate_v4(),
  config              jsonb not null default '{
    "center_name": "",
    "instagram": "",
    "phone": "",
    "address": "",
    "logo_base64": "",
    "bank_name": "",
    "bank_account_name": "",
    "bank_account_number": "",
    "low_session_threshold": 3
  }'::jsonb
);
insert into app_settings default values;

-- ── Subjects ─────────────────────────────────────────────────
create table subjects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  created_at  timestamptz default now()
);

-- ── Rooms ────────────────────────────────────────────────────
create table rooms (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  type          room_type not null default 'physical',
  zoom_link     text,
  is_available  boolean not null default true,
  created_at    timestamptz default now()
);

-- ── Students ─────────────────────────────────────────────────
create table students (
  id                  uuid primary key default uuid_generate_v4(),
  full_name           text not null,
  date_of_birth       date,
  grade               text,
  level               text,
  school              text,
  parent_name         text,
  parent_contact      text,
  student_type        student_type not null default 'potential',
  status              student_status not null default 'ongoing',
  sessions_remaining  int not null default 0 check (sessions_remaining >= 0),
  reached_out_at      date,
  notes               text,
  created_at          timestamptz default now()
);

-- ── Student ↔ Subjects (many-to-many) ───────────────────────
create table student_subjects (
  student_id  uuid not null references students(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  primary key (student_id, subject_id)
);

-- ── Teachers ─────────────────────────────────────────────────
create table teachers (
  id                uuid primary key default uuid_generate_v4(),
  full_name         text not null,
  phone_number      text,
  employment_type   employment_type not null default 'part_time',
  status            teacher_status not null default 'active',
  base_hourly_rate  decimal(12,2),
  monthly_salary    decimal(12,2),
  notes             text,
  created_at        timestamptz default now()
);

-- ── Teacher ↔ Subjects (many-to-many) ───────────────────────
create table teacher_subjects (
  teacher_id  uuid not null references teachers(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  primary key (teacher_id, subject_id)
);

-- ── Teacher availability (recurring weekly slots) ────────────
create table teacher_availability (
  id          uuid primary key default uuid_generate_v4(),
  teacher_id  uuid not null references teachers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sun, 6=Sat
  slot_start  time not null,
  slot_end    time not null,
  check (slot_end > slot_start)
);

-- ── Teacher ↔ Student assignments (with per-pair rate) ───────
create table teacher_student_assignments (
  id            uuid primary key default uuid_generate_v4(),
  teacher_id    uuid not null references teachers(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  subject_id    uuid references subjects(id),
  custom_rate   decimal(12,2),
  rate_note     text,
  assigned_at   timestamptz default now(),
  unique (teacher_id, student_id, subject_id)
);

-- ── Sessions ─────────────────────────────────────────────────
create table sessions (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete restrict,
  teacher_id        uuid not null references teachers(id) on delete restrict,
  room_id           uuid references rooms(id),
  subject_id        uuid references subjects(id),
  scheduled_at      timestamptz not null,
  duration_minutes  int not null default 60 check (duration_minutes > 0),
  status            session_status not null default 'scheduled',
  rescheduled_to    uuid references sessions(id),
  rescheduled_from  uuid references sessions(id),
  notes             text,
  created_by        uuid references profiles(id),
  created_at        timestamptz default now()
);

create index idx_sessions_scheduled_at on sessions (scheduled_at);
create index idx_sessions_teacher_id   on sessions (teacher_id);
create index idx_sessions_student_id   on sessions (student_id);
create index idx_sessions_status       on sessions (status);

-- ── Invoices ─────────────────────────────────────────────────
create table invoices (
  id                  uuid primary key default uuid_generate_v4(),
  invoice_number      text not null unique,
  student_id          uuid not null references students(id) on delete restrict,
  invoice_for         text not null,
  invoice_date        date not null default current_date,
  due_date            date,
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,
  notes               text,
  tax_amount          decimal(12,2) not null default 0,
  subtotal            decimal(12,2) not null default 0,
  total               decimal(12,2) not null default 0,
  status              invoice_status not null default 'draft',
  paid_at             timestamptz,
  created_by          uuid references profiles(id),
  created_at          timestamptz default now()
);

create table invoice_line_items (
  id            uuid primary key default uuid_generate_v4(),
  invoice_id    uuid not null references invoices(id) on delete cascade,
  description   text not null,
  item_type     item_type not null default 'custom',
  quantity      int not null default 1,
  unit_price    decimal(12,2) not null default 0,
  discount_pct  decimal(5,2) not null default 0 check (discount_pct between 0 and 100),
  expiry_date   date,
  total_price   decimal(12,2) not null default 0,
  sort_order    int not null default 0
);

-- ── Payslips ─────────────────────────────────────────────────
create table payslips (
  id                uuid primary key default uuid_generate_v4(),
  payslip_number    text not null unique,
  teacher_id        uuid not null references teachers(id) on delete restrict,
  period_month      int not null check (period_month between 1 and 12),
  period_year       int not null check (period_year > 2000),
  employment_type   employment_type not null,
  monthly_salary    decimal(12,2),
  sessions_total    decimal(12,2) not null default 0,
  adjustments_total decimal(12,2) not null default 0,
  grand_total       decimal(12,2) not null default 0,
  status            payslip_status not null default 'draft',
  notes             text,
  created_by        uuid references profiles(id),
  created_at        timestamptz default now(),
  unique (teacher_id, period_month, period_year)
);

create table payslip_session_lines (
  id               uuid primary key default uuid_generate_v4(),
  payslip_id       uuid not null references payslips(id) on delete cascade,
  session_id       uuid not null references sessions(id) on delete restrict,
  student_id       uuid not null references students(id),
  student_name     text not null,
  subject_name     text,
  session_date     date not null,
  duration_minutes int not null,
  rate_used        decimal(12,2) not null,
  line_total       decimal(12,2) not null
);

create table payslip_adjustments (
  id               uuid primary key default uuid_generate_v4(),
  payslip_id       uuid not null references payslips(id) on delete cascade,
  label            text not null,
  adjustment_type  adjustment_type not null,
  amount           decimal(12,2) not null check (amount >= 0),
  sort_order       int not null default 0
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. Decrement sessions_remaining on completion,
--    then auto-expire student if it hits 0
create or replace function handle_session_completed()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'completed' and OLD.status != 'completed' then
    update students
      set sessions_remaining = sessions_remaining - 1
      where id = NEW.student_id
        and sessions_remaining > 0;

    update students
      set status = 'expired'
      where id = NEW.student_id
        and sessions_remaining = 0;
  end if;
  return NEW;
end;
$$;

create trigger trg_session_completed
  after update on sessions
  for each row execute function handle_session_completed();

-- 2. Auto-generate invoice number (YYYYMM/NNN)
create or replace function generate_invoice_number()
returns trigger language plpgsql as $$
declare
  prefix  text;
  next_n  int;
begin
  prefix := to_char(now(), 'YYYYMM');
  select coalesce(max(
    cast(split_part(invoice_number, '/', 2) as int)
  ), 0) + 1
  into next_n
  from invoices
  where invoice_number like prefix || '/%';

  NEW.invoice_number := prefix || '/' || lpad(next_n::text, 3, '0');
  return NEW;
end;
$$;

create trigger trg_invoice_number
  before insert on invoices
  for each row
  when (NEW.invoice_number is null or NEW.invoice_number = '')
  execute function generate_invoice_number();

-- 3. Auto-generate payslip number (PAY/YYYY/MM/NNN)
create or replace function generate_payslip_number()
returns trigger language plpgsql as $$
declare
  prefix  text;
  next_n  int;
begin
  prefix := 'PAY/' || NEW.period_year || '/' || lpad(NEW.period_month::text, 2, '0');
  select coalesce(max(
    cast(split_part(payslip_number, '/', 4) as int)
  ), 0) + 1
  into next_n
  from payslips
  where payslip_number like prefix || '/%';

  NEW.payslip_number := prefix || '/' || lpad(next_n::text, 3, '0');
  return NEW;
end;
$$;

create trigger trg_payslip_number
  before insert on payslips
  for each row
  when (NEW.payslip_number is null or NEW.payslip_number = '')
  execute function generate_payslip_number();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles                   enable row level security;
alter table app_settings               enable row level security;
alter table subjects                   enable row level security;
alter table rooms                      enable row level security;
alter table students                   enable row level security;
alter table student_subjects           enable row level security;
alter table teachers                   enable row level security;
alter table teacher_subjects           enable row level security;
alter table teacher_availability       enable row level security;
alter table teacher_student_assignments enable row level security;
alter table sessions                   enable row level security;
alter table invoices                   enable row level security;
alter table invoice_line_items         enable row level security;
alter table payslips                   enable row level security;
alter table payslip_session_lines      enable row level security;
alter table payslip_adjustments        enable row level security;

-- Helper: get current user role
create or replace function get_my_role()
returns user_role language sql security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- All authenticated users can read most tables
create policy "authenticated read"
  on profiles for select to authenticated using (true);

create policy "authenticated read"
  on subjects for select to authenticated using (true);

create policy "authenticated read"
  on rooms for select to authenticated using (true);

create policy "authenticated read"
  on students for select to authenticated using (true);

create policy "authenticated read"
  on student_subjects for select to authenticated using (true);

create policy "authenticated read"
  on teachers for select to authenticated using (true);

create policy "authenticated read"
  on teacher_subjects for select to authenticated using (true);

create policy "authenticated read"
  on teacher_availability for select to authenticated using (true);

create policy "authenticated read"
  on teacher_student_assignments for select to authenticated using (true);

create policy "authenticated read"
  on sessions for select to authenticated using (true);

create policy "authenticated read"
  on invoices for select to authenticated using (true);

create policy "authenticated read"
  on invoice_line_items for select to authenticated using (true);

create policy "authenticated read"
  on payslips for select to authenticated using (true);

create policy "authenticated read"
  on payslip_session_lines for select to authenticated using (true);

create policy "authenticated read"
  on payslip_adjustments for select to authenticated using (true);

-- All authenticated users can write to most tables
create policy "authenticated write"
  on students for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on student_subjects for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on teachers for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on teacher_subjects for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on teacher_availability for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on teacher_student_assignments for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on sessions for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on invoices for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on invoice_line_items for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on payslips for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on payslip_session_lines for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on payslip_adjustments for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on subjects for all to authenticated using (true) with check (true);

create policy "authenticated write"
  on rooms for all to authenticated using (true) with check (true);

-- app_settings: read by all, write by owner only
create policy "all read settings"
  on app_settings for select to authenticated using (true);

create policy "owner write settings"
  on app_settings for update to authenticated
  using (get_my_role() = 'owner')
  with check (get_my_role() = 'owner');

-- profiles: users see their own, owners see all
create policy "own profile"
  on profiles for all to authenticated
  using (id = auth.uid() or get_my_role() = 'owner')
  with check (id = auth.uid() or get_my_role() = 'owner');

-- ============================================================
-- SEED: default subjects and rooms
-- ============================================================
insert into subjects (name) values
  ('Math'), ('English'), ('Science'), ('Mandarin'),
  ('Physics'), ('Chemistry'), ('Biology'), ('History'),
  ('Geography'), ('Indonesian'), ('Art'), ('Music');

insert into rooms (name, type) values
  ('Room 1', 'physical'),
  ('Room 2', 'physical'),
  ('Room 3', 'physical'),
  ('Zoom 1', 'zoom'),
  ('Zoom 2', 'zoom');
