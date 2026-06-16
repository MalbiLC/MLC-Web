'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSessionsForDay, updateSessionStatus } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime, formatDuration } from '@/lib/utils'
import { Users, GraduationCap, CalendarCheck, MapPin, Monitor, Check, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLASS_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  group:          { bg: '#E6F4F2', border: '#0F7B6C', text: '#0F7B6C' },
  semi_private:   { bg: '#E8F0FA', border: '#1A5FA8', text: '#1A5FA8' },
  private:        { bg: '#FEF3DC', border: '#E8A020', text: '#B45309' },
  private_online: { bg: '#F0F0FE', border: '#6366F1', text: '#4338CA' },
}

const CLASS_TYPE_LABELS: Record<string, string> = {
  group: 'Group', semi_private: 'Semi-Private', private: 'Private', private_online: 'Online'
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8am – 9pm

function DayTimeGrid({ sessions, onSessionClick }: {
  sessions: CalendarSession[]
  onSessionClick: (s: CalendarSession) => void
}) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowTop = ((nowMin - 8 * 60) / 60) * 56

  return (
    <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-white">
      {/* Time labels */}
      <div className="w-14 shrink-0 border-r border-gray-100">
        {HOURS.map(h => (
          <div key={h} className="h-14 border-b border-gray-50 px-2 flex items-start pt-1">
            <span className="text-xs text-gray-400">{h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}</span>
          </div>
        ))}
      </div>

      {/* Sessions column */}
      <div className="flex-1 relative">
        {HOURS.map(h => <div key={h} className="h-14 border-b border-gray-50" />)}

        {/* Current time */}
        {nowTop >= 0 && nowTop < HOURS.length * 56 && (
          <div className="absolute left-0 right-0 flex items-center z-20" style={{ top: `${nowTop}px` }}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
            <div className="flex-1 h-px bg-red-500" />
          </div>
        )}

        {/* Session blocks */}
        {sessions.map(s => {
          const start = new Date(s.scheduled_at)
          const startMin = start.getHours() * 60 + start.getMinutes()
          const top    = ((startMin - 8 * 60) / 60) * 56
          const height = (s.duration_minutes / 60) * 56
          const colors = CLASS_TYPE_COLORS[s.class_type || 'private'] || CLASS_TYPE_COLORS.private

          return (
            <div key={s.id}
              onClick={() => onSessionClick(s)}
              className="absolute left-1 right-2 rounded-lg px-2 py-1.5 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
              style={{ top: `${top}px`, height: `${Math.max(height - 2, 22)}px`, backgroundColor: colors.bg, borderLeft: `3px solid ${colors.border}` }}>
              <p className="text-xs font-semibold truncate" style={{ color: colors.text }}>
                {s.class_name || s.subject_name || 'Session'}
              </p>
              <p className="text-xs truncate" style={{ color: colors.text, opacity: 0.75 }}>
                {formatTime(s.scheduled_at)} · {s.teacher_name}
                {s.students.length > 0 && ` · ${s.students.map(st => st.full_name.split(' ')[0]).join(', ')}`}
              </p>
            </div>
          )
        })}
      </div>
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
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.bg, color: colors.text }}>
                {CLASS_TYPE_LABELS[session.class_type || 'private']}
              </span>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                session.status === 'completed' ? 'bg-teal-50 text-teal-700' :
                session.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
              )}>{session.status.charAt(0).toUpperCase() + session.status.slice(1)}</span>
            </div>
            <h2 className="text-base font-semibold">{session.class_name || session.subject_name || 'Session'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="text-sm text-gray-500">
            {formatTime(session.scheduled_at)} – {end.toTimeString().slice(0, 5)} · {session.duration_minutes} min
          </div>
          {session.subject_name && <span className="badge bg-gray-100 text-gray-600">{session.subject_name}</span>}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Teacher</p>
            <p className="text-sm font-medium text-gray-700">{session.teacher_name}</p>
          </div>
          {session.room_name && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              {session.room_type === 'zoom' ? <Monitor size={14} className="text-gray-400" /> : <MapPin size={14} className="text-gray-400" />}
              {session.room_name}
            </div>
          )}
          {session.students.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Students ({session.students.length})</p>
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
          {session.notes && <p className="text-sm text-gray-500">{session.notes}</p>}
        </div>
        {session.status === 'scheduled' && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
            <button onClick={() => changeStatus('completed')} disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg text-white"
              style={{ backgroundColor: 'var(--mlc-teal)' }}>
              <Check size={14} /> Mark completed
            </button>
            <button onClick={() => changeStatus('rescheduled')} disabled={updating}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
              <RotateCcw size={14} /> Reschedule
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  useAuth()
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<CalendarSession | null>(null)
  const [viewDate, setViewDate] = useState(new Date())

  const today = new Date()
  const isToday = viewDate.toDateString() === today.toDateString()

  const load = useCallback(async () => {
    setLoading(true)
    try { setSessions(await getSessionsForDay(viewDate)) }
    finally { setLoading(false) }
  }, [viewDate])

  useEffect(() => {
    load()

    // Realtime — refresh when sessions change
    const sb = createClient()
    const channel = sb
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .subscribe()

    const onFocus = () => load()
    window.addEventListener('focus', onFocus)

    return () => {
      sb.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const scheduled  = sessions.filter(s => s.status === 'scheduled').length
  const completed  = sessions.filter(s => s.status === 'completed').length
  const studentIds = new Set(sessions.flatMap(s => s.students.map(st => st.id)))
  const teacherIds = new Set(sessions.map(s => s.teacher_name))

  const hour = new Date().getHours()
  const greeting = isToday ? (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') : ''

  const dateLabel = isToday
    ? today.toLocaleDateString('en-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : viewDate.toLocaleDateString('en-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{dateLabel}</p>
          <h1 className="text-2xl font-semibold">{greeting || (isToday ? 'Today' : 'Schedule')}</h1>
        </div>
        {/* Date navigator */}
        <div className="flex items-center gap-1">
          <button onClick={() => setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </button>
          {!isToday && (
            <button onClick={() => setViewDate(new Date())}
              className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              Today
            </button>
          )}
          <button onClick={() => setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="page-content space-y-5 flex-1">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><CalendarCheck size={13} /> Sessions</div>
            <p className="text-2xl font-semibold">{sessions.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">{scheduled} upcoming · {completed} done</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Users size={13} /> Students</div>
            <p className="text-2xl font-semibold">{studentIds.size}</p>
            <p className="text-xs text-gray-400 mt-0.5">Across all sessions</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><GraduationCap size={13} /> Teachers</div>
            <p className="text-2xl font-semibold">{teacherIds.size}</p>
            <p className="text-xs text-gray-400 mt-0.5">Teaching today</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><CalendarCheck size={13} /> Progress</div>
            <p className="text-2xl font-semibold">
              {sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{completed} of {sessions.length} done</p>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="card text-center py-16 text-gray-400 text-sm">
            No sessions scheduled for this day.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Day time grid */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Day view</p>
              <DayTimeGrid sessions={sessions} onSessionClick={setSelectedSession} />
            </div>

            {/* Session list */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Sessions</p>
              <div className="space-y-2">
                {sessions.map(s => {
                  const colors = CLASS_TYPE_COLORS[s.class_type || 'private'] || CLASS_TYPE_COLORS.private
                  return (
                    <div key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-200 transition-colors flex items-center gap-3"
                      style={{ borderLeft: `3px solid ${colors.border}` }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {s.class_name || s.subject_name || 'Session'}
                          </p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: colors.bg, color: colors.text }}>
                            {CLASS_TYPE_LABELS[s.class_type || 'private']}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatTime(s.scheduled_at)} · {formatDuration(s.duration_minutes)} · {s.teacher_name}
                          {s.room_name && ` · ${s.room_name}`}
                        </p>
                        {s.students.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {s.students.map(st => st.full_name).join(', ')}
                          </p>
                        )}
                      </div>
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full shrink-0',
                        s.status === 'completed' ? 'bg-teal-50 text-teal-700' :
                        s.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      )}>{s.status}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

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
