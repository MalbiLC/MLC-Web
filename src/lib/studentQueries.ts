import type { AvailabilitySlot } from '@/types/teachers'
import { createClient } from '@/lib/supabase/client'
import type { Student, StudentStatus, TrialSubjectTeacher } from '@/types/students'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getStudents(type: 'potential' | 'current'): Promise<Student[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('students')
    .select(`
      *,
      trial_teacher:teachers!trial_teacher_id ( id, full_name ),
      availability:student_availability ( id, student_id, day_of_week, slot_start, slot_end ),
      subject_sessions:student_subject_sessions (
        id, student_id, subject_id, teacher_id, sessions_remaining, created_at,
        subject:subjects ( id, name ),
        teacher:teachers ( id, full_name )
      )
    `)
    .eq('student_type', type)
    .order('full_name')
  if (error) throw error
  return (data || []).map((s: any) => ({
    ...s,
    trial_teacher: s.trial_teacher || null,
    trial_subject_teachers: s.trial_subject_teachers || [],
    availability: s.availability || [],
    subject_sessions: s.subject_sessions || [],
  }))
}

export async function createPotentialStudent(data: {
  full_name: string
  parent_name: string
  parent_contact: string
  reached_out_at: string
  interested_subjects: string
  trial_subject_teachers: TrialSubjectTeacher[]
  potential_notes?: string
  availability?: AvailabilitySlot[]
}) {
  const sb = createClient()
  const { error } = await sb.from('students').insert({
    ...data,
    student_type: 'potential',
    status: 'potential_no_trial',
  })
  if (error) throw error

  // Save availability
  if (data.availability && data.availability.length > 0) {
    const { data: student } = await sb.from('students').select('id').eq('full_name', data.full_name).order('created_at', { ascending: false }).limit(1).single()
    if (student) {
      await sb.from('student_availability').insert(
        data.availability.map((a: AvailabilitySlot) => ({ ...a, student_id: student.id }))
      )
    }
  }
}

export async function updatePotentialStudent(id: string, data: {
  full_name: string
  parent_name: string
  parent_contact: string
  reached_out_at: string
  interested_subjects: string
  trial_subject_teachers: TrialSubjectTeacher[]
  potential_notes?: string
  availability?: AvailabilitySlot[]
}) {
  const sb = createClient()
  const { error } = await sb.from('students').update(data).eq('id', id)
  if (error) throw error
}

export async function createRecurringStudent(data: {
  full_name: string
  date_of_birth?: string
  parent_name: string
  parent_contact: string
  package: string
  additional_notes?: string
  subjects: Array<{ subject_id: string; sessions: number; location?: string }>
  availability?: AvailabilitySlot[]
}) {
  const sb = createClient()
  const { subjects, availability, ...studentData } = data
  const { data: student, error } = await sb
    .from('students')
    .insert({ ...studentData, student_type: 'current', status: 'ongoing' })
    .select('id').single()
  if (error) throw error
  if (subjects.length > 0) {
    const { error: subErr } = await sb.from('student_subject_sessions').insert(
      subjects.map(s => ({
        student_id: student.id,
        subject_id: s.subject_id,
        sessions_remaining: s.sessions,
        location: s.location || 'in_person',
      }))
    )
    if (subErr) throw subErr
  }
  if (availability && availability.length > 0) {
    await sb.from('student_availability').insert(availability.map((a: AvailabilitySlot) => ({ ...a, student_id: student.id })))
  }
}

export async function updateRecurringStudent(id: string, data: {
  full_name: string
  date_of_birth?: string
  parent_name: string
  parent_contact: string
  package: string
  additional_notes?: string
  subjects: Array<{ id?: string; subject_id: string; teacher_id?: string; sessions: number; location?: string }>
  availability?: AvailabilitySlot[]
}) {
  const sb = createClient()
  const { subjects, availability, ...studentData } = data
  const { error } = await sb.from('students').update(studentData).eq('id', id)
  if (error) throw error

  // Delete existing subject sessions and re-insert
  await sb.from('student_subject_sessions').delete().eq('student_id', id)
  if (subjects.length > 0) {
    const { error: subErr } = await sb.from('student_subject_sessions').insert(
      subjects.map(s => ({
        student_id: id,
        subject_id: s.subject_id,
        sessions_remaining: s.sessions,
        location: s.location || 'in_person',
      }))
    )
    if (subErr) throw subErr
  }
  if (availability) {
    await sb.from('student_availability').delete().eq('student_id', id)
    if (availability.length > 0) {
      await sb.from('student_availability').insert(availability.map((a: AvailabilitySlot) => ({ ...a, student_id: id })))
    }
  }
}

export async function enrollStudent(id: string, data: {
  full_name: string
  date_of_birth?: string
  parent_name: string
  parent_contact: string
  package: string
  additional_notes?: string
  subjects: Array<{ subject_id: string; sessions: number; location?: string }>
  availability?: AvailabilitySlot[]
}) {
  const sb = createClient()
  const { subjects, availability, ...studentData } = data
  const { error } = await sb.from('students').update({
    ...studentData,
    student_type: 'current',
    status: 'ongoing',
    enrolled_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  if (subjects.length > 0) {
    const { error: subErr } = await sb.from('student_subject_sessions').insert(
      subjects.map(s => ({
        student_id: id,
        subject_id: s.subject_id,
        sessions_remaining: s.sessions,
        location: s.location || 'in_person',
      }))
    )
    if (subErr) throw subErr
  }
}

export async function updateStudentStatus(id: string, status: StudentStatus) {
  const sb = createClient()
  const { error } = await sb.from('students').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteStudent(id: string) {
  const sb = createClient()
  const { error } = await sb.from('students').delete().eq('id', id)
  if (error) throw error
}
