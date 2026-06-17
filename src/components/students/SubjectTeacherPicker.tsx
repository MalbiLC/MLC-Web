'use client'

import { Plus, Trash2 } from 'lucide-react'

export interface SubjectRow {
  subject_id: string
  sessions: number
  location: string
}

interface Subject { id: string; name: string }

interface Props {
  rows: SubjectRow[]
  subjects: Subject[]
  onChange: (rows: SubjectRow[]) => void
  label?: string
}

export default function SubjectTeacherPicker({ rows, subjects, onChange, label = 'Subjects' }: Props) {
  const update = (i: number, k: keyof SubjectRow, v: string | number) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const add = () => onChange([...rows, { subject_id: '', sessions: 0, location: 'in_person' }])
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button type="button" onClick={add}
          className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
          <Plus size={12} /> Add subject
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="space-y-1.5">
            <div className="grid grid-cols-[1fr_72px_28px] gap-2 items-center">
              <select
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={row.subject_id}
                onChange={e => update(i, 'subject_id', e.target.value)}>
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input
                type="number" min="0" placeholder="0"
                className="w-full px-2 py-2 text-sm text-center border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={row.sessions || ''}
                onChange={e => update(i, 'sessions', parseInt(e.target.value) || 0)} />
              {rows.length > 1 ? (
                <button type="button" onClick={() => remove(i)}
                  className="flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              ) : <div />}
            </div>
            {/* Location toggle */}
            <div className="flex gap-1.5 ml-0.5">
              {['in_person', 'online'].map(loc => (
                <button key={loc} type="button"
                  onClick={() => update(i, 'location', loc)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    row.location === loc
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}>
                  {loc === 'in_person' ? 'In person' : 'Online'}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_72px_28px] gap-2 text-xs text-gray-400 px-0.5">
          <span>Subject</span>
          <span className="text-center">Sessions</span>
          <span />
        </div>
      </div>
    </div>
  )
}
