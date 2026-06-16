'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSessionsForWeek, generateICS, updateSessionStatus } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Download, X, Check, RotateCcw, MapPin, Monitor, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const CLASS_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  group:          { bg: '#E6F4F2', text: '#0F7B6C', border: '#0F7B6C' },
  semi_private:   { bg: '#E8F0FA', text: '#1A5FA8', border: '#1A5FA8' },
  private:        { bg: '#FEF3DC', text: '#B45309', border: '#E8A020' },
  private_online: { bg: '#F0F0FE', text: '#4338CA', border: '#6366F1' },
}

const CLASS_TYPE_LABELS: Record<string, string> = {
  group: 'Group', semi_private: 'Semi-Private', private: 'Private', private_online: 'Online'
}

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7am – 10pm
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function SessionBlock({ session, onClick }: { session: CalendarSession; onClick: () => void }) {
  const start = new Date(session.scheduled_at)
  const startMin = start.getHours() * 60 + start.getMinutes()
  const top    = ((startMin - 7 * 60) / 60) * 64 // 64px per hour
  const height = (session.duration_minutes / 60) * 64
  const colors = CLASS_TYPE_COLORS[session.class_type || 'private'] || CLASS_TYPE_COLORS.private

  return (
    <div
      onClick={onClick}
      className="absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
      style={{ top: `${top}px`, height: `${Math.max(height - 2, 20)}px`, backgroundColor: colors.bg, borderLeft: `3px solid ${colors.border}` }}>
      <p className="text-xs font-semibold truncate leading-tight" style={{ color: colors.text }}>
        {session.class_name || session.subject_name || 'Session'}
      </p>
      <p className="text-xs truncate leading-tight" style={{ color: colors.text, opacity: 0.75 }}>
        {formatTime(session.scheduled_at)} · {session.teacher_name}
      </p>
      {session.students.length > 1 && (
        <p className="text-xs truncate leading-tight" style={{ color: colors.text, opacity: 0.6 }}>
          {session.students.length} students
        </p>
      )}
    </div>
  )
}

