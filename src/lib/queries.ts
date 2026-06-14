import { createClient } from './supabase/client'
import type { DashboardSession, DashboardStats } from '@/types'
import { startOfMonth, endOfMonth, format } from 'date-fns'

// ── Dashboard ────────────────────────────────────────────────
export async function getTodaySessions(): Promise<DashboardSession[]> {
  const sb = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await sb
    .from('sessions')
    .select(`
      *,
      student:students(id, full_name, sessions_remaining, status),
      teacher:teachers(id, full_name),
      subject:subjects(id, name),
      room:rooms(id, name, type)
    `)
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .order('scheduled_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((s: any) => ({
    ...s,
    student_name:       s.student?.full_name ?? '',
    teacher_name:       s.teacher?.full_name ?? '',
    subject_name:       s.subject?.name ?? null,
    room_name:          s.room?.name ?? null,
    room_type:          s.room?.type ?? null,
    sessions_remaining: s.student?.sessions_remaining ?? 0,
  }))
}

export function computeDashboardStats(sessions: DashboardSession[]): DashboardStats {
  const nonCancelled = sessions.filter(s => s.status !== 'cancelled')
  return {
    total:     sessions.length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
    students:  new Set(nonCancelled.map(s => s.student_id)).size,
    teachers:  new Set(nonCancelled.map(s => s.teacher_id)).size,
  }
}

// ── Students ─────────────────────────────────────────────────
export async function getStudents(type?: 'current' | 'potential') {
  const sb = createClient()
  let query = sb
    .from('students')
    .select(`*, student_subjects(subject:subjects(id,name))`)
    .order('full_name')

  if (type) query = query.eq('student_type', type)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((s: any) => ({
    ...s,
    subjects: s.student_subjects?.map((ss: any) => ss.subject) ?? [],
  }))
}

export async function getStudent(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('students')
    .select(`*, student_subjects(subject:subjects(id,name))`)
    .eq('id', id)
    .single()

  if (error) throw error
  return { ...data, subjects: data.student_subjects?.map((ss: any) => ss.subject) ?? [] }
}

// ── Teachers ─────────────────────────────────────────────────
export async function getTeachers(status?: 'active' | 'inactive') {
  const sb = createClient()
  let query = sb
    .from('teachers')
    .select(`
      *,
      teacher_subjects(subject:subjects(id,name)),
      teacher_availability(*)
    `)
    .order('full_name')

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((t: any) => ({
    ...t,
    subjects:     t.teacher_subjects?.map((ts: any) => ts.subject) ?? [],
    availability: t.teacher_availability ?? [],
  }))
}

export async function getTeacher(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('teachers')
    .select(`
      *,
      teacher_subjects(subject:subjects(id,name)),
      teacher_availability(*),
      teacher_student_assignments(
        *,
        student:students(id, full_name, sessions_remaining, status),
        subject:subjects(id, name)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return {
    ...data,
    subjects:     data.teacher_subjects?.map((ts: any) => ts.subject) ?? [],
    availability: data.teacher_availability ?? [],
    assignments:  data.teacher_student_assignments ?? [],
  }
}

// ── Sessions ─────────────────────────────────────────────────
export async function getSessions(filters?: {
  studentId?: string
  teacherId?: string
  from?: string
  to?: string
  status?: string
}) {
  const sb = createClient()
  let query = sb
    .from('sessions')
    .select(`
      *,
      student:students(id, full_name, sessions_remaining),
      teacher:teachers(id, full_name),
      subject:subjects(id, name),
      room:rooms(id, name, type)
    `)
    .order('scheduled_at', { ascending: false })

  if (filters?.studentId) query = query.eq('student_id', filters.studentId)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.status)    query = query.eq('status', filters.status)
  if (filters?.from)      query = query.gte('scheduled_at', filters.from)
  if (filters?.to)        query = query.lte('scheduled_at', filters.to)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ── Calendar availability check ──────────────────────────────
export async function getTeacherFreeSlots(teacherId: string, date: Date) {
  const sb = createClient()
  const dayOfWeek = date.getDay()
  const dateStr   = format(date, 'yyyy-MM-dd')

  const [{ data: slots }, { data: booked }] = await Promise.all([
    sb.from('teacher_availability')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('day_of_week', dayOfWeek),
    sb.from('sessions')
      .select('scheduled_at, duration_minutes')
      .eq('teacher_id', teacherId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', `${dateStr}T00:00:00`)
      .lte('scheduled_at', `${dateStr}T23:59:59`),
  ])

  return { slots: slots ?? [], booked: booked ?? [] }
}

// ── Invoices ─────────────────────────────────────────────────
export async function getInvoices(status?: string) {
  const sb = createClient()
  let query = sb
    .from('invoices')
    .select(`*, student:students(id, full_name, parent_name), line_items:invoice_line_items(*)`)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getInvoice(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('invoices')
    .select(`*, student:students(id, full_name, parent_name), line_items:invoice_line_items(*)`)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// ── Payslips ─────────────────────────────────────────────────
export async function getPayslips(filters?: { teacherId?: string; year?: number; month?: number }) {
  const sb = createClient()
  let query = sb
    .from('payslips')
    .select(`
      *,
      teacher:teachers(id, full_name),
      session_lines:payslip_session_lines(*),
      adjustments:payslip_adjustments(*)
    `)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.year)      query = query.eq('period_year', filters.year)
  if (filters?.month)     query = query.eq('period_month', filters.month)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCompletedSessionsForPayslip(teacherId: string, month: number, year: number) {
  const sb = createClient()
  const from = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')
  const to   = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')

  const { data, error } = await sb
    .from('sessions')
    .select(`
      *,
      student:students(id, full_name),
      subject:subjects(id, name),
      assignment:teacher_student_assignments!inner(custom_rate)
    `)
    .eq('teacher_id', teacherId)
    .eq('status', 'completed')
    .gte('scheduled_at', `${from}T00:00:00`)
    .lte('scheduled_at', `${to}T23:59:59`)

  if (error) throw error
  return data ?? []
}

// ── Finance ──────────────────────────────────────────────────
export async function getFinanceSummary(year: number) {
  const sb = createClient()

  const [{ data: invoicesData }, { data: payslipsData }] = await Promise.all([
    sb.from('invoices')
      .select('total, status, invoice_date')
      .eq('status', 'paid')
      .gte('invoice_date', `${year}-01-01`)
      .lte('invoice_date', `${year}-12-31`),
    sb.from('payslips')
      .select('grand_total, status, period_month')
      .in('status', ['finalised', 'paid'])
      .eq('period_year', year),
  ])

  const monthlyRevenue = Array(12).fill(0)
  const monthlyCost    = Array(12).fill(0)

  invoicesData?.forEach((inv: any) => {
    const m = new Date(inv.invoice_date).getMonth()
    monthlyRevenue[m] += inv.total
  })

  payslipsData?.forEach((ps: any) => {
    monthlyCost[ps.period_month - 1] += ps.grand_total
  })

  return {
    monthlyRevenue,
    monthlyCost,
    totalRevenue: monthlyRevenue.reduce((a, b) => a + b, 0),
    totalCost:    monthlyCost.reduce((a, b) => a + b, 0),
  }
}

// ── App settings ─────────────────────────────────────────────
export async function getAppSettings() {
  const sb = createClient()
  const { data, error } = await sb
    .from('app_settings')
    .select('config')
    .single()

  if (error) throw error
  return data?.config ?? {}
}

export async function updateAppSettings(config: Record<string, unknown>) {
  const sb = createClient()
  const { error } = await sb
    .from('app_settings')
    .update({ config })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) throw error
}
