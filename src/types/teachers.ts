export type EmploymentType = 'full_time' | 'part_time'
export type TeacherStatus = 'active' | 'inactive'

export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as const
export type DayName = typeof DAYS[number]

export interface AvailabilitySlot {
  id?: string
  teacher_id?: string
  day_of_week: number // 0=Sun, 6=Sat
  slot_start: string  // HH:MM
  slot_end: string    // HH:MM
}

export interface TeacherStudentAssignment {
  id: string
  teacher_id: string
  student_id: string
  subject_id: string | null
  rate_per_session: number | null
  custom_rate: number | null
  rate_note: string | null
  assigned_at: string
  student?: {
    id: string
    full_name: string
    status: string
    subject_sessions?: Array<{
      subject_id: string
      sessions_remaining: number
      subject?: { id: string; name: string }
    }>
  }
  subject?: { id: string; name: string }
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
  assignments?: TeacherStudentAssignment[]
}
