'use client'

import { Plus, Trash2 } from 'lucide-react'

export interface SubjectRow {
  subject_id: string
  teacher_id: string
  sessions: number
}

interface Subject { id: string; name: string }
interface Teacher { id: string; full_name: string }

interface Props {
  rows: SubjectRow[]
  subjects: Subject[]
  teachers: Teacher[]
  onChange: (rows: SubjectRow[]) => void
  showSessions?: boolean
  maxRows?: number
  label?: string
}

export default function SubjectTeacherPicker({
  rows, subjects, teachers, onChange,
  showSessions = true, maxRows = 2, label = 'Subjects'
}: Props) {
  const update = (i: number, k: keyof SubjectRow, v: string | number) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const add = () => {
    if (rows.length < maxRows) onChange([...rows, { subject_id: '', teacher_id: '', sessions: 0 }])
  }

  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {rows.length < maxRows && (
          <button type="button" onClick={add}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
            <Plus size={12} /> Add subject
          </button>
        )}
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className={`grid gap-2 items-center ${showSessions ? 'grid-cols-[1fr_1fr_72px_28px]' : 'grid-cols-[1fr_1fr_28px]'}`}>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              value={row.subject_id}
              onChange={e => update(i, 'subject_id', e.target.value)}>
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              value={row.teacher_id}
              onChange={e => update(i, 'teacher_id', e.target.value)}>
              <option value="">Select teacher</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
            {showSessions && (
              <input
                type="number" min="0" placeholder="0"
                className="w-full px-2 py-2 text-sm text-center border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={row.sessions || ''}
                onChange={e => update(i, 'sessions', parseInt(e.target.value) || 0)} />
            )}
            {rows.length > 1 ? (
              <button type="button" onClick={() => remove(i)}
                className="flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            ) : <div />}
          </div>
        ))}
        <div className={`grid gap-2 text-xs text-gray-400 px-0.5 ${showSessions ? 'grid-cols-[1fr_1fr_72px_28px]' : 'grid-cols-[1fr_1fr_28px]'}`}>
          <span>Subject</span>
          <span>Teacher</span>
          {showSessions && <span className="text-center">Sessions</span>}
          <span />
        </div>
      </div>
    </div>
  )
}
