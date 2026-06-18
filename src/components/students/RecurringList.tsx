'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, cn } from '@/lib/utils'
import { deleteStudent } from '@/lib/studentQueries'
import StatusBadge from './StatusBadge'
import RecurringModal from './RecurringModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EditSessionModal from '@/components/sessions/EditSessionModal'
import type { Student } from '@/types/students'
import type { CalendarSession } from '@/lib/sessionQueries'
import { ChevronDown, Pencil, Trash2, BookOpen, CalendarClock } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props { students: Student[]; onRefresh: () => void }

const packageLabel: Record<string, string> = {
  group: 'Group Class', private: 'Private', semi_private: 'Semi-Private', online: 'Online',
}

const CT_COLORS: Record<string, { bg: string; text: string }> = {
  group:          { bg: '#E6F4F2', text: '#0F7B6C' },
  semi_private:   { bg: '#E8F0FA', text: '#1A5FA8' },
  private:        { bg: '#FEF3DC', text: '#B45309' },
  private_online: { bg: '#F0F0FE', text: '#4338CA' },
}

const STATUS_COLORS: Record<string, string> = {
  scheduled:   'bg-blue-50 text-blue-700',
  completed:   'bg-teal-50 text-teal-700',
  cancelled:   'bg-gray-100 text-gray-500',
  rescheduled: 'bg-amber-50 text-amber-700',
}

