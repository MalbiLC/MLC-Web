'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSessionsForDay } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime, formatDuration, formatDate } from '@/lib/utils'
import {
  Users, GraduationCap, CalendarCheck, MapPin, Monitor,
  Check, RotateCcw, X, ChevronLeft, ChevronRight, Pencil,
  Bell, AlertTriangle, CalendarClock, Clock,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  group:          { bg: '#E6F4F2', border: '#0F7B6C', text: '#0F7B6C' },
  semi_private:   { bg: '#E8F0FA', border: '#1A5FA8', text: '#1A5FA8' },
  private:        { bg: '#FEF3DC', border: '#E8A020', text: '#B45309' },
  private_online: { bg: '#F0F0FE', border: '#6366F1', text: '#4338CA' },
}
const CT_LABELS: Record<string, string> = {
  group: 'Group', semi_private: 'Semi-Private', private: 'Private', private_online: 'Online',
}

const HOUR_START = 8
const HOUR_END   = 22
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => i + HOUR_START)
const PX_PER_HR  = 56
const GRID_H     = HOURS.length * PX_PER_HR

function timeToPx(d: Date) {
  return ((d.getHours() - HOUR_START) + d.getMinutes() / 60) * PX_PER_HR
}

// ── Reschedule modal ─────────────────────────────────────────────
function RescheduleModal({ session, onClose, onDone }: {
  session: CalendarSession; onClose: () => void; onDone: () => void
}) {
  const sb = createClient()
  const [date,   setDate]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await sb.from('sessions').update({ status: 'rescheduled' }).eq('id', session.id)
      const orig = new Date(session.scheduled_at)

      let newDate: Date
      if (date) {
        newDate = new Date(date + 'T00:00:00')
        newDate.setHours(orig.getHours(), orig.getMinutes(), 0, 0)
      } else if (session.series_id) {
        const { data: last } = await sb
          .from('sessions').select('scheduled_at, series_index')
          .eq('series_id', session.series_id)
          .order('scheduled_at', { ascending: false }).limit(1)
        newDate = last?.[0] ? new Date(last[0].scheduled_at) : new Date(orig)
        newDate.setDate(newDate.getDate() + 7)
      } else {
        newDate = new Date(orig); newDate.setDate(newDate.getDate() + 7)
      }

      const { data: newSess, error: insErr } = await sb.from('sessions').insert({
        class_name: session.class_name, class_type: session.class_type,
        scheduled_at: newDate.toISOString(), duration_minutes: session.duration_minutes,
        status: 'scheduled', series_id: session.series_id,
        notes: `Rescheduled from ${orig.toLocaleDateString('id-ID')}`,
      }).select('id').single()
      if (insErr) throw new Error(insErr.message)
      if (newSess && session.students.length > 0) {
        await sb.from('session_students').insert(
          session.students.map(st => ({ session_id: newSess.id, student_id: st.id }))
        )
      }
      onDone()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold">Reschedule session</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-500">
            Current: <span className="font-medium text-gray-800">
              {new Date(session.scheduled_at).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}
              {' at '}{formatTime(session.scheduled_at)}
            </span>
          </p>
          <div>
            <label className="label">New date <span className="text-gray-400 text-xs font-normal">(optional — blank auto-adds 1 week after last session)</span></label>
            <input className="input" type="date" value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}/>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : date ? 'Reschedule to date' : 'Auto-reschedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Session detail panel ─────────────────────────────────────────
