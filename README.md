# Tutorbird

Tutoring center management system — Next.js 14, Supabase, Tailwind CSS.

## Setup

1. Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor
2. Create a user in Supabase Auth, then insert their profile with `role = 'owner'`
3. `cp .env.example .env.local` and add your Supabase URL + anon key
4. `npm install && npm run dev`

## Deploy

Push to GitHub → import in Vercel → add env vars → deploy.
