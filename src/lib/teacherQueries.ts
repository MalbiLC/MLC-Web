import { createClient } from '@/lib/supabase/client'
import type { Teacher, TeacherStudentEntry } from '@/types/teachers'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getTeachers(): Promise<Teacher[]> {
  const sb = createClient()

  // Get teachers with subjects and availability
  const { data: teachers, error } = await sb
    .from('teachers')
    .select(`
      *,
      teacher_subjects ( subject:subjects ( id, name ) ),
      teacher_availability ( id, teacher_id, day_of_week, slot_start, slot_end )
    `)
    .order('full_name')

  if (error) throw error

  // Get all student_subject_sessions that have a teacher assigned
  const { data: sessions } = await sb
    .from('student_subject_sessions')
    .select(`
      id, student_id, subject_id, teacher_id, sessions_remaining, location, rate_per_session,
      student:students ( id, full_name, status ),
      subject:subjects ( id, name )
    `)
    .not('teacher_id', 'is', null)

  const sessionsByTeacher: Record<string, TeacherStudentEntry[]> = {}
  ;(sessions || []).forEach((s: any) => {
    if (!s.teacher_id) return
    if (!sessionsByTeacher[s.teacher_id]) sessionsByTeacher[s.teacher_id] = []
    sessionsByTeacher[s.teacher_id].push({
      session_id: s.id,
      student_id: s.student_id,
      subject_id: s.subject_id,
      teacher_id: s.teacher_id,
      sessions_remaining: s.sessions_remaining,
      location: s.location || 'in_person',
      rate_per_session: s.rate_per_session,
      student_name: s.student?.full_name || '',
      subject_name: s.subject?.name || '',
      student_status: s.student?.status || '',
    })
  })

  return (teachers || []).map((t: any) => ({
    ...t,
    subjects: (t.teacher_subjects || []).map((ts: any) => ts.subject),
    availability: t.teacher_availability || [],
    students: sessionsByTeacher[t.id] || [],
  }))
}

export async function createTeacher(data: {
  full_name: string
  phone_number?: string
  employment_type: string
  status: string
  rate_per_session?: number
  monthly_salary?: number
  notes?: string
  subjects: string[]
  availability: Array<{ day_of_week: number; slot_start: string; slot_end: string }>
}) {
  const sb = createClient()
  const { subjects, availability, ...teacherData } = data

  const { data: teacher, error } = await sb
    .from('teachers')
    .insert({
      ...teacherData,
      rate_per_session: teacherData.rate_per_session || null,
      monthly_salary: teacherData.monthly_salary || null,
      phone_number: teacherData.phone_number || null,
      notes: teacherData.notes || null,
    })
    .select('id').single()
  if (error) throw error

  if (subjects.length > 0) {
    const { data: subjectRows } = await sb.from('subjects').select('id, name').in('name', subjects)
    if (subjectRows?.length) {
      await sb.from('teacher_subjects').insert(
        subjectRows.map((s: any) => ({ teacher_id: teacher.id, subject_id: s.id }))
      )
    }
  }

  if (availability.length > 0) {
    await sb.from('teacher_availability').insert(
      availability.map(a => ({ ...a, teacher_id: teacher.id }))
    )
  }
}

export async function updateTeacher(id: string, data: {
  full_name: string
  phone_number?: string
  employment_type: string
  status: string
  rate_per_session?: number
  monthly_salary?: number
  notes?: string
  subjects: string[]
  availability: Array<{ day_of_week: number; slot_start: string; slot_end: string }>
}) {
  const sb = createClient()
  const { subjects, availability, ...teacherData } = data

  const { error } = await sb.from('teachers').update({
    ...teacherData,
    rate_per_session: teacherData.rate_per_session || null,
    monthly_salary: teacherData.monthly_salary || null,
    phone_number: teacherData.phone_number || null,
    notes: teacherData.notes || null,
  }).eq('id', id)
  if (error) throw error

  await sb.from('teacher_subjects').delete().eq('teacher_id', id)
  if (subjects.length > 0) {
    const { data: subjectRows } = await sb.from('subjects').select('id, name').in('name', subjects)
    if (subjectRows?.length) {
      await sb.from('teacher_subjects').insert(
        subjectRows.map((s: any) => ({ teacher_id: id, subject_id: s.id }))
      )
    }
  }

  await sb.from('teacher_availability').delete().eq('teacher_id', id)
  if (availability.length > 0) {
    await sb.from('teacher_availability').insert(
      availability.map(a => ({ ...a, teacher_id: id }))
    )
  }
}

export async function updateSessionRate(sessionId: string, rate_per_session: number | null) {
  const sb = createClient()
  const { error } = await sb
    .from('student_subject_sessions')
    .update({ rate_per_session })
    .eq('id', sessionId)
  if (error) throw error
}

export async function updateSessionLocation(sessionId: string, location: string) {
  const sb = createClient()
  const { error } = await sb
    .from('student_subject_sessions')
    .update({ location })
    .eq('id', sessionId)
  if (error) throw error
}

export async function deleteTeacher(id: string) {
  const sb = createClient()
  const { error } = await sb.from('teachers').delete().eq('id', id)
  if (error) throw error
}
