# MLC — Malbi Learning Center Management

Tutoring center management system built with Next.js 14, Supabase, and Tailwind CSS.

## Setup
1. Run the SQL schema in Supabase SQL Editor
2. Create a user in Supabase Auth, insert their profile with role = owner
3. `cp .env.example .env.local` — add Supabase URL + anon key
4. `npm install && npm run dev`

## Deploy
Push to GitHub → import in Vercel → add env vars → deploy.
