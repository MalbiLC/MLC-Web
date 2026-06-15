// Student status types
export type PotentialStatus = 'potential_no_trial' | 'potential_trial_done'
export type RecurringStatus = 'ongoing' | 'low_session' | 'expired'
export type StudentStatus = PotentialStatus | RecurringStatus
export type StudentType = 'potential' | 'current'
export type PackageType = 'private' | 'semi_private' | 'online'

export interface SubjectSession {
  id: string
  student_id: string
  subject_id: string
  teacher_id: string | null
  sessions_remaining: number
  created_at: string
  subject?: { id: string; name: string }
  teacher?: { id: string; full_name: string }
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
  additional_notes: string | null
  created_at: string
  subject_sessions?: SubjectSession[]
}
