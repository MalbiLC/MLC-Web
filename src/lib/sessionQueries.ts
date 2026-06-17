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

  // ── Query 1: sessions ────────────────────────────────────────
  const { data: rows, error } = await sb
    .from('sessions')
    .select(`
      id, class_name, class_type, scheduled_at, duration_minutes,
      status, notes, series_id, series_index, subject_id,
      teachers ( full_name ),
      subjects ( name ),
      rooms    ( name, type )
    `)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error('[sessions] fetch error:', JSON.stringify(error))
    return []
  }
  if (!rows || rows.length === 0) {
    console.log('[sessions] 0 rows for range', from, '→', to)
    return []
  }

  console.log('[sessions] fetched', rows.length, 'rows')

  // ── Query 2: session_students (only id + name, no sessions_remaining) ──
  const ids = rows.map((r: any) => r.id)

  const { data: links, error: linkErr } = await sb
    .from('session_students')
    .select('session_id, students ( id, full_name )')
    .in('session_id', ids)

  if (linkErr) console.error('[session_students] error:', JSON.stringify(linkErr))

  // Build map
  const studentMap: Record<string, Array<{ id: string; full_name: string; sessions_remaining: number }>> = {}
  for (const link of (links || []) as any[]) {
    if (!link.students) continue
    if (!studentMap[link.session_id]) studentMap[link.session_id] = []
    studentMap[link.session_id].push({
      id:                 link.students.id,
      full_name:          link.students.full_name,
      sessions_remaining: 0, // fetched separately if needed
    })
  }

  return rows.map((s: any) => ({
    id:               s.id,
    class_name:       s.class_name   ?? null,
    class_type:       s.class_type   ?? null,
    subject_name:     s.subjects?.name      ?? null,
    teacher_name:     s.teachers?.full_name ?? 'Unknown',
    room_name:        s.rooms?.name   ?? null,
    room_type:        s.rooms?.type   ?? null,
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes ?? 60,
    status:           s.status,
    notes:            s.notes         ?? null,
    series_id:        s.series_id     ?? null,
    series_index:     s.series_index  ?? null,
    students:         studentMap[s.id] ?? [],
  }))
}

export async function getSessionsForWeek(startDate: Date, endDate: Date): Promise<CalendarSession[]> {
  return fetchSessions(startDate.toISOString(), endDate.toISOString())
}

export async function getSessionsForDay(date: Date): Promise<CalendarSession[]> {
  const start = new Date(date); start.setHours(0,  0,  0,   0)
  const end   = new Date(date); end.setHours(  23, 59, 59, 999)
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

export function generateICS(sessions: CalendarSession[]): string {
  const esc   = (s: string) => s.replace(/[,;\\]/g, c => `\\${c}`).replace(/\n/g, '\\n')
  const toICS = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const events = sessions
    .filter(s => s.status !== 'cancelled')
    .map(s => {
      const title = [s.class_name, s.subject_name, s.class_type?.replace(/_/g, ' ')]
        .filter(Boolean).join(' — ')
      const endT = new Date(new Date(s.scheduled_at).getTime() + s.duration_minutes * 60_000).toISOString()
      const desc = [
        `Teacher: ${s.teacher_name}`,
        s.students.length ? `Students: ${s.students.map(x => x.full_name).join(', ')}` : '',
        s.room_name ? `Room: ${s.room_name}` : '',
        s.notes ?? '',
      ].filter(Boolean).join('\\n')
      return [
        'BEGIN:VEVENT',
        `UID:mlc-${s.id}`,
        `DTSTART:${toICS(s.scheduled_at)}`,
        `DTEND:${toICS(endT)}`,
        `SUMMARY:${esc(title || 'Session')}`,
        `DESCRIPTION:${esc(desc)}`,
        `STATUS:${s.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT',
      ].join('\r\n')
    })

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//MLC//Malbi Learning Center//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...events, 'END:VCALENDAR',
  ].join('\r\n')
}
