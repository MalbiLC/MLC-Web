import { createClient } from './supabase/client'
import type { DashboardSession, DashboardStats } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getTodaySessions(): Promise<DashboardSession[]> {
  const sb = createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await sb.from('sessions')
    .select('*, student:students(id,full_name,sessions_remaining,status), teacher:teachers(id,full_name), subject:subjects(id,name), room:rooms(id,name,type)')
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return (data || []).map((s: any) => ({
    ...s,
    student_name: s.student?.full_name || '', teacher_name: s.teacher?.full_name || '',
    subject_name: s.subject?.name || null, room_name: s.room?.name || null,
    room_type: s.room?.type || null, sessions_remaining: s.student?.sessions_remaining || 0,
  }))
}

export function computeStats(sessions: DashboardSession[]): DashboardStats {
  const sIds = new Set<string>(); const tIds = new Set<string>()
  sessions.filter(s => s.status !== 'cancelled').forEach(s => { sIds.add(s.student_id); tIds.add(s.teacher_id) })
  return {
    total: sessions.length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
    students: sIds.size, teachers: tIds.size,
  }
}

export async function getStudents(type?: 'current' | 'potential') {
  const sb = createClient()
  let q = sb.from('students').select('*, student_subjects(subject:subjects(id,name))').order('full_name')
  if (type) q = q.eq('student_type', type)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((s: any) => ({ ...s, subjects: (s.student_subjects || []).map((ss: any) => ss.subject) }))
}

export async function getTeachers() {
  const sb = createClient()
  const { data, error } = await sb.from('teachers')
    .select('*, teacher_subjects(subject:subjects(id,name))').order('full_name')
  if (error) throw error
  return (data || []).map((t: any) => ({ ...t, subjects: (t.teacher_subjects || []).map((ts: any) => ts.subject) }))
}

export async function getAppSettings() {
  const sb = createClient()
  const { data, error } = await sb.from('app_settings').select('config').single()
  if (error) throw error
  return data?.config || {}
}
