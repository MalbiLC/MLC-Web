'use client'

import { useEffect, useState } from 'react'
import { getTodaySessions, computeDashboardStats } from '@/lib/queries'
import { formatTime, formatDuration, getInitials, sessionStatusConfig, cn } from '@/lib/utils'
import { Users, GraduationCap, CalendarCheck } from 'lucide-react'
import type { DashboardSession, DashboardStats } from '@/types'

const LOW = 3
const avatarColors = [
  'bg-blue-50 text-blue-800', 'bg-teal-50 text-teal-800',
  'bg-purple-50 text-purple-800', 'bg-amber-50 text-amber-800',
  'bg-pink-50 text-pink-800',
]
const borderColors: Record<string, string> = {
  scheduled: 'border-l-blue-400', completed: 'border-l-teal-400',
  cancelled: 'border-l-gray-300', rescheduled: 'border-l-amber-400',
}

function uniqueBy<T>(arr: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return arr.filter(item => { const k = key(item); if (seen.has(k)) return false; seen.add(k); return true })
}

function uniqueStrings(arr: (string | null)[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  arr.forEach(v => { if (v && !seen.has(v)) { seen.add(v); result.push(v) } })
  return result
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<DashboardSession[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTodaySessions().then(data => {
      setSessions(data)
      setStats(computeDashboardStats(data))
    }).finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('en-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const active = sessions.filter(s => s.status !== 'cancelled')
  const uStudents = uniqueBy(active, s => s.student_id)
  const uTeachers = uniqueBy(active, s => s.teacher_id)

  return (
    <div>
      <div className="page-header">
        <div><p className="text-xs text-gray-400 mb-0.5">{today}</p><h1>{greeting}</h1></div>
      </div>
      <div className="page-content space-y-6">
        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="stat-card">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><CalendarCheck size={14} /> Sessions today</div>
                <p className="text-3xl font-semibold">{stats?.total || 0}</p>
                <p className="text-xs text-gray-400 mt-1">{stats?.scheduled} upcoming · {stats?.completed} done · {stats?.cancelled} cancelled</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Users size={14} /> Students</div>
                <p className="text-3xl font-semibold">{stats?.students || 0}</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><GraduationCap size={14} /> Teachers</div>
                <p className="text-3xl font-semibold">{stats?.teachers || 0}</p>
              </div>
            </div>

            {/* Schedule */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Today&apos;s schedule</p>
              {sessions.length === 0 ? (
                <div className="card text-center py-12 text-gray-400 text-sm">No sessions scheduled for today.</div>
              ) : (
                <div className="space-y-2">
                  {sessions.map(s => {
                    const badge = sessionStatusConfig[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-500' }
                    const isLow = s.sessions_remaining <= LOW && s.status !== 'cancelled'
                    const location = s.room_name ? (s.room_type === 'zoom' ? `Zoom · ${s.room_name}` : s.room_name) : 'No room'
                    return (
                      <div key={s.id} className={cn('card border-l-[3px] py-3.5 flex items-center gap-4', borderColors[s.status], s.status === 'cancelled' && 'opacity-60')}>
                        <div className="w-16 shrink-0">
                          <p className="text-sm font-medium">{formatTime(s.scheduled_at)}</p>
                          <p className="text-xs text-gray-400">{formatDuration(s.duration_minutes)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.student_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {s.teacher_name}{s.subject_name ? ` · ${s.subject_name}` : ''} · {location}
                          </p>
                        </div>
                        <div className="shrink-0 text-right space-y-1">
                          <span className={cn('badge', badge.color)}>{badge.label}</span>
                          {s.status !== 'cancelled' && (
                            <p className={cn('text-xs', isLow ? 'text-red-500 font-medium' : 'text-gray-400')}>
                              {s.sessions_remaining} left{s.sessions_remaining === 0 ? ' · Expired' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Students + Teachers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Users size={13} /> Students today</p>
                {uStudents.map((s, i) => {
                  const subjects = uniqueStrings(sessions.filter(x => x.student_id === s.student_id).map(x => x.subject_name)).join(' · ')
                  const count = sessions.filter(x => x.student_id === s.student_id && x.status !== 'cancelled').length
                  return (
                    <div key={s.student_id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0', avatarColors[i % avatarColors.length])}>{getInitials(s.student_name)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.student_name}</p>
                        <p className="text-xs text-gray-400 truncate">{subjects || '—'}</p>
                      </div>
                      <p className="text-xs text-gray-400 shrink-0">{count} session{count !== 1 ? 's' : ''}</p>
                    </div>
                  )
                })}
              </div>
              <div className="card">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><GraduationCap size={13} /> Teachers today</p>
                {uTeachers.map((t, i) => {
                  const subjects = uniqueStrings(active.filter(x => x.teacher_id === t.teacher_id).map(x => x.subject_name)).join(' · ')
                  const count = active.filter(x => x.teacher_id === t.teacher_id).length
                  return (
                    <div key={t.teacher_id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0', avatarColors[i % avatarColors.length])}>{getInitials(t.teacher_name)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.teacher_name}</p>
                        <p className="text-xs text-gray-400 truncate">{subjects || '—'}</p>
                      </div>
                      <p className="text-xs text-gray-400 shrink-0">{count} session{count !== 1 ? 's' : ''}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
