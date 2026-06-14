'use client'

import { useEffect, useState } from 'react'
import { getTodaySessions, computeDashboardStats } from '@/lib/queries'
import { formatTime, formatDuration, getInitials, statusConfig, cn } from '@/lib/utils'
import { Users, GraduationCap, CalendarCheck } from 'lucide-react'
import type { DashboardSession, DashboardStats } from '@/types'

export default function DashboardPage() {
  const [sessions, setSessions] = useState<DashboardSession[]>([])
  const [stats,    setStats]    = useState<DashboardStats | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    getTodaySessions()
      .then(data => {
        setSessions(data)
        setStats(computeDashboardStats(data))
      })
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('en-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Unique students + teachers from non-cancelled sessions
  const activeSessions = sessions.filter(s => s.status !== 'cancelled')
  const uniqueStudents = [...new Map(activeSessions.map(s => [s.student_id, s])).values()]
  const uniqueTeachers = [...new Map(activeSessions.map(s => [s.teacher_id, s])).values()]

  const avatarColors = [
    { bg: 'bg-blue-50',   text: 'text-blue-800'  },
    { bg: 'bg-teal-50',   text: 'text-teal-800'  },
    { bg: 'bg-purple-50', text: 'text-purple-800' },
    { bg: 'bg-amber-50',  text: 'text-amber-800'  },
    { bg: 'bg-pink-50',   text: 'text-pink-800'   },
  ]

  const borderColors: Record<string, string> = {
    scheduled:   'border-l-blue-400',
    completed:   'border-l-teal-400',
    cancelled:   'border-l-gray-300',
    rescheduled: 'border-l-amber-400',
  }

  const LOW_THRESHOLD = 3

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{today}</p>
            <h1>{greeting}</h1>
          </div>
        </div>
        <div className="page-content">
          <div className="text-sm text-gray-400">Loading today's schedule…</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{today}</p>
          <h1>{greeting}</h1>
        </div>
      </div>

      <div className="page-content space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <CalendarCheck size={14} /> Sessions today
            </div>
            <p className="text-3xl font-semibold text-gray-900">{stats?.total ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">
              {stats?.scheduled} upcoming · {stats?.completed} done · {stats?.cancelled} cancelled
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Users size={14} /> Students
            </div>
            <p className="text-3xl font-semibold text-gray-900">{stats?.students ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">
              {uniqueStudents.filter(s =>
                sessions.filter(x => x.student_id === s.student_id).length > 1
              ).length > 0
                ? `${uniqueStudents.filter(s =>
                    sessions.filter(x => x.student_id === s.student_id).length > 1
                  ).length} with multiple sessions`
                : 'Across all sessions'}
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <GraduationCap size={14} /> Teachers
            </div>
            <p className="text-3xl font-semibold text-gray-900">{stats?.teachers ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">Teaching today</p>
          </div>
        </div>

        {/* Schedule list */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            Today's schedule
          </p>

          {sessions.length === 0 ? (
            <div className="card text-center py-12 text-gray-400 text-sm">
              No sessions scheduled for today.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const badge  = statusConfig.session[session.status]
                const isLow  = session.sessions_remaining <= LOW_THRESHOLD && session.status !== 'cancelled'
                const isCancelled = session.status === 'cancelled'
                const location = session.room_name
                  ? session.room_type === 'zoom' ? `Zoom · ${session.room_name}` : session.room_name
                  : 'No room set'

                return (
                  <div
                    key={session.id}
                    className={cn(
                      'card border-l-[3px] py-3.5 flex items-center gap-4',
                      borderColors[session.status],
                      isCancelled && 'opacity-60'
                    )}
                  >
                    {/* Time */}
                    <div className="w-16 shrink-0">
                      <p className="text-sm font-medium text-gray-900">
                        {formatTime(session.scheduled_at)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDuration(session.duration_minutes)}
                      </p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {session.student_name}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 flex-wrap">
                        <span>{session.teacher_name}</span>
                        {session.subject_name && (
                          <><span className="text-gray-300">·</span><span>{session.subject_name}</span></>
                        )}
                        <span className="text-gray-300">·</span>
                        <span>{location}</span>
                      </div>
                    </div>

                    {/* Right: sessions + badge */}
                    <div className="shrink-0 text-right space-y-1">
                      <span className={cn('badge', badge.color)}>{badge.label}</span>
                      {!isCancelled && (
                        <p className={cn(
                          'text-xs',
                          isLow ? 'text-red-500 font-medium' : 'text-gray-400'
                        )}>
                          {session.sessions_remaining} sessions left
                          {isLow && session.sessions_remaining > 0 && ' ⚠'}
                          {session.sessions_remaining === 0 && ' · Expired'}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Students + Teachers panels */}
        <div className="grid grid-cols-2 gap-4">
          {/* Students */}
          <div className="card">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Users size={13} /> Students today
            </p>
            <div className="space-y-0">
              {uniqueStudents.length === 0 && sessions.filter(s => s.status === 'cancelled').length > 0 && (
                <p className="text-sm text-gray-400">All sessions cancelled today.</p>
              )}
              {[
                ...uniqueStudents,
                ...sessions
                  .filter(s => s.status === 'cancelled')
                  .filter(s => !uniqueStudents.find(u => u.student_id === s.student_id))
                  .map(s => ({ ...s, _cancelled: true }))
              ].map((s, i) => {
                const color = avatarColors[i % avatarColors.length]
                const sessionCount = sessions.filter(
                  x => x.student_id === s.student_id && x.status !== 'cancelled'
                ).length
                const isCancelled = (s as any)._cancelled || sessionCount === 0
                const subjects = [...new Set(
                  sessions
                    .filter(x => x.student_id === s.student_id && x.subject_name)
                    .map(x => x.subject_name)
                )].join(' · ')

                return (
                  <div
                    key={s.student_id}
                    className={cn(
                      'flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0',
                      isCancelled && 'opacity-50'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                      color.bg, color.text
                    )}>
                      {getInitials(s.student_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.student_name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {isCancelled ? 'Cancelled' : subjects || 'No subject'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">
                      {isCancelled ? '—' : `${sessionCount} session${sessionCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Teachers */}
          <div className="card">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <GraduationCap size={13} /> Teachers today
            </p>
            <div className="space-y-0">
              {uniqueTeachers.map((t, i) => {
                const color = avatarColors[i % avatarColors.length]
                const sessionCount = activeSessions.filter(x => x.teacher_id === t.teacher_id).length
                const subjects = [...new Set(
                  activeSessions
                    .filter(x => x.teacher_id === t.teacher_id && x.subject_name)
                    .map(x => x.subject_name)
                )].join(' · ')

                return (
                  <div key={t.teacher_id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                      color.bg, color.text
                    )}>
                      {getInitials(t.teacher_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.teacher_name}</p>
                      <p className="text-xs text-gray-400 truncate">{subjects || 'No subject'}</p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">
                      {sessionCount} session{sessionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
