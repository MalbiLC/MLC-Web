export type UserRole        = 'owner' | 'admin'
export type EmploymentType  = 'full_time' | 'part_time'
export type StudentType     = 'current' | 'potential'
export type StudentStatus   = 'ongoing' | 'expired'
export type SessionStatus   = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
export type TeacherStatus   = 'active' | 'inactive'
export type InvoiceStatus   = 'draft' | 'sent' | 'paid'
export type PayslipStatus   = 'draft' | 'finalised' | 'paid'
export type AdjustmentType  = 'addition' | 'deduction'
export type ItemType        = 'package' | 'registration' | 'material' | 'custom'
export type RoomType        = 'physical' | 'zoom'

export interface Profile {
  id: string; full_name: string; role: UserRole; created_at: string
}

export interface Subject {
  id: string; name: string; created_at: string
}

export interface Room {
  id: string; name: string; type: RoomType
  zoom_link: string | null; is_available: boolean; created_at: string
}

export interface Student {
  id: string; full_name: string; date_of_birth: string | null
  grade: string | null; level: string | null; school: string | null
  parent_name: string | null; parent_contact: string | null
  student_type: StudentType; status: StudentStatus
  sessions_remaining: number; reached_out_at: string | null
  notes: string | null; created_at: string
  subjects?: Subject[]
}

export interface Teacher {
  id: string; full_name: string; phone_number: string | null
  employment_type: EmploymentType; status: TeacherStatus
  base_hourly_rate: number | null; monthly_salary: number | null
  notes: string | null; created_at: string
  subjects?: Subject[]; availability?: TeacherAvailability[]
}

export interface TeacherAvailability {
  id: string; teacher_id: string; day_of_week: number
  slot_start: string; slot_end: string
}

export interface TeacherStudentAssignment {
  id: string; teacher_id: string; student_id: string
  subject_id: string | null; custom_rate: number | null
  rate_note: string | null; assigned_at: string
  teacher?: Teacher; student?: Student; subject?: Subject
}

export interface Session {
  id: string; student_id: string; teacher_id: string
  room_id: string | null; subject_id: string | null
  scheduled_at: string; duration_minutes: number
  status: SessionStatus; rescheduled_to: string | null
  rescheduled_from: string | null; notes: string | null
  created_by: string | null; created_at: string
  student?: Student; teacher?: Teacher; room?: Room; subject?: Subject
}

export interface Invoice {
  id: string; invoice_number: string; student_id: string
  invoice_for: string; invoice_date: string; due_date: string | null
  bank_name: string | null; bank_account_name: string | null
  bank_account_number: string | null; notes: string | null
  tax_amount: number; subtotal: number; total: number
  status: InvoiceStatus; paid_at: string | null
  created_by: string | null; created_at: string
  student?: Student; line_items?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string; invoice_id: string; description: string
  item_type: ItemType; quantity: number; unit_price: number
  discount_pct: number; expiry_date: string | null
  total_price: number; sort_order: number
}

export interface Payslip {
  id: string; payslip_number: string; teacher_id: string
  period_month: number; period_year: number
  employment_type: EmploymentType; monthly_salary: number | null
  sessions_total: number; adjustments_total: number
  grand_total: number; status: PayslipStatus
  notes: string | null; created_by: string | null; created_at: string
  teacher?: Teacher; session_lines?: PayslipSessionLine[]
  adjustments?: PayslipAdjustment[]
}

export interface PayslipSessionLine {
  id: string; payslip_id: string; session_id: string
  student_id: string; student_name: string; subject_name: string | null
  session_date: string; duration_minutes: number
  rate_used: number; line_total: number
}

export interface PayslipAdjustment {
  id: string; payslip_id: string; label: string
  adjustment_type: AdjustmentType; amount: number; sort_order: number
}

export interface DashboardSession extends Session {
  student_name: string; teacher_name: string
  subject_name: string | null; room_name: string | null
  room_type: RoomType | null; sessions_remaining: number
}

export interface DashboardStats {
  total: number; scheduled: number; completed: number
  cancelled: number; students: number; teachers: number
}
