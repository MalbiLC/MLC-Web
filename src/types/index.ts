export type UserRole = 'owner' | 'admin'
export type EmploymentType = 'full_time' | 'part_time'
export type StudentType = 'current' | 'potential'
export type StudentStatus = 'ongoing' | 'expired'
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
export type TeacherStatus = 'active' | 'inactive'
export type InvoiceStatus = 'draft' | 'sent' | 'paid'
export type PayslipStatus = 'draft' | 'finalised' | 'paid'
export type AdjustmentType = 'addition' | 'deduction'
export type ItemType = 'package' | 'registration' | 'material' | 'custom'
export type RoomType = 'physical' | 'zoom'

export interface Profile {
  id: string; full_name: string; role: UserRole; created_at: string
}
export interface Subject {
  id: string; name: string; created_at: string
}
export interface Room {
  id: string; name: string; type: RoomType; zoom_link: string | null; is_available: boolean
}
export interface Student {
  id: string; full_name: string; date_of_birth: string | null; grade: string | null
  level: string | null; school: string | null; parent_name: string | null
  parent_contact: string | null; student_type: StudentType; status: StudentStatus
  sessions_remaining: number; reached_out_at: string | null; notes: string | null
  created_at: string; subjects?: Subject[]
}
export interface Teacher {
  id: string; full_name: string; phone_number: string | null
  employment_type: EmploymentType; status: TeacherStatus
  base_hourly_rate: number | null; monthly_salary: number | null
  notes: string | null; created_at: string; subjects?: Subject[]
}
export interface Session {
  id: string; student_id: string; teacher_id: string; room_id: string | null
  subject_id: string | null; scheduled_at: string; duration_minutes: number
  status: SessionStatus; rescheduled_to: string | null; rescheduled_from: string | null
  notes: string | null; created_at: string
}
export interface DashboardSession extends Session {
  student_name: string; teacher_name: string; subject_name: string | null
  room_name: string | null; room_type: RoomType | null; sessions_remaining: number
}
export interface DashboardStats {
  total: number; scheduled: number; completed: number; cancelled: number
  students: number; teachers: number
}
