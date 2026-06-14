# Tutorbird — Setup Guide

## Stack
- **Framework**: Next.js 15 (App Router)
- **Database + Auth**: Supabase (free tier)
- **Styling**: Tailwind CSS
- **PDF generation**: @react-pdf/renderer (client-side, no storage needed)
- **Deployment**: Vercel
- **Version control**: GitHub

---

## 1. Supabase setup

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the dashboard, go to **SQL Editor**.
3. Open `supabase/migrations/001_initial_schema.sql` and paste the entire contents into the SQL Editor.
4. Click **Run**. This creates all tables, enums, triggers, RLS policies, and seed data.
5. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

---

## 2. Create your first user (Owner)

In Supabase Dashboard → **Authentication → Users**:
1. Click **Add user** → **Create new user**.
2. Enter the owner's email and password.
3. Copy the new user's UUID from the users list.
4. Go to **SQL Editor** and run:

```sql
INSERT INTO profiles (id, full_name, role)
VALUES ('<paste-uuid-here>', 'Your Name', 'owner');
```

To add an Admin user, repeat the same steps but use `'admin'` as the role.

---

## 3. Local development

```bash
# Clone your repo
git clone https://github.com/your-username/tutorbird.git
cd tutorbird

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and paste your Supabase URL and anon key

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## 4. Deploy to Vercel

1. Push your repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo.
3. In the Vercel project settings, add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**.

Vercel auto-deploys on every push to `main`.

---

## 5. Project structure

```
tutorbird/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   ← Run this first in Supabase
├── src/
│   ├── app/
│   │   ├── login/           ← Public login page
│   │   ├── dashboard/       ← Home (today's summary)
│   │   ├── students/        ← Current + Potential tabs
│   │   ├── teachers/        ← Teacher database
│   │   ├── calendar/        ← Full schedule + filters
│   │   ├── scheduling/      ← Room + Zoom availability
│   │   ├── invoices/        ← Student invoices
│   │   ├── payslips/        ← Teacher payslips
│   │   ├── finance/         ← Owner-only P&L (owner only)
│   │   └── settings/        ← App settings (branding, bank details)
│   ├── components/
│   │   ├── layout/          ← Sidebar, page wrappers
│   │   ├── dashboard/       ← Dashboard-specific components
│   │   ├── students/        ← Student form, detail panel
│   │   ├── teachers/        ← Teacher form, availability editor
│   │   ├── sessions/        ← Session card, status actions
│   │   ├── invoices/        ← Invoice builder, PDF renderer
│   │   └── payslips/        ← Payslip builder, PDF renderer
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts    ← Browser Supabase client
│   │   │   └── server.ts    ← Server Supabase client
│   │   ├── queries.ts       ← All database query functions
│   │   └── utils.ts         ← Helpers: cn, formatIDR, formatDate, etc.
│   ├── hooks/               ← Custom React hooks (useProfile, useSettings)
│   ├── types/
│   │   └── index.ts         ← All TypeScript types
│   └── middleware.ts        ← Auth protection + role-based routing
├── .env.example             ← Copy to .env.local
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 6. Access roles

| Route | Owner | Admin |
|---|---|---|
| Dashboard | ✓ | ✓ |
| Calendar | ✓ | ✓ |
| Students | ✓ | ✓ |
| Teachers | ✓ | ✓ |
| Scheduling | ✓ | ✓ |
| Invoices | ✓ | ✓ |
| Payslips | ✓ | ✓ |
| Finance | ✓ | ✗ (redirected) |
| Settings | ✓ | ✓ |

Finance is blocked at both the middleware level (redirect) and the database level (RLS policy).

---

## 7. Key design decisions

### No file storage
PDFs are generated client-side via `@react-pdf/renderer` and downloaded directly to the browser. No Supabase Storage bucket is used, keeping the free tier footprint minimal.

### Single students table
Both current and potential students live in one `students` table, differentiated by `student_type`. Converting a potential to a current student is a simple `UPDATE` — no data migration.

### Live availability (no cron jobs)
Teacher availability is computed at query time by joining `teacher_availability` (recurring slots) with `sessions` (bookings). A slot is free if no `scheduled` session overlaps it. No background jobs needed.

### Auto-expiry trigger
When Admin marks a session `completed`, a Supabase trigger decrements `sessions_remaining`. If it reaches 0, `student.status` is automatically set to `expired`.

### Payslip locking
Once a payslip is `finalised`, its session lines and adjustments are frozen — even if sessions are later edited. This ensures payroll records are immutable.

---

## 8. Next pages to build

These pages have their structure and queries ready — the UI just needs to be written following the same pattern as `students/page.tsx`:

- `teachers/page.tsx` — teacher list with availability indicator
- `calendar/page.tsx` — full calendar with student/teacher/date filters
- `scheduling/page.tsx` — room and Zoom slot management
- `invoices/page.tsx` — invoice list + builder with PDF export
- `payslips/page.tsx` — payslip list + builder with PDF export
- `finance/page.tsx` — monthly P&L charts (owner only)
- `settings/page.tsx` — branding, bank details, session threshold