function SessionPanel({ session, onClose, onRefresh }: {
  session: CalendarSession; onClose: () => void; onRefresh: () => void
}) {
  const sb = createClient()
  const [busy,          setBusy]          = useState(false)
  const [showReschedule,setShowReschedule] = useState(false)
  const c     = CT_COLORS[session.class_type || 'private'] || CT_COLORS.private
  const start = new Date(session.scheduled_at)
  const end   = new Date(start.getTime() + session.duration_minutes * 60_000)

  const act = async (status: string) => {
    setBusy(true)
    await sb.from('sessions').update({ status }).eq('id', session.id)
    setBusy(false); onRefresh(); onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: c.bg, color: c.text }}>
                  {CT_LABELS[session.class_type || 'private']}
                </span>
                {session.subject_name && <span className="badge bg-gray-100 text-gray-600">{session.subject_name}</span>}
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                  session.status === 'completed'   ? 'bg-teal-50 text-teal-700' :
                  session.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' :
                  session.status === 'cancelled'   ? 'bg-gray-100 text-gray-500'
                                                   : 'bg-blue-50 text-blue-700'
                )}>{session.status}</span>
              </div>
              <h2 className="text-base font-semibold">{session.class_name || session.subject_name || 'Session'}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18}/></button>
          </div>

          <div className="px-6 py-4 space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Date &amp; time</p>
              <p className="text-sm font-medium text-gray-900">
                {start.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </p>
              <p className="text-xs text-gray-500">
                {formatTime(session.scheduled_at)} – {end.toTimeString().slice(0,5)} · {session.duration_minutes} min
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Teacher</p>
              <p className="text-sm font-medium text-gray-700">{session.teacher_name}</p>
            </div>
            {session.room_name && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                {session.room_type === 'zoom' ? <Monitor size={14} className="text-gray-400"/> : <MapPin size={14} className="text-gray-400"/>}
                {session.room_name}
              </div>
            )}
            {session.students.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Students ({session.students.length})</p>
                <div className="space-y-1">
                  {session.students.map(s => (
                    <div key={s.id} className="flex items-center px-3 py-2 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{s.full_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {session.notes && <p className="text-sm text-gray-400 italic">{session.notes}</p>}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            {session.status === 'scheduled' && (
              <div className="flex gap-2">
                <button onClick={() => act('completed')} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl text-white"
                  style={{ backgroundColor: 'var(--mlc-teal)' }}>
                  <Check size={15}/> Mark completed
                </button>
                <button onClick={() => setShowReschedule(true)} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                  <RotateCcw size={15}/> Reschedule
                </button>
              </div>
            )}
            {(session.status === 'completed' || session.status === 'rescheduled' || session.status === 'cancelled') && (
              <button onClick={() => act('scheduled')} disabled={busy}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100">
                <Pencil size={14}/>
                {session.status === 'completed'   ? 'Undo — set back to scheduled' :
                 session.status === 'rescheduled' ? 'Edit back to scheduled' : 'Restore session'}
              </button>
            )}
          </div>
        </div>
      </div>
      {showReschedule && (
        <RescheduleModal
          session={session}
          onClose={() => setShowReschedule(false)}
          onDone={() => { setShowReschedule(false); onRefresh(); onClose() }}
        />
      )}
    </>
  )
}

// ── Reminders panel ──────────────────────────────────────────────
interface Reminder {
  id: string
  type: 'trial_followup' | 'low_sessions' | 'expired'
  priority: 'high' | 'medium'
  title: string
  description: string
  date?: string
  link: string
}

