'use client'

import { useState } from 'react'
import { formatDate, cn } from '@/lib/utils'
import { deleteStudent } from '@/lib/studentQueries'
import StatusBadge from './StatusBadge'
import RecurringModal from './RecurringModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Student } from '@/types/students'
import { ChevronDown, Pencil, Trash2, BookOpen } from 'lucide-react'

interface Props { students: Student[]; onRefresh: () => void }

const packageLabel: Record<string, string> = {
  group: 'Group Class', private: 'Private', semi_private: 'Semi-Private', online: 'Online',
}

export default function RecurringList({ students, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const toggle = (id: string) => setExpanded(e => e === id ? null : id)

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try { await deleteStudent(deleting.id); onRefresh(); setDeleting(null) }
    finally { setDeleteLoading(false) }
  }

  if (students.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-16 card">No recurring students yet.</div>
  }

  return (
    <>
      <div className="space-y-2">
        {students.map(s => {
          const isOpen = expanded === s.id
          const sessions = s.subject_sessions || []
          const totalSessions = sessions.reduce((a, ss) => a + ss.sessions_remaining, 0)
          const minSessions = sessions.length > 0 ? Math.min(...sessions.map(ss => ss.sessions_remaining)) : 0

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
                    {sessions.map(ss => (
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

                {/* Session summary */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                  <BookOpen size={12} />
                  <span>{totalSessions} session{totalSessions !== 1 ? 's' : ''} total</span>
                </div>

                <ChevronDown size={16} className={cn('text-gray-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-gray-50 px-5 py-4 bg-gray-50/30">
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

                    {/* Subjects detail */}
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-2">Subjects</p>
                      <div className="space-y-2">
                        {sessions.map(ss => (
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

                  {/* Actions */}
                  {minSessions <= 2 && minSessions >= 0 && (
                    <div className={cn(
                      'px-3 py-2 rounded-lg text-xs font-medium mb-3',
                      minSessions === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {minSessions === 0 ? '⚠ Sessions expired — contact parent to renew' : `⚠ Low sessions — only ${minSessions} left`}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
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

      {editing && <RecurringModal student={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); onRefresh() }} />}
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
