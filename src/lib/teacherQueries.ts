import { createClient } from '@/lib/supabase/client'
import type { Teacher } from '@/types/teachers'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getTeachers(): Promise<Teacher[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('teachers')
    .select(`
      *,
      teacher_subjects ( subject:subjects ( id, name ) ),
      teacher_availability ( id, teacher_id, day_of_week, slot_start, slot_end ),
      assignments:teacher_student_assignments (
        id, teacher_id, student_id, subject_id, rate_per_session, custom_rate, rate_note, assigned_at,
        student:students (
          id, full_name, status,
          subject_sessions:student_subject_sessions (
            subject_id, sessions_remaining,
            subject:subjects ( id, name )
          )
        ),
        subject:subjects ( id, name )
      )
    `)
    .order('full_name')

  if (error) throw error
  return (data || []).map((t: any) => ({
    ...t,
    subjects: (t.teacher_subjects || []).map((ts: any) => ts.subject),
    availability: t.teacher_availability || [],
    assignments: t.assignments || [],
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

  // Insert subject links
  if (subjects.length > 0) {
    const { data: subjectRows } = await sb.from('subjects').select('id, name').in('name', subjects)
    if (subjectRows && subjectRows.length > 0) {
      await sb.from('teacher_subjects').insert(
        subjectRows.map((s: any) => ({ teacher_id: teacher.id, subject_id: s.id }))
      )
    }
  }

  // Insert availability
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

  // Replace subjects
  await sb.from('teacher_subjects').delete().eq('teacher_id', id)
  if (subjects.length > 0) {
    const { data: subjectRows } = await sb.from('subjects').select('id, name').in('name', subjects)
    if (subjectRows && subjectRows.length > 0) {
      await sb.from('teacher_subjects').insert(
        subjectRows.map((s: any) => ({ teacher_id: id, subject_id: s.id }))
      )
    }
  }

  // Replace availability
  await sb.from('teacher_availability').delete().eq('teacher_id', id)
  if (availability.length > 0) {
    await sb.from('teacher_availability').insert(
      availability.map(a => ({ ...a, teacher_id: id }))
    )
  }
}

export async function updateStudentRate(assignmentId: string, rate_per_session: number | null) {
  const sb = createClient()
  const { error } = await sb
    .from('teacher_student_assignments')
    .update({ rate_per_session })
    .eq('id', assignmentId)
  if (error) throw error
}

export async function deleteTeacher(id: string) {
  const sb = createClient()
  const { error } = await sb.from('teachers').delete().eq('id', id)
  if (error) throw error
}
