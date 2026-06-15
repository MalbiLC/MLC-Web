'use client'

import { useState } from 'react'
import { formatDate, cn } from '@/lib/utils'
import { updateStudentStatus } from '@/lib/studentQueries'
import StatusBadge from './StatusBadge'
import EnrollModal from './EnrollModal'
import type { Student } from '@/types/students'
import { CalendarClock, UserPlus } from 'lucide-react'

interface Props { students: Student[]; onRefresh: () => void }

export default function PotentialTable({ students, onRefresh }: Props) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState<Student | null>(null)

  const markTrialDone = async (id: string) => {
    setUpdating(id)
    try { await updateStudentStatus(id, 'potential_trial_done'); onRefresh() }
    finally { setUpdating(null) }
  }

  if (students.length === 0) {
    return <div className="table-container"><div className="text-center text-gray-400 text-sm py-16">No potential students yet.</div></div>
  }

  return (
    <>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Parent</th>
              <th>Contact</th>
              <th>Reached out</th>
              <th>Interested in</th>
              <th>Trial teacher</th>
              <th>Status</th>
              <th>Follow-up</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td><p className="font-medium text-gray-900">{s.full_name}</p></td>
                <td>{s.parent_name || '—'}</td>
                <td className="font-mono text-sm">{s.parent_contact || '—'}</td>
                <td>{s.reached_out_at ? formatDate(s.reached_out_at) : '—'}</td>
                <td>
                  {s.interested_subjects ? (
                    <div className="flex flex-wrap gap-1">
                      {s.interested_subjects.split(',').map(sub => (
                        <span key={sub.trim()} className="badge bg-gray-100 text-gray-600">{sub.trim()}</span>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td>
                  {s.trial_teacher ? (
                    <span className="text-sm text-gray-700">{s.trial_teacher.full_name}</span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td><StatusBadge status={s.status} /></td>
                <td>
                  {s.status === 'potential_trial_done' && s.followup_date ? (
                    <div className="flex items-center gap-1.5 text-sm text-amber-600">
                      <CalendarClock size={13} />{formatDate(s.followup_date)}
                    </div>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {s.status === 'potential_no_trial' && (
                      <button
                        onClick={() => markTrialDone(s.id)}
                        disabled={updating === s.id}
                        className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap',
                          'border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50')}>
                        {updating === s.id ? 'Saving…' : 'Mark trial done'}
                      </button>
                    )}
                    <button
                      onClick={() => setEnrolling(s)}
                      className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap flex items-center gap-1',
                        'border-teal-200 text-teal-700 hover:bg-teal-50')}>
                      <UserPlus size={13} /> Enroll
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enrolling && (
        <EnrollModal
          student={enrolling}
          onClose={() => setEnrolling(null)}
          onSuccess={() => { setEnrolling(null); onRefresh() }}
        />
      )}
    </>
  )
}