function SessionDetailPanel({ session, onClose, onStatusChange }: {
  session: CalendarSession; onClose: () => void; onStatusChange: () => void
}) {
  const [updating, setUpdating] = useState(false)
  const colors = CLASS_TYPE_COLORS[session.class_type || 'private'] || CLASS_TYPE_COLORS.private
  const start = new Date(session.scheduled_at)
  const end   = new Date(start.getTime() + session.duration_minutes * 60000)

  const changeStatus = async (status: string) => {
    setUpdating(true)
    try { await updateSessionStatus(session.id, status); onStatusChange() }
    finally { setUpdating(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.bg, color: colors.text }}>
                {CLASS_TYPE_LABELS[session.class_type || 'private']}
              </span>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                session.status === 'completed' ? 'bg-teal-50 text-teal-700' :
                session.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
              )}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              {session.class_name || session.subject_name || 'Session'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Time */}
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-gray-600">{start.getDate()}</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{DAY_FULL[start.getDay()]}, {start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="text-gray-400 text-xs">{formatTime(session.scheduled_at)} – {end.toTimeString().slice(0, 5)} · {session.duration_minutes} min</p>
            </div>
          </div>

          {/* Subject */}
          {session.subject_name && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="badge bg-gray-100 text-gray-600">{session.subject_name}</span>
            </div>
          )}

          {/* Teacher */}
          <div className="text-sm">
            <p className="text-xs text-gray-400 mb-0.5">Teacher</p>
            <p className="text-gray-700 font-medium">{session.teacher_name}</p>
          </div>

          {/* Room */}
          {session.room_name && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              {session.room_type === 'zoom' ? <Monitor size={14} className="text-gray-400" /> : <MapPin size={14} className="text-gray-400" />}
              <span>{session.room_name}</span>
            </div>
          )}

          {/* Students */}
          {session.students.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1"><Users size={12} /> Students ({session.students.length})</p>
              <div className="space-y-1">
                {session.students.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{s.full_name}</p>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                      s.sessions_remaining === 0 ? 'bg-red-50 text-red-600' :
                      s.sessions_remaining <= 2 ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-700'
                    )}>{s.sessions_remaining} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.notes && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Notes</p>
              <p className="text-sm text-gray-600">{session.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {session.status === 'scheduled' && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
            <button onClick={() => changeStatus('completed')} disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg text-white transition-colors"
              style={{ backgroundColor: 'var(--mlc-teal)' }}>
              <Check size={14} /> Mark completed
            </button>
            <button onClick={() => changeStatus('rescheduled')} disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 transition-colors hover:bg-amber-100">
              <RotateCcw size={14} /> Reschedule
            </button>
          </div>
        )}
        {session.status === 'completed' && (
          <div className="px-6 py-4 border-t border-gray-100">
            <button onClick={() => changeStatus('scheduled')} disabled={updating}
              className="w-full py-2 text-sm font-medium rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors">
              Undo completion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<CalendarSession | null>(null)
  const today = new Date()

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd  = addDays(weekStart, 6)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSessionsForWeek(weekStart, addDays(weekEnd, 1))
      setSessions(data)
    } finally { setLoading(false) }
  }, [weekStart])

  useEffect(() => {
    load()

    // Realtime subscription — refresh when any session changes
    const sb = createClient()
    const channel = sb
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .subscribe()

    // Also refresh on window focus (catches changes from other tabs)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)

    return () => {
      sb.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const sessionsForDay = (day: Date) =>
    sessions.filter(s => sameDay(new Date(s.scheduled_at), day))

  const exportICS = () => {
    const content = generateICS(sessions)
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `mlc-schedule-${weekStart.toISOString().split('T')[0]}.ics`
    a.click(); URL.revokeObjectURL(url)
  }

  const monthLabel = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="page-header shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekStart(w => addDays(w, -7))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              Today
            </button>
            <button onClick={() => setWeekStart(w => addDays(w, 7))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronRight size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700 ml-1">{monthLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 mr-2">
            {Object.entries(CLASS_TYPE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CLASS_TYPE_COLORS[key].border }} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
          <button onClick={exportICS} className="btn-secondary text-xs py-1.5 px-3">
            <Download size={13} /> Export .ics
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-100 bg-white shrink-0">
          <div className="border-r border-gray-100 px-2 py-2 text-xs text-gray-400">GMT+07</div>
          {weekDays.map(day => {
            const isToday = sameDay(day, today)
            return (
              <div key={day.toISOString()} className="border-r border-gray-100 px-2 py-2 text-center">
                <p className="text-xs text-gray-400">{DAY_NAMES[day.getDay()]}</p>
                <div className={cn(
                  'w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-semibold mt-0.5',
                  isToday ? 'text-white' : 'text-gray-700'
                )} style={isToday ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                  {day.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[64px_repeat(7,1fr)]" style={{ minHeight: `${HOURS.length * 64}px` }}>
            {/* Time labels */}
            <div className="border-r border-gray-100">
              {HOURS.map(h => (
                <div key={h} className="h-16 border-b border-gray-50 px-2 flex items-start pt-1">
                  <span className="text-xs text-gray-400">{h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const daySessions = sessionsForDay(day)
              const isToday = sameDay(day, today)
              const nowMin = isToday ? today.getHours() * 60 + today.getMinutes() : null
              const nowTop = nowMin !== null ? ((nowMin - 7 * 60) / 60) * 64 : null

              return (
                <div key={day.toISOString()} className={cn('border-r border-gray-100 relative', isToday && 'bg-teal-50/20')}>
                  {/* Hour lines */}
                  {HOURS.map(h => (
                    <div key={h} className="h-16 border-b border-gray-50" />
                  ))}

                  {/* Current time indicator */}
                  {nowTop !== null && nowTop >= 0 && (
                    <div className="absolute left-0 right-0 flex items-center z-20" style={{ top: `${nowTop}px` }}>
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                      <div className="flex-1 h-px bg-red-500" />
                    </div>
                  )}

                  {/* Session blocks */}
                  {loading ? null : daySessions.map(s => (
                    <SessionBlock key={s.id} session={s} onClick={() => setSelectedSession(s)} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Session detail panel */}
      {selectedSession && (
        <SessionDetailPanel
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onStatusChange={() => { setSelectedSession(null); load() }}
        />
      )}
    </div>
  )
}
