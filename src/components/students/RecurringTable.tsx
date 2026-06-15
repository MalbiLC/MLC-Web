'use client'

import { formatDate, cn } from '@/lib/utils'
import StatusBadge from './StatusBadge'
import type { Student } from '@/types/students'

interface Props {
  students: Student[]
}

const packageLabel: Record<string, string> = {
  private: 'Private',
  semi_private: 'Semi-Private',
  online: 'Online',
}

export default function RecurringTable({ students }: Props) {
  if (students.length === 0) {
    return (
      <div className="table-container">
        <div className="text-center text-gray-400 text-sm py-16">No recurring students yet.</div>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Package</th>
            <th>Subjects &amp; sessions</th>
            <th>Parent</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const sessions = s.subject_sessions || []
            const minSessions = sessions.length > 0 ? Math.min(...sessions.map(ss => ss.sessions_remaining)) : 0

            return (
              <tr key={s.id}>
                <td>
                  <div>
                    <p className="font-medium text-gray-900">{s.full_name}</p>
                    {s.date_of_birth && (
                      <p className="text-xs text-gray-400">{formatDate(s.date_of_birth)}</p>
                    )}
                  </div>
                </td>
                <td>
                  {s.package ? (
                    <span className="badge bg-gray-100 text-gray-700">{packageLabel[s.package]}</span>
                  ) : '—'}
                </td>
                <td>
                  {sessions.length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <div className="space-y-1">
                      {sessions.map(ss => (
                        <div key={ss.id} className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{ss.subject?.name}</span>
                          {ss.teacher && (
                            <span className="text-xs text-gray-400">· {ss.teacher.full_name}</span>
                          )}
                          <span className={cn(
                            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
                            ss.sessions_remaining === 0
                              ? 'bg-red-50 text-red-600'
                              : ss.sessions_remaining <= 2
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-teal-50 text-teal-700'
                          )}>
                            {ss.sessions_remaining} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>{s.parent_name || '—'}</td>
                <td className="font-mono text-sm">{s.parent_contact || '—'}</td>
                <td>
                  <div className="space-y-1">
                    <StatusBadge status={s.status} />
                    {s.status === 'low_session' && (
                      <p className="text-xs text-amber-600">{minSessions} session{minSessions !== 1 ? 's' : ''} left</p>
                    )}
                  </div>
                </td>
                <td>
                  {s.additional_notes ? (
                    <p className="text-xs text-gray-500 max-w-[160px] truncate" title={s.additional_notes}>
                      {s.additional_notes}
                    </p>
                  ) : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