export default function RecurringList({ students, onRefresh }: Props) {
  const sb = createClient()

  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [editing,       setEditing]       = useState<Student | null>(null)
  const [deleting,      setDeleting]      = useState<Student | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState('')

  // Per-student sessions map
  const [studentSessions, setStudentSessions] = useState<Record<string, CalendarSession[]>>({})
  const [sessionsLoading, setSessionsLoading] = useState<Record<string, boolean>>({})

  // Session-level edit/delete
  const [editingSession,   setEditingSession]   = useState<CalendarSession | null>(null)
  const [deletingSession,  setDeletingSession]  = useState<CalendarSession | null>(null)
  const [deleteSeries,     setDeleteSeries]     = useState(false)
  const [sessDelLoading,   setSessDelLoading]   = useState(false)

  const toggle = (id: string) => {
    setExpanded(e => {
      if (e === id) return null
      loadSessions(id)
      return id
    })
  }

  const loadSessions = useCallback(async (studentId: string) => {
    setSessionsLoading(p => ({ ...p, [studentId]: true }))
    try {
      const { data: links } = await sb
        .from('session_students')
        .select('session_id')
        .eq('student_id', studentId)

      if (!links?.length) {
        setStudentSessions(p => ({ ...p, [studentId]: [] }))
        return
      }

      const ids = links.map((l: any) => l.session_id)
      const { data: rows } = await sb
        .from('sessions')
        .select(`
          id, class_name, class_type, scheduled_at, duration_minutes,
          status, notes, series_id, series_index, subject_id,
          teachers(full_name), subjects(name), rooms(name, type)
        `)
        .in('id', ids)
        .order('scheduled_at', { ascending: true })

      const sessions: CalendarSession[] = (rows || []).map((s: any) => ({
        id:               s.id,
        class_name:       s.class_name ?? null,
        class_type:       s.class_type ?? null,
        subject_name:     s.subjects?.name ?? null,
        teacher_name:     s.teachers?.full_name ?? 'Unknown',
        room_name:        s.rooms?.name ?? null,
        room_type:        s.rooms?.type ?? null,
        scheduled_at:     s.scheduled_at,
        duration_minutes: s.duration_minutes ?? 60,
        status:           s.status,
        notes:            s.notes ?? null,
        series_id:        s.series_id ?? null,
        series_index:     s.series_index ?? null,
        students:         [],
      }))

      setStudentSessions(p => ({ ...p, [studentId]: sessions }))
    } finally {
      setSessionsLoading(p => ({ ...p, [studentId]: false }))
    }
  }, [sb])

  const confirmDeleteStudent = async () => {
    if (!deleting) return
    setDeleteLoading(true); setDeleteError('')
    try { await deleteStudent(deleting.id); onRefresh(); setDeleting(null) }
    catch (e: unknown) { setDeleteError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setDeleteLoading(false) }
  }

  const deleteSessionConfirmed = async () => {
    if (!deletingSession) return
    setSessDelLoading(true)
    try {
      if (deleteSeries && deletingSession.series_id) {
        await sb.from('sessions').delete()
          .eq('series_id', deletingSession.series_id)
          .gte('series_index', deletingSession.series_index ?? 1)
      } else {
        await sb.from('sessions').delete().eq('id', deletingSession.id)
      }
      // Reload sessions for the expanded student
      if (expanded) await loadSessions(expanded)
    } finally {
      setSessDelLoading(false)
      setDeletingSession(null)
      setDeleteSeries(false)
    }
  }

  if (students.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-16 card">No recurring students yet.</div>
  }

  return (
    <>
      <div className="space-y-2">
        {students.map(s => {
          const isOpen      = expanded === s.id
          const subjectSessions = s.subject_sessions || []
          const totalSessions   = subjectSessions.reduce((a, ss) => a + ss.sessions_remaining, 0)
          const minSessions     = subjectSessions.length > 0 ? Math.min(...subjectSessions.map(ss => ss.sessions_remaining)) : 0
          const scheduled       = studentSessions[s.id] || []
          const isLoadingSess   = sessionsLoading[s.id]

          return (
            <div key={s.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {/* Collapsed row */}
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors">

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
                    {s.package && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {packageLabel[s.package]}
                      </span>
                    )}
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {subjectSessions.map(ss => (
                      <div key={ss.id} className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500">{ss.subject?.name}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-medium',
                          ss.sessions_remaining === 0 ? 'bg-red-50 text-red-600' :
                          ss.sessions_remaining <= 2 ? 'bg-amber-50 text-amber-600' :
                          'bg-teal-50 text-teal-700'
                        )}>{ss.sessions_remaining}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                  <BookOpen size={12} />
                  <span>{totalSessions} session{totalSessions !== 1 ? 's' : ''} total</span>
                </div>

                <ChevronDown size={16} className={cn('text-gray-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-gray-50 px-5 py-4 bg-gray-50/30">
                  {/* Student info grid */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Date of birth</p>
                      <p className="text-gray-700">{s.date_of_birth ? formatDate(s.date_of_birth) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">School</p>
                      <p className="text-gray-700">{s.school || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Package</p>
                      <p className="text-gray-700">{s.package ? packageLabel[s.package] : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Parent</p>
                      <p className="text-gray-700">{s.parent_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Contact</p>
                      <p className="text-gray-700 font-mono">{s.parent_contact || '—'}</p>
                    </div>

                    {/* Subjects */}
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-2">Subjects &amp; sessions remaining</p>
                      <div className="space-y-2">
                        {subjectSessions.map(ss => (
                          <div key={ss.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{ss.subject?.name}</p>
                              {(ss as any).package_name && <p className="text-xs text-gray-400 mt-0.5">{(ss as any).package_name}</p>}
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                'text-sm font-semibold',
                                ss.sessions_remaining === 0 ? 'text-red-600' :
                                ss.sessions_remaining <= 2 ? 'text-amber-600' : 'text-teal-700'
                              )}>{ss.sessions_remaining}</p>
                              <p className="text-xs text-gray-400">sessions left</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {s.additional_notes && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                        <p className="text-gray-600 text-sm">{s.additional_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Low session warning */}
                  {minSessions <= 2 && minSessions >= 0 && (
                    <div className={cn(
                      'px-3 py-2 rounded-lg text-xs font-medium mb-3',
                      minSessions === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {minSessions === 0 ? '⚠ Sessions expired — contact parent to renew' : `⚠ Low sessions — only ${minSessions} left`}
                    </div>
                  )}

                  {/* ── Scheduled sessions ── */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <CalendarClock size={12}/> Scheduled sessions
                    </p>
                    {isLoadingSess ? (
                      <p className="text-xs text-gray-400 py-2">Loading sessions…</p>
                    ) : scheduled.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No sessions scheduled yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {scheduled.map(sess => {
                          const ctColor = CT_COLORS[sess.class_type ?? ''] ?? { bg: '#F3F4F6', text: '#6B7280' }
                          const statusColor = STATUS_COLORS[sess.status] ?? 'bg-gray-100 text-gray-600'
                          const d = new Date(sess.scheduled_at)
                          const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                          const timeStr = formatTime(sess.scheduled_at)

                          return (
                            <div key={sess.id}
                              className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-800">{dateStr}</span>
                                  <span className="text-gray-500">{timeStr}</span>
                                  <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-semibold capitalize', statusColor)}>
                                    {sess.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                                  <span>{sess.subject_name}</span>
                                  <span>·</span>
                                  <span>{sess.teacher_name}</span>
                                  {sess.room_name && <><span>·</span><span>{sess.room_name}</span></>}
                                  {sess.series_index && <><span>·</span><span>#{sess.series_index}</span></>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setEditingSession(sess)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Edit session">
                                  <Pencil size={12}/>
                                </button>
                                <button
                                  onClick={() => { setDeletingSession(sess); setDeleteSeries(false) }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Delete session">
                                  <Trash2 size={12}/>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Student-level actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <div className="flex-1" />
                    <button
                      onClick={() => setEditing(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors flex items-center gap-1">
                      <Pencil size={12} /> Edit student
                    </button>
                    <button
                      onClick={() => setDeleting(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 font-medium transition-colors flex items-center gap-1">
                      <Trash2 size={12} /> Delete student
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Student edit modal */}
      {editing && (
        <RecurringModal
          student={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); onRefresh() }}
        />
      )}

      {/* Student delete confirm */}
      {deleting && (
        <ConfirmDialog
          title="Delete student"
          message={deleteError || `Are you sure you want to delete ${deleting?.full_name}? This cannot be undone.`}
          onConfirm={confirmDeleteStudent}
          onCancel={() => setDeleting(null)}
          loading={deleteLoading}
        />
      )}

      {/* Session edit modal */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSuccess={() => {
            setEditingSession(null)
            if (expanded) loadSessions(expanded)
          }}
        />
      )}

      {/* Session delete confirm */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500"/>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete session?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(deletingSession.scheduled_at).toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long' })}
                  {' at '}{formatTime(deletingSession.scheduled_at)}
                </p>
              </div>
            </div>

            {deletingSession.series_id && (
              <div className="mb-5 space-y-2">
                {[
                  { v: false, t: 'This session only', d: 'Other sessions in the series stay' },
                  { v: true,  t: 'This & all future sessions', d: `Session ${deletingSession.series_index} onwards deleted` },
                ].map(({ v, t, d }) => (
                  <label key={String(v)} onClick={() => setDeleteSeries(v)}
                    className={cn('flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
                      deleteSeries === v
                        ? (v ? 'border-red-300 bg-red-50' : 'border-gray-900 bg-gray-50')
                        : 'border-gray-200 hover:border-gray-300'
                    )}>
                    <div className={cn('w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
                      deleteSeries === v
                        ? (v ? 'border-red-500 bg-red-500' : 'border-gray-900 bg-gray-900')
                        : 'border-gray-300'
                    )}>
                      {deleteSeries === v && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{d}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setDeletingSession(null); setDeleteSeries(false) }}
                className="btn-secondary flex-1 justify-center"
                disabled={sessDelLoading}>
                Cancel
              </button>
              <button
                onClick={deleteSessionConfirmed}
                disabled={sessDelLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {sessDelLoading ? 'Deleting…' : deleteSeries ? 'Delete sessions' : 'Delete session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
