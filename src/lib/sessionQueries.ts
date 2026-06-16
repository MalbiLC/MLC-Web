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
  series_id: string | null
  series_index: number | null
  students: Array<{ id: string; full_name: string; sessions_remaining: number }>
}

async function fetchSessions(from: string, to: string): Promise<CalendarSession[]> {
  const sb = createClient()

  const { data, error } = await sb
    .from('sessions')
    .select(`
      id, class_name, class_type, scheduled_at, duration_minutes,
      status, notes, series_id, series_index,
      teacher:teachers ( full_name ),
      subject:subjects ( name ),
      room:rooms ( name, type ),
      session_students (
        student:students ( id, full_name, sessions_remaining )
      )
    `)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error('Session fetch error:', error)
    return []
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    class_name: s.class_name,
    class_type: s.class_type,
    subject_name: s.subject?.name || null,
    teacher_name: s.teacher?.full_name || 'Unknown',
    room_name: s.room?.name || null,
    room_type: s.room?.type || null,
    scheduled_at: s.scheduled_at,
    duration_minutes: s.duration_minutes || 60,
    status: s.status,
    notes: s.notes,
    series_id: s.series_id || null,
    series_index: s.series_index || null,
    students: (s.session_students || [])
      .map((ss: any) => ss.student)
      .filter(Boolean),
  }))
}

export async function getSessionsForWeek(startDate: Date, endDate: Date): Promise<CalendarSession[]> {
  const from = startDate.toISOString()
  const to   = endDate.toISOString()
  return fetchSessions(from, to)
}

export async function getSessionsForDay(date: Date): Promise<CalendarSession[]> {
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end   = new Date(date); end.setHours(23, 59, 59, 999)
  return fetchSessions(start.toISOString(), end.toISOString())
}

export async function getAllSessions(monthsBack = 1, monthsAhead = 6): Promise<CalendarSession[]> {
  const from = new Date()
  from.setMonth(from.getMonth() - monthsBack)
  from.setHours(0, 0, 0, 0)

  const to = new Date()
  to.setMonth(to.getMonth() + monthsAhead)
  to.setHours(23, 59, 59, 999)

  return fetchSessions(from.toISOString(), to.toISOString())
}

export async function updateSessionStatus(id: string, status: string) {
  const sb = createClient()
  const { error } = await sb.from('sessions').update({ status }).eq('id', id)
  if (error) throw error
}

// Generate .ics file content for export
export function generateICS(sessions: CalendarSession[]): string {
  const escape = (s: string) => s.replace(/[,;\\]/g, c => `\\${c}`).replace(/\n/g, '\\n')
  const toICSDate = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const events = sessions
    .filter(s => s.status !== 'cancelled')
    .map(s => {
      const start = toICSDate(s.scheduled_at)
      const endMs = new Date(s.scheduled_at).getTime() + s.duration_minutes * 60000
      const end   = toICSDate(new Date(endMs).toISOString())
      const title = [s.class_name, s.subject_name, s.class_type?.replace(/_/g, ' ')]
        .filter(Boolean).join(' — ')
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