function RemindersPanel() {
  const sb = createClient()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const build = async () => {
      const list: Reminder[] = []
      const today = new Date(); today.setHours(0,0,0,0)

      // Trial follow-ups
      const { data: trials } = await sb
        .from('students')
        .select('id, full_name, followup_date, parent_contact')
        .eq('student_type', 'potential')
        .eq('status', 'potential_trial_done')
        .not('followup_date', 'is', null)
        .order('followup_date')

      for (const s of trials || []) {
        const isPast = new Date(s.followup_date) <= today
        list.push({
          id: `trial-${s.id}`, type: 'trial_followup',
          priority: isPast ? 'high' : 'medium',
          title: s.full_name,
          description: `Follow-up ${isPast ? 'overdue' : 'due'} ${formatDate(s.followup_date)}${s.parent_contact ? ` · ${s.parent_contact}` : ''}`,
          date: s.followup_date, link: '/students',
        })
      }

      // Low sessions
      const { data: low } = await sb
        .from('student_subject_sessions')
        .select('sessions_remaining, students(id, full_name), subjects(name)')
        .lte('sessions_remaining', 2).gt('sessions_remaining', 0)

      for (const ss of low || []) {
        const student = Array.isArray(ss.students) ? ss.students[0] : ss.students as any
        const subject = Array.isArray(ss.subjects) ? ss.subjects[0] : ss.subjects as any
        if (!student) continue
        list.push({
          id: `low-${student.id}-${subject?.name}`, type: 'low_sessions',
          priority: ss.sessions_remaining === 1 ? 'high' : 'medium',
          title: student.full_name,
          description: `${subject?.name} — only ${ss.sessions_remaining} session${ss.sessions_remaining !== 1 ? 's' : ''} left`,
          link: '/students',
        })
      }

      // Expired
      const { data: expired } = await sb
        .from('students')
        .select('id, full_name, parent_contact')
        .eq('student_type', 'current').eq('status', 'expired')

      for (const s of expired || []) {
        list.push({
          id: `expired-${s.id}`, type: 'expired',
          priority: 'high',
          title: s.full_name,
          description: `Sessions expired · Contact parent to renew${s.parent_contact ? ` · ${s.parent_contact}` : ''}`,
          link: '/students',
        })
      }

      list.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1
        return (a.date || '').localeCompare(b.date || '')
      })

      setReminders(list)
      setLoading(false)
    }
    build()
  }, [])

  const typeIcon = (type: string) => {
    if (type === 'trial_followup') return <CalendarClock size={14} className="text-blue-500"/>
    if (type === 'low_sessions')   return <AlertTriangle size={14} className="text-amber-500"/>
    return <Clock size={14} className="text-red-500"/>
  }

  if (loading) return <div className="text-xs text-gray-400 py-2">Checking reminders…</div>
  if (reminders.length === 0) return (
    <div className="text-center py-6">
      <Bell size={24} className="mx-auto text-gray-200 mb-2"/>
      <p className="text-xs text-gray-400">No reminders</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {reminders.map(r => (
        <a key={r.id} href={r.link}
          className={cn(
            'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors hover:opacity-90',
            r.priority === 'high' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
          )}>
          <div className="mt-0.5 shrink-0">{typeIcon(r.type)}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{r.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{r.description}</p>
          </div>
        </a>
      ))}
    </div>
  )
}

