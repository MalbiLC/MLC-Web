# Tutorbird

Tutoring center management system built with Next.js 15, Supabase, and Tailwind CSS.

## Features

- **Dashboard** — today's sessions at a glance
- **Students** — current and potential student database with session tracking
- **Teachers** — teacher profiles, availability, and per-student rate management
- **Calendar** — full schedule with filters by student, teacher, date, and time
- **Scheduling** — room and Zoom slot management
- **Invoices** — student invoices with PDF export (client-side, no storage)
- **Payslips** — teacher payslips with per-student rate breakdown and PDF export
- **Finance** — monthly P&L dashboard (owner only)
- **Settings** — branding, bank details, session alert threshold

## Quick start

See [`docs/SETUP.md`](docs/SETUP.md) for the full setup guide.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# 3. Run the database migration
# Paste supabase/migrations/001_initial_schema.sql into Supabase SQL Editor and run it

# 4. Start the dev server
npm run dev
```

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| Styling | Tailwind CSS |
| PDF generation | @react-pdf/renderer (client-side) |
| Deployment | Vercel |

## Access roles

| Module | Owner | Admin |
|---|---|---|
| Dashboard, Calendar, Students, Teachers, Scheduling, Invoices, Payslips, Settings | ✓ | ✓ |
| Finance | ✓ | ✗ |

Role enforcement happens at both middleware (redirect) and database (RLS policy) levels.
