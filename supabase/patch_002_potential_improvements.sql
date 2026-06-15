-- ============================================================
-- MLC — Potential Student Improvements
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add trial teacher field
alter table students
  add column if not exists trial_teacher_id uuid references teachers(id) on delete set null;

-- Add enrolled_at for conversion rate tracking
alter table students
  add column if not exists enrolled_at timestamptz;