// ── Main dashboard ───────────────────────────────────────────────
export default function DashboardPage() {
  useAuth()
  const sb = createClient()
  const [sessions,  setSessions]  = useState<CalendarSession[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<CalendarSession | null>(null)
  const [viewDate,  setViewDate]  = useState(new Date())

  const today   = new Date()
  const isToday = viewDate.toDateString() === today.toDateString()
  const hour    = today.getHours()
  const greeting = isToday
    ? (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    : viewDate.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setSessions(await getSessionsForDay(viewDate)) }
    finally { setLoading(false) }
  }, [viewDate])

  useEffect(() => {
    load()
    const ch = sb.channel('dash-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'sessions' }, load)
      .subscribe()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { sb.removeChannel(ch); window.removeEventListener('focus', onFocus) }
  }, [load])

  const scheduled = sessions.filter(s => s.status === 'scheduled').length
  const completed = sessions.filter(s => s.status === 'completed').length
  const studentIds = new Set(sessions.flatMap(s => s.students.map(st => st.id)))
  const teacherSet = new Set(sessions.map(s => s.teacher_name))

  // Today's current time position
  const nowDate = new Date()
  const nowPx   = isToday ? timeToPx(nowDate) : null

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">
            {viewDate.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
          <h1 className="text-2xl font-semibold">{greeting}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewDate(d => { const n=new Date(d); n.setDate(n.getDate()-1); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18}/></button>
          {!isToday && (
            <button onClick={() => setViewDate(new Date())}
              className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 text-gray-600">Today</button>
          )}
          <button onClick={() => setViewDate(d => { const n=new Date(d); n.setDate(n.getDate()+1); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18}/></button>
        </div>
      </div>

      <div className="page-content">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><CalendarCheck size={13}/> Sessions</div>
            <p className="text-2xl font-semibold">{sessions.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">{scheduled} upcoming · {completed} done</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Users size={13}/> Students</div>
            <p className="text-2xl font-semibold">{studentIds.size}</p>
            <p className="text-xs text-gray-400 mt-0.5">Across all sessions</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><GraduationCap size={13}/> Teachers</div>
            <p className="text-2xl font-semibold">{teacherSet.size}</p>
            <p className="text-xs text-gray-400 mt-0.5">Teaching today</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><CalendarCheck size={13}/> Progress</div>
            <p className="text-2xl font-semibold">
              {sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{completed} of {sessions.length} done</p>
          </div>
        </div>

        {/* Main 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_280px] gap-5">

          {/* ── Day time grid ── */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Day view</p>
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden"
              style={{ height: GRID_H }}>
              {loading ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">Loading…</div>
              ) : (
                <div className="flex h-full">
                  {/* Hour labels */}
                  <div className="w-14 shrink-0 border-r border-gray-100 relative">
                    {HOURS.map((h, i) => (
                      <div key={h} style={{ position:'absolute', top: i * PX_PER_HR + 2, left:0, right:0, paddingLeft:8 }}>
                        <span style={{ fontSize:11, color:'#9ca3af' }}>
                          {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h-12} PM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Session area */}
                  <div className="flex-1 relative">
                    {/* Hour lines */}
                    {HOURS.map((_, i) => (
                      <div key={i} style={{ position:'absolute', top: i * PX_PER_HR, left:0, right:0,
                        borderBottom:'1px solid #f3f4f6', height: PX_PER_HR }}/>
                    ))}

                    {/* Current time */}
                    {nowPx !== null && nowPx >= 0 && nowPx <= GRID_H && (
                      <div style={{ position:'absolute', top: nowPx, left:0, right:0,
                        display:'flex', alignItems:'center', zIndex:10 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', backgroundColor:'#ef4444', marginLeft:-4, flexShrink:0 }}/>
                        <div style={{ flex:1, height:1, backgroundColor:'#ef4444' }}/>
                      </div>
                    )}

                    {/* Session blocks */}
                    {sessions.map(s => {
                      const st  = new Date(s.scheduled_at)
                      const top = timeToPx(st)
                      const h   = Math.max((s.duration_minutes / 60) * PX_PER_HR - 2, 20)
                      const c   = CT_COLORS[s.class_type || 'private'] || CT_COLORS.private
                      if (top < 0 || top > GRID_H) return null
                      return (
                        <div key={s.id} onClick={() => setSelected(s)}
                          style={{ position:'absolute', top, left:2, right:2, height:h,
                            backgroundColor: c.bg, borderLeft:`3px solid ${c.border}`,
                            borderRadius:8, padding:'3px 8px', cursor:'pointer',
                            overflow:'hidden', zIndex:5,
                            opacity: s.status === 'cancelled' ? 0.4 : 1 }}>
                          <p style={{ fontSize:11, fontWeight:600, color:c.text, lineHeight:'1.3',
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {s.class_name || s.subject_name || 'Session'}
                          </p>
                          {h > 30 && (
                            <p style={{ fontSize:10, color:c.text, opacity:0.75, lineHeight:'1.3',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {formatTime(s.scheduled_at)} · {s.teacher_name}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Session list ── */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Sessions</p>
            {loading ? (
              <div className="text-sm text-gray-400">Loading…</div>
            ) : sessions.length === 0 ? (
              <div className="card text-center py-12 text-gray-400 text-sm">No sessions today.</div>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => {
                  const c = CT_COLORS[s.class_type || 'private'] || CT_COLORS.private
                  const isPast = new Date(s.scheduled_at) < new Date()
                  return (
                    <div key={s.id} onClick={() => setSelected(s)}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-200 transition-colors"
                      style={{ borderLeft:`3px solid ${c.border}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {s.class_name || s.subject_name || 'Session'}
                            </p>
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0"
                              style={{ backgroundColor:c.bg, color:c.text }}>
                              {CT_LABELS[s.class_type || 'private']}
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
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5',
                          s.status === 'completed'   ? 'bg-teal-50 text-teal-700' :
                          s.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' :
                          s.status === 'cancelled'   ? 'bg-gray-100 text-gray-400' :
                          isPast ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
                        )}>
                          {s.status === 'scheduled' && isPast ? 'overdue' : s.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Reminders ── */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Bell size={12}/> Reminders
            </p>
            <RemindersPanel/>
          </div>
        </div>
      </div>

      {selected && (
        <SessionPanel session={selected} onClose={() => setSelected(null)} onRefresh={load}/>
      )}
    </div>
  )
}
