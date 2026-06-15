'use client'

import { useState } from 'react'
import { formatDate, cn } from '@/lib/utils'
import { updateStudentStatus, deleteStudent } from '@/lib/studentQueries'
import StatusBadge from './StatusBadge'
import EnrollModal from './EnrollModal'
import PotentialModal from './PotentialModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Student } from '@/types/students'
import { CalendarClock, ChevronDown, ChevronUp, Pencil, Trash2, UserPlus } from 'lucide-react'

interface Props { students: Student[]; onRefresh: () => void }

export default function PotentialList({ students, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState<Student | null>(null)
  const [editing, setEditing] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const toggle = (id: string) => setExpanded(e => e === id ? null : id)

  const markTrialDone = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setUpdating(id)
    try { await updateStudentStatus(id, 'potential_trial_done'); onRefresh() }
    finally { setUpdating(null) }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try { await deleteStudent(deleting.id); onRefresh(); setDeleting(null) }
    finally { setDeleteLoading(false) }
  }

  if (students.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-16 card">No potential students yet.</div>
  }

  return (
    <>
      <div className="space-y-2">
        {students.map(s => {
          const isOpen = expanded === s.id
          const trials = s.trial_subject_teachers || []

          return (
            <div key={s.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {/* Collapsed row */}
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors">

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {s.parent_name && <span>{s.parent_name}</span>}
                    {s.parent_contact && <span>· {s.parent_contact}</span>}
                    {s.reached_out_at && <span>· Reached out {formatDate(s.reached_out_at)}</span>}
                  </div>
                </div>

                {/* Interested subjects pills */}
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  {s.interested_subjects
                    ? s.interested_subjects.split(',').map(sub => (
                        <span key={sub.trim()} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{sub.trim()}</span>
                      ))
                    : <span className="text-xs text-gray-300">No subjects</span>
                  }
                </div>

                {/* Follow-up date */}
                {s.status === 'potential_trial_done' && s.followup_date && (
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-amber-600 shrink-0">
                    <CalendarClock size={12} /> Follow up {formatDate(s.followup_date)}
                  </div>
                )}

                <ChevronDown size={16} className={cn('text-gray-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-gray-50 px-5 py-4 bg-gray-50/30">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Parent</p>
                      <p className="text-gray-700">{s.parent_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Contact</p>
                      <p className="text-gray-700 font-mono">{s.parent_contact || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Reached out</p>
                      <p className="text-gray-700">{s.reached_out_at ? formatDate(s.reached_out_at) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Follow-up date</p>
                      <p className={cn('text-gray-700', s.followup_date ? 'text-amber-600' : '')}>
                        {s.followup_date ? formatDate(s.followup_date) : '—'}
                      </p>
                    </div>

                    {trials.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400 mb-1.5">Trial subjects &amp; teachers</p>
                        <div className="flex flex-wrap gap-2">
                          {trials.map((t, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs">
                              <span className="font-medium text-gray-700">{t.subject}</span>
                              {t.teacher_name && <><span className="text-gray-300">·</span><span className="text-gray-500">{t.teacher_name}</span></>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.potential_notes && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                        <p className="text-gray-600 text-sm">{s.potential_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    {s.status === 'potential_no_trial' && (
                      <button
                        onClick={e => markTrialDone(e, s.id)}
                        disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 font-medium transition-colors disabled:opacity-50">
                        {updating === s.id ? 'Saving…' : '✓ Mark trial done'}
                      </button>
                    )}
                    <button
                      onClick={() => setEnrolling(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 font-medium transition-colors flex items-center gap-1">
                      <UserPlus size={12} /> Enroll
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => setEditing(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors flex items-center gap-1">
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleting(s)}
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

      {enrolling && <EnrollModal student={enrolling} onClose={() => setEnrolling(null)} onSuccess={() => { setEnrolling(null); onRefresh() }} />}
      {editing && <PotentialModal student={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); onRefresh() }} />}
      {deleting && (
        <ConfirmDialog
          title="Delete student"
          message={`Are you sure you want to delete ${deleting.full_name}? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          loading={deleteLoading}
        />
      )}
    </>
  )
}
