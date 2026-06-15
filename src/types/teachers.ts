export type EmploymentType = 'full_time' | 'part_time'
export type TeacherStatus = 'active' | 'inactive'
export type LocationType = 'in_person' | 'online'

export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as const
export type DayName = typeof DAYS[number]

export interface AvailabilitySlot {
  id?: string
  teacher_id?: string
  day_of_week: number
  slot_start: string
  slot_end: string
}

// Student as seen from teacher's perspective
export interface TeacherStudentEntry {
  session_id: string        // student_subject_sessions.id
  student_id: string
  subject_id: string
  teacher_id: string
  sessions_remaining: number
  location: LocationType
  rate_per_session: number | null
  student_name: string
  subject_name: string
  student_status: string
}

export interface Teacher {
  id: string
  full_name: string
  phone_number: string | null
  employment_type: EmploymentType
  status: TeacherStatus
  base_hourly_rate: number | null
  monthly_salary: number | null
  rate_per_session: number | null
  notes: string | null
  created_at: string
  subjects?: { id: string; name: string }[]
  availability?: AvailabilitySlot[]
  students?: TeacherStudentEntry[]
}
