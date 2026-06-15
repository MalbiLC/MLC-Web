'use client'

import { useState } from 'react'
import { deleteTeacher, updateSessionRate, updateSessionLocation } from '@/lib/teacherQueries'
import TeacherModal from './TeacherModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { cn, formatIDR } from '@/lib/utils'
import { DAYS } from '@/types/teachers'
import type { Teacher, TeacherStudentEntry } from '@/types/teachers'
import { ChevronDown, Pencil, Trash2, Phone, Clock, MapPin, Monitor } from 'lucide-react'

interface Props {
  teachers: Teacher[]
  isOwner: boolean
  onRefresh: () => void
}

const empLabel: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time' }
const statusDot = (s: string) => s === 'active' ? 'bg-green-400' : 'bg-gray-300'

function groupSlots(availability: Teacher['availability'] = []) {
  const grouped: Record<number, { start: string; end: string }[]> = {}
  availability.forEach(slot => {
    if (!grouped[slot.day_of_week]) grouped[slot.day_of_week] = []
    grouped[slot.day_of_week].push({ start: slot.slot_start, end: slot.slot_end })
  })
  return grouped
}

// Group students by student_id (one student may have multiple subjects)
function groupStudents(students: TeacherStudentEntry[]) {
  const grouped: Record<string, TeacherStudentEntry[]> = {}
  students.forEach(s => {
    if (!grouped[s.student_id]) grouped[s.student_id] = []
    grouped[s.student_id].push(s)
  })
  return grouped
}

