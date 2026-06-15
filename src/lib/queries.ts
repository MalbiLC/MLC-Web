import { createClient } from './supabase/client'
import type { DashboardSession, DashboardStats } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Dashboard ────────────────────────────────────────────────
export async function getTodaySessions(): Promise<DashboardSession[]> {
  const sb = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await sb
    .from('sessions')
    .select(`
      *,
      student:students ( id, full_name, sessions_remaining, status ),
      teacher:teachers ( id, full_name ),
      subject:subjects ( id, name ),
      room:rooms ( id, name, type )
    `)
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .order('scheduled_at', { ascending: true })

  if (error) throw error

  return (data || []).map((s: any) => ({
    ...s,
    student_name:       s.student?.full_name || '',
    teacher_name:       s.teacher?.full_name || '',
    subject_name:       s.subject?.name || null,
    room_name:          s.room?.name || null,
    room_type:          s.room?.type || null,
    sessions_remaining: s.student?.sessions_remaining || 0,
  }))
}

export function computeDashboardStats(sessions: DashboardSession[]): DashboardStats {
  const studentIds = new Set<string>()
  const teacherIds = new Set<string>()
  sessions.filter(s => s.status !== 'cancelled').forEach(s => {
    studentIds.add(s.student_id)
    teacherIds.add(s.teacher_id)
  })
  return {
    total:     sessions.length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
    students:  studentIds.size,
    teachers:  teacherIds.size,
  }
}

// ── Students ─────────────────────────────────────────────────
export async function getStudents(type?: 'current' | 'potential') {
  const sb = createClient()
  let query = sb.from('students')
    .select('*, student_subjects ( subject:subjects ( id, name ) )')
    .order('full_name')
  if (type) query = query.eq('student_type', type)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map((s: any) => ({
    ...s,
    subjects: (s.student_subjects || []).map((ss: any) => ss.subject),
  }))
}

// ── Teachers ─────────────────────────────────────────────────
export async function getTeachers(status?: 'active' | 'inactive') {
  const sb = createClient()
  let query = sb.from('teachers')
    .select('*, teacher_subjects ( subject:subjects ( id, name ) ), teacher_availability ( * )')
    .order('full_name')
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map((t: any) => ({
    ...t,
    subjects:     (t.teacher_subjects || []).map((ts: any) => ts.subject),
    availability: t.teacher_availability || [],
  }))
}

export async function getTeacher(id: string) {
  const sb = createClient()
  const { data, error } = await sb.from('teachers')
    .select(`
      *,
      teacher_subjects ( subject:subjects ( id, name ) ),
      teacher_availability ( * ),
      teacher_student_assignments (
        *, student:students ( id, full_name, sessions_remaining, status ),
        subject:subjects ( id, name )
      )
    `)
    .eq('id', id).single()
  if (error) throw error
  return {
    ...data,
    subjects:     (data.teacher_subjects || []).map((ts: any) => ts.subject),
    availability: data.teacher_availability || [],
    assignments:  data.teacher_student_assignments || [],
  }
}

// ── Sessions ─────────────────────────────────────────────────
export async function getSessions(filters?: {
  studentId?: string; teacherId?: string; from?: string; to?: string; status?: string
}) {
  const sb = createClient()
  let query = sb.from('sessions')
    .select(`
      *, student:students ( id, full_name, sessions_remaining ),
      teacher:teachers ( id, full_name ),
      subject:subjects ( id, name ), room:rooms ( id, name, type )
    `)
    .order('scheduled_at', { ascending: false })
  if (filters?.studentId) query = query.eq('student_id', filters.studentId)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.status)    query = query.eq('status', filters.status)
  if (filters?.from)      query = query.gte('scheduled_at', filters.from)
  if (filters?.to)        query = query.lte('scheduled_at', filters.to)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ── Invoices ─────────────────────────────────────────────────
export async function getInvoices() {
  const sb = createClient()
  const { data, error } = await sb.from('invoices')
    .select('*, student:students ( id, full_name, parent_name ), line_items:invoice_line_items ( * )')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Payslips ─────────────────────────────────────────────────
export async function getPayslips() {
  const sb = createClient()
  const { data, error } = await sb.from('payslips')
    .select(`
      *, teacher:teachers ( id, full_name ),
      session_lines:payslip_session_lines ( * ),
      adjustments:payslip_adjustments ( * )
    `)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
  if (error) throw error
  return data || []
}

// ── App settings ─────────────────────────────────────────────
export async function getAppSettings() {
  const sb = createClient()
  const { data, error } = await sb.from('app_settings').select('config').single()
  if (error) throw error
  return data?.config || {}
}
