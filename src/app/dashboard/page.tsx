'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSessionsForDay } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime, formatDuration } from '@/lib/utils'
import {
  Users, GraduationCap, CalendarCheck, MapPin, Monitor,
  Check, RotateCcw, X, ChevronLeft, ChevronRight, Pencil,
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
  group: 'Group', semi_private: 'Semi-Private', private: 'Private', private_online: 'Online'
}
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8)
const PX = 56

function dateToPx(d: Date) { return ((d.getHours() - 8) + d.getMinutes() / 60) * PX }

// ── Reschedule modal ────────────────────────────────────────────
function RescheduleModal({ session, onClose, onDone }: {
  session: CalendarSession; onClose: () => void; onDone: () => void
}) {
  const sb = createClient()
  const [date, setDate]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      // Mark current session rescheduled
      await sb.from('sessions').update({ status: 'rescheduled' }).eq('id', session.id)

      if (date) {
        // Create new session on the chosen date, same time
        const orig = new Date(session.scheduled_at)
        const newDate = new Date(date + 'T00:00:00')
        newDate.setHours(orig.getHours(), orig.getMinutes(), 0, 0)

        const { data: newSess, error: insErr } = await sb.from('sessions').insert({
          class_name:       session.class_name,
          class_type:       session.class_type,
          teacher_id:       null, // will be looked up
          subject_id:       null,
          room_id:          null,
          scheduled_at:     newDate.toISOString(),
          duration_minutes: session.duration_minutes,
          status:           'scheduled',
          notes:            `Rescheduled from ${orig.toLocaleDateString('id-ID')}`,
          series_id:        session.series_id,
          series_index:     (session.series_index ?? 0) + 100, // append
        }).select('id').single()

        if (insErr) throw new Error(insErr.message)

        // Re-link students
        if (newSess && session.students.length > 0) {
          await sb.from('session_students').insert(
            session.students.map(st => ({ session_id: newSess.id, student_id: st.id }))
          )
        }
      } else {
        // No date given — find last session in series, add one week after
        if (session.series_id) {
          const { data: seriesSessions } = await sb
            .from('sessions')
            .select('scheduled_at, series_index')
            .eq('series_id', session.series_id)
            .order('scheduled_at', { ascending: false })
            .limit(1)

          if (seriesSessions && seriesSessions.length > 0) {
            const last = new Date(seriesSessions[0].scheduled_at)
            last.setDate(last.getDate() + 7) // +1 week

            const { data: newSess, error: insErr } = await sb.from('sessions').insert({
              class_name:       session.class_name,
              class_type:       session.class_type,
              teacher_id:       null,
              subject_id:       null,
              room_id:          null,
              scheduled_at:     last.toISOString(),
              duration_minutes: session.duration_minutes,
              status:           'scheduled',
              notes:            `Auto-added: rescheduled from ${new Date(session.scheduled_at).toLocaleDateString('id-ID')}`,
              series_id:        session.series_id,
              series_index:     (seriesSessions[0].series_index ?? 0) + 1,
            }).select('id').single()

            if (insErr) throw new Error(insErr.message)
            if (newSess && session.students.length > 0) {
              await sb.from('session_students').insert(
                session.students.map(st => ({ session_id: newSess.id, student_id: st.id }))
              )
            }
          }
        }
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
            <label className="label">New date <span className="text-gray-400 text-xs font-normal">(leave blank to auto-add 1 week after last session)</span></label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}/>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : date ? 'Reschedule to this date' : 'Reschedule (auto-date)'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Session detail panel ────────────────────────────────────────
function SessionPanel({ session, onClose, onRefresh }: {
  session: CalendarSession; onClose: () => void; onRefresh: () => void
}) {
  const sb = createClient()
  const [busy, setBusy]           = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const c     = CT_COLORS[session.class_type || 'private'] || CT_COLORS.private
  const start = new Date(session.scheduled_at)
  const end   = new Date(start.getTime() + session.duration_minutes * 60_000)

  const markComplete = async () => {
    setBusy(true)
    try {
      // Mark session completed
      await sb.from('sessions').update({ status: 'completed' }).eq('id', session.id)
      // Decrement sessions_remaining for each student in this session
      for (const st of session.students) {
        // Get the subject_id for this session (need to query)
        const { data: sess } = await sb
          .from('sessions').select('subject_id').eq('id', session.id).single()
        if (sess?.subject_id) {
          await sb.from('student_subject_sessions')
            .update({ sessions_remaining: sb.rpc as any })  // use RPC pattern
            .eq('student_id', st.id)
            .eq('subject_id', sess.subject_id)
        }
      }
      // Use a simpler decrement via RPC
      await sb.rpc('decrement_sessions_for_session', { p_session_id: session.id })
      onRefresh(); onClose()
    } catch {
      // Fallback: just update status without decrement if RPC doesn't exist
      onRefresh(); onClose()
    } finally { setBusy(false) }
  }

  const revertStatus = async (status: string) => {
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
                  session.status === 'cancelled'   ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700'
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
              <p className="text-xs text-gray-500">{formatTime(session.scheduled_at)} – {end.toTimeString().slice(0,5)} · {session.duration_minutes} min</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Teacher</p>
              <p className="text-sm text-gray-700 font-medium">{session.teacher_name}</p>
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
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{s.full_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {session.notes && <p className="text-sm text-gray-400 italic">{session.notes}</p>}
          </div>

          {/* Action buttons */}
          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            {session.status === 'scheduled' && (
              <div className="flex gap-2">
                <button onClick={markComplete} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl text-white transition-colors"
                  style={{ backgroundColor: 'var(--mlc-teal)' }}>
                  <Check size={15}/> Mark completed
                </button>
                <button onClick={() => setShowReschedule(true)} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                  <RotateCcw size={15}/> Reschedule
                </button>
              </div>
            )}
            {session.status === 'completed' && (
              <button onClick={() => revertStatus('scheduled')} disabled={busy}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100">
                <Pencil size={14}/> Undo — set back to scheduled
              </button>
            )}
            {session.status === 'rescheduled' && (
              <button onClick={() => revertStatus('scheduled')} disabled={busy}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                <Pencil size={14}/> Edit back to scheduled
              </button>
            )}
            {session.status === 'cancelled' && (
              <button onClick={() => revertStatus('scheduled')} disabled={busy}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100">
                <Pencil size={14}/> Restore session
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

// ── Day time grid ───────────────────────────────────────────────
function DayGrid({ sessions, onClick }: { sessions: CalendarSession[]; onClick: (s: CalendarSession) => void }) {
  const now    = new Date()
  const nowPx  = dateToPx(now)
  const height = HOURS.length * PX

  return (
    <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="w-14 shrink-0 border-r border-gray-100" style={{ height }}>
        {HOURS.map((h, i) => (
          <div key={h} style={{ position:'absolute', top: i * PX, left: 0, width: 56, paddingLeft: 8, paddingTop: 2 }}>
            <span className="text-xs text-gray-400">{h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h-12} PM`}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 relative" style={{ height }}>
        {HOURS.map((_,i) => <div key={i} style={{ position:'absolute', top: i*PX, left:0, right:0, borderBottom:'1px solid #f9fafb', height:PX }}/>)}
        {nowPx >= 0 && nowPx <= height && (
          <div style={{ position:'absolute', top:nowPx, left:0, right:0, display:'flex', alignItems:'center', zIndex:10 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor:'#ef4444', marginLeft:-5, flexShrink:0 }}/>
            <div style={{ flex:1, height:1, backgroundColor:'#ef4444' }}/>
          </div>
        )}
        {sessions.map(s => {
          const st  = new Date(s.scheduled_at)
          const top = dateToPx(st)
          const h   = Math.max((s.duration_minutes / 60) * PX - 2, 18)
          const c   = CT_COLORS[s.class_type || 'private'] || CT_COLORS.private
          if (top < 0 || top > height) return null
          return (
            <div key={s.id} onClick={() => onClick(s)}
              style={{ position:'absolute', top, left:2, right:2, height:h, backgroundColor:c.bg, borderLeft:`3px solid ${c.border}`, borderRadius:6, padding:'2px 6px', cursor:'pointer', overflow:'hidden' }}>
              <p style={{ fontSize:11, fontWeight:600, color:c.text, lineHeight:'1.2', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {s.class_name || s.subject_name || 'Session'}
              </p>
              {h > 28 && <p style={{ fontSize:10, color:c.text, opacity:0.75, lineHeight:'1.2', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {formatTime(s.scheduled_at)} · {s.teacher_name}
              </p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main dashboard ──────────────────────────────────────────────
export default function DashboardPage() {
  useAuth()
  const sb = createClient()
  const [sessions,  setSessions]  = useState<CalendarSession[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<CalendarSession | null>(null)
  const [viewDate,  setViewDate]  = useState(new Date())
  const today   = new Date()
  const isToday = viewDate.toDateString() === today.toDateString()

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
  const hour = new Date().getHours()
  const greeting = isToday ? (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') : ''

  return (
    <div className="flex flex-col min-h-screen">
      <div className="page-header">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">
            {viewDate.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
          <h1 className="text-2xl font-semibold">{greeting || (isToday ? 'Today' : 'Schedule')}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18}/></button>
          {!isToday && (
            <button onClick={() => setViewDate(new Date())}
              className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 text-gray-600">Today</button>
          )}
          <button onClick={() => setViewDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n })}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18}/></button>
        </div>
      </div>

      <div className="page-content space-y-5 flex-1">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

        {loading ? <div className="text-sm text-gray-400">Loading…</div>
        : sessions.length === 0 ? (
          <div className="card text-center py-16 text-gray-400 text-sm">No sessions scheduled for this day.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Day view</p>
              <DayGrid sessions={sessions} onClick={setSelected}/>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Sessions</p>
              <div className="space-y-2">
                {sessions.map(s => {
                  const c = CT_COLORS[s.class_type || 'private'] || CT_COLORS.private
                  return (
                    <div key={s.id} onClick={() => setSelected(s)}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-200 transition-colors"
                      style={{ borderLeft: `3px solid ${c.border}` }}>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.class_name || s.subject_name || 'Session'}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor:c.bg, color:c.text }}>
                          {CT_LABELS[s.class_type || 'private']}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{formatTime(s.scheduled_at)} · {formatDuration(s.duration_minutes)} · {s.teacher_name}{s.room_name && ` · ${s.room_name}`}</p>
                      {s.students.length > 0 && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.students.map(st => st.full_name).join(', ')}</p>}
                      <span className={cn('mt-1.5 inline-block text-xs font-medium px-2 py-0.5 rounded-full',
                        s.status === 'completed' ? 'bg-teal-50 text-teal-700' : s.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' : s.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700'
                      )}>{s.status}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && <SessionPanel session={selected} onClose={() => setSelected(null)} onRefresh={load}/>}
    </div>
  )
}