export default function TeacherList({ teachers, isOwner, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [deleting, setDeleting] = useState<Teacher | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [rates, setRates] = useState<Record<string, string>>({})
  const [savingRate, setSavingRate] = useState<string | null>(null)
  const [savingLoc, setSavingLoc] = useState<string | null>(null)

  const toggle = (id: string) => setExpanded(e => e === id ? null : id)

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try { await deleteTeacher(deleting.id); onRefresh(); setDeleting(null) }
    finally { setDeleteLoading(false) }
  }

  const saveRate = async (sessionId: string, baseRate: number | null) => {
    const val = rates[sessionId]
    if (val === undefined) return
    setSavingRate(sessionId)
    try {
      await updateSessionRate(sessionId, val ? parseFloat(val) : null)
      onRefresh()
    } finally { setSavingRate(null) }
  }

  const toggleLocation = async (sessionId: string, current: string) => {
    setSavingLoc(sessionId)
    const next = current === 'in_person' ? 'online' : 'in_person'
    try { await updateSessionLocation(sessionId, next); onRefresh() }
    finally { setSavingLoc(null) }
  }

  if (teachers.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-16 card">No teachers yet.</div>
  }

  return (
    <>
      <div className="space-y-2">
        {teachers.map(t => {
          const isOpen = expanded === t.id
          const grouped = groupSlots(t.availability)
          const sortedDays = Object.keys(grouped).map(Number).sort()
          const studentGroups = groupStudents(t.students || [])
          const studentCount = Object.keys(studentGroups).length

          return (
            <div key={t.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {/* Collapsed row */}
              <button type="button" onClick={() => toggle(t.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', statusDot(t.status))} />
                    <p className="text-sm font-medium text-gray-900">{t.full_name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {empLabel[t.employment_type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 pl-4">
                    {t.phone_number && <span className="flex items-center gap-1"><Phone size={11} />{t.phone_number}</span>}
                    {t.subjects?.length ? <span>{t.subjects.map(s => s.name).join(' · ')}</span> : null}
                  </div>
                </div>

                <div className="hidden sm:block text-xs text-gray-400 shrink-0">
                  {studentCount} student{studentCount !== 1 ? 's' : ''}
                </div>

                <div className="hidden md:flex items-center gap-1 shrink-0">
                  {sortedDays.slice(0, 3).map(day => (
                    <span key={day} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {DAYS[day]?.slice(0, 3)}
                    </span>
                  ))}
                  {sortedDays.length > 3 && <span className="text-xs text-gray-400">+{sortedDays.length - 3}</span>}
                </div>

                <ChevronDown size={16} className={cn('text-gray-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="border-t border-gray-50 px-5 py-4 bg-gray-50/30 space-y-5">

                  {/* Basic info */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                      <p className="text-gray-700 font-mono">{t.phone_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Employment</p>
                      <p className="text-gray-700">{empLabel[t.employment_type]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Status</p>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full', statusDot(t.status))} />
                        <p className="text-gray-700 capitalize">{t.status}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Subjects</p>
                      <div className="flex flex-wrap gap-1">
                        {t.subjects?.map(s => (
                          <span key={s.id} className="badge bg-gray-100 text-gray-700">{s.name}</span>
                        )) || '—'}
                      </div>
                    </div>
                    {/* Rate — owner only */}
                    {isOwner && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">
                          {t.employment_type === 'full_time' ? 'Monthly salary' : 'Base rate / session'}
                        </p>
                        <p className="text-gray-700 font-medium">
                          {t.employment_type === 'full_time'
                            ? (t.monthly_salary ? formatIDR(t.monthly_salary) : '—')
                            : (t.rate_per_session ? formatIDR(t.rate_per_session) : '—')}
                        </p>
                      </div>
                    )}
                    {t.notes && (
                      <div className="col-span-2 sm:col-span-3">
                        <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                        <p className="text-gray-600">{t.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Availability */}
                  {sortedDays.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                        <Clock size={11} /> Weekly availability
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sortedDays.map(day =>
                          grouped[day].map((slot, i) => (
                            <div key={`${day}-${i}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-xs">
                              <span className="font-medium text-gray-700">{DAYS[day]?.slice(0, 3)}</span>
                              <span className="text-gray-400">{slot.start.slice(0,5)} – {slot.end.slice(0,5)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Students — automatically from student_subject_sessions */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">
                      Students ({studentCount})
                      {isOwner && t.employment_type === 'part_time' && (
                        <span className="ml-1 text-gray-300">· Set rate per session for each student</span>
                      )}
                    </p>

                    {studentCount === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No students assigned yet. Add a student and select this teacher.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(studentGroups).map(([studentId, entries]) => {
                          const studentName = entries[0].student_name
                          const studentStatus = entries[0].student_status

                          return (
                            <div key={studentId} className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                              {/* Student header */}
                              <div className="px-3 py-2 border-b border-gray-50 flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-800 flex-1">{studentName}</p>
                                <span className={cn('text-xs px-2 py-0.5 rounded-full',
                                  studentStatus === 'expired' ? 'bg-red-50 text-red-600' :
                                  studentStatus === 'low_session' ? 'bg-amber-50 text-amber-600' :
                                  'bg-teal-50 text-teal-700'
                                )}>
                                  {studentStatus === 'ongoing' ? 'Active' :
                                   studentStatus === 'low_session' ? 'Low sessions' :
                                   studentStatus === 'expired' ? 'Expired' : studentStatus}
                                </span>
                              </div>

                              {/* Per-subject rows */}
                              {entries.map(entry => {
                                const currentRate = rates[entry.session_id] ?? (entry.rate_per_session?.toString() || '')

                                return (
                                  <div key={entry.session_id} className="px-3 py-2.5 flex items-center gap-3 border-b border-gray-50 last:border-0">
                                    {/* Subject */}
                                    <span className="text-sm text-gray-600 w-20 shrink-0">{entry.subject_name}</span>

                                    {/* Sessions remaining */}
                                    <span className={cn(
                                      'text-xs px-2 py-0.5 rounded font-medium shrink-0',
                                      entry.sessions_remaining === 0 ? 'bg-red-50 text-red-600' :
                                      entry.sessions_remaining <= 2 ? 'bg-amber-50 text-amber-600' :
                                      'bg-teal-50 text-teal-700'
                                    )}>
                                      {entry.sessions_remaining} session{entry.sessions_remaining !== 1 ? 's' : ''} left
                                    </span>

                                    {/* Location toggle */}
                                    <button
                                      type="button"
                                      onClick={() => toggleLocation(entry.session_id, entry.location)}
                                      disabled={savingLoc === entry.session_id}
                                      className={cn(
                                        'flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium transition-colors shrink-0',
                                        entry.location === 'online'
                                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
                                      )}>
                                      {entry.location === 'online'
                                        ? <><Monitor size={11} /> Online</>
                                        : <><MapPin size={11} /> In person</>
                                      }
                                    </button>

                                    <div className="flex-1" />

                                    {/* Rate — owner only, part-time only */}
                                    {isOwner && t.employment_type === 'part_time' && (
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                                          <input
                                            type="number" min="0"
                                            placeholder={t.rate_per_session?.toString() || 'Base rate'}
                                            title={t.rate_per_session ? `Base: ${formatIDR(t.rate_per_session)}` : 'Enter rate'}
                                            className="w-28 pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                            value={currentRate}
                                            onChange={e => setRates(r => ({ ...r, [entry.session_id]: e.target.value }))}
                                            onBlur={() => saveRate(entry.session_id, t.rate_per_session || null)}
                                          />
                                        </div>
                                        {savingRate === entry.session_id && (
                                          <span className="text-xs text-gray-400">Saving…</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isOwner && t.employment_type === 'part_time' && studentCount > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        Rate fields auto-save on blur. Leave blank to use base rate
                        ({t.rate_per_session ? formatIDR(t.rate_per_session) : 'not set'}).
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <div className="flex-1" />
                    <button onClick={() => setEditing(t)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors flex items-center gap-1">
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => setDeleting(t)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 font-medium transition-colors flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <TeacherModal teacher={editing} isOwner={isOwner}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); onRefresh() }} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete teacher"
          message={`Are you sure you want to delete ${deleting.full_name}? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          loading={deleteLoading} />
      )}
    </>
  )
}
