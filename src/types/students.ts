export type PotentialStatus = 'potential_no_trial' | 'potential_trial_done'
export type RecurringStatus = 'ongoing' | 'low_session' | 'expired'
export type StudentStatus = PotentialStatus | RecurringStatus
export type StudentType = 'potential' | 'current'
export type PackageType = 'private' | 'semi_private' | 'online'

export const SUBJECTS = ['Math', 'Science', 'English', 'Mandarin'] as const
export type SubjectName = typeof SUBJECTS[number]

export interface SubjectSession {
  id: string
  student_id: string
  subject_id: string
  teacher_id: string | null
  sessions_remaining: number
  location: string
  created_at: string
  subject?: { id: string; name: string }
  teacher?: { id: string; full_name: string }
}

export interface TrialSubjectTeacher {
  subject: string
  teacher_id: string
  teacher_name?: string
}

export interface Student {
  id: string
  full_name: string
  date_of_birth: string | null
  grade: string | null
  level: string | null
  school: string | null
  parent_name: string | null
  parent_contact: string | null
  student_type: StudentType
  status: StudentStatus
  package: PackageType | null
  reached_out_at: string | null
  trial_done_at: string | null
  followup_date: string | null
  interested_subjects: string | null
  trial_teacher_id: string | null
  trial_subject_teachers: TrialSubjectTeacher[]
  potential_notes: string | null
  additional_notes: string | null
  enrolled_at: string | null
  created_at: string
  availability?: StudentAvailabilitySlot[]
  subject_sessions?: SubjectSession[]
  trial_teacher?: { id: string; full_name: string }
}

export interface StudentAvailabilitySlot {
  id?: string
  student_id?: string
  day_of_week: number
  slot_start: string
  slot_end: string
}
