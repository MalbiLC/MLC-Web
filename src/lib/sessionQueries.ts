import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CalendarSession {
  id: string
  class_name: string | null
  class_type: string | null
  subject_name: string | null
  teacher_name: string
  room_name: string | null
  room_type: string | null
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  students: Array<{ id: string; full_name: string; sessions_remaining: number }>
}

export async function getSessionsForWeek(startDate: Date, endDate: Date): Promise<CalendarSession[]> {
  const sb = createClient()
  const from = startDate.toISOString()
  const to   = endDate.toISOString()

  const { data, error } = await sb
    .from('sessions')
    .select(`
      id, class_name, class_type, scheduled_at, duration_minutes, status, notes,
      teacher:teachers ( full_name ),
      subject:subjects ( name ),
      room:rooms ( name, type ),
      session_students (
        student:students ( id, full_name, sessions_remaining )
      )
    `)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })

  if (error) throw error

  return (data || []).map((s: any) => ({
    id: s.id,
    class_name: s.class_name,
    class_type: s.class_type,
    subject_name: s.subject?.name || null,
    teacher_name: s.teacher?.full_name || '',
    room_name: s.room?.name || null,
    room_type: s.room?.type || null,
    scheduled_at: s.scheduled_at,
    duration_minutes: s.duration_minutes,
    status: s.status,
    notes: s.notes,
    students: (s.session_students || [])
      .map((ss: any) => ss.student)
      .filter(Boolean),
  }))
}

export async function getSessionsForDay(date: Date): Promise<CalendarSession[]> {
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end   = new Date(date); end.setHours(23, 59, 59, 999)
  return getSessionsForWeek(start, end)
}

export async function updateSessionStatus(id: string, status: string) {
  const sb = createClient()
  const { error } = await sb.from('sessions').update({ status }).eq('id', id)
  if (error) throw error
}

// Generate .ics file content for export
export function generateICS(sessions: CalendarSession[]): string {
  const escape = (s: string) => s.replace(/[,;\\]/g, c => `\\${c}`).replace(/\n/g, '\\n')
  const toICSDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const events = sessions.map(s => {
    const start = toICSDate(s.scheduled_at)
    const endMs = new Date(s.scheduled_at).getTime() + s.duration_minutes * 60000
    const end   = toICSDate(new Date(endMs).toISOString())
    const title = [s.class_name, s.subject_name, s.class_type?.replace('_', ' ')].filter(Boolean).join(' — ')
    const studentList = s.students.map(st => st.full_name).join(', ')
    const desc = [
      `Teacher: ${s.teacher_name}`,
      studentList ? `Students: ${studentList}` : '',
      s.room_name ? `Room: ${s.room_name}` : '',
      s.notes || '',
    ].filter(Boolean).join('\\n')

    return [
      'BEGIN:VEVENT',
      `UID:mlc-${s.id}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escape(title || 'Session')}`,
      `DESCRIPTION:${escape(desc)}`,
      `STATUS:${s.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
      'END:VEVENT',
    ].join('\r\n')
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MLC//Malbi Learning Center//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}
