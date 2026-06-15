'use client'

import { useState, useEffect } from 'react'
import { enrollStudent } from '@/lib/studentQueries'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Student } from '@/types/students'

interface SubjectRow { subject_id: string; teacher_id: string; sessions: number }
interface Props { student: Student; onClose: () => void; onSuccess: () => void }

const PACKAGES = [
  { value: 'private', label: 'Private' },
  { value: 'semi_private', label: 'Semi-Private' },
  { value: 'online', label: 'Online' },
]

export default function EnrollModal({ student, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    full_name: student.full_name,
    date_of_birth: student.date_of_birth || '',
    parent_name: student.parent_name || '',
    parent_contact: student.parent_contact || '',
    package: 'private',
    additional_notes: '',
  })
  const [subjects, setSubjects] = useState<SubjectRow[]>([{ subject_id: '', teacher_id: '', sessions: 0 }])
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string }[]>([])
  const [allTeachers, setAllTeachers] = useState<{ id: string; full_name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('subjects').select('id, name').order('name'),
      sb.from('teachers').select('id, full_name').eq('status', 'active').order('full_name'),
    ]).then(([{ data: s }, { data: t }]) => {
      setAllSubjects(s || [])
      setAllTeachers(t || [])
    })
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const updateSubject = (i: number, k: keyof SubjectRow, v: string | number) =>
    setSubjects(rows => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const addRow = () => setSubjects(r => [...r, { subject_id: '', teacher_id: '', sessions: 0 }])
  const removeRow = (i: number) => setSubjects(r => r.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valid = subjects.filter(s => s.subject_id)
    if (valid.length === 0) { setError('Add at least one subject.'); return }
    setSaving(true); setError('')
    try {
      await enrollStudent(student.id, {
        ...form,
        date_of_birth: form.date_of_birth || undefined,
        additional_notes: form.additional_notes || undefined,
        subjects: valid.map(s => ({
          subject_id: s.subject_id,
          teacher_id: s.teacher_id || undefined,
          sessions: Number(s.sessions),
        })),
      })
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-semibold">Enroll student</h2>
            <p className="text-xs text-gray-400 mt-0.5">Converting {student.full_name} to recurring</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Pre-filled from potential record */}
          <div>
            <label className="label">Student name</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input className="input" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
          </div>
          <div>
            <label className="label">Package <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {PACKAGES.map(p => (
                <button key={p.value} type="button" onClick={() => set('package', p.value)}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    form.package === p.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Subjects */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Subjects &amp; sessions <span className="text-red-500">*</span></label>
              <button type="button" onClick={addRow} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1">
                <Plus size={13} /> Add subject
              </button>
            </div>
            <div className="space-y-2">
              {subjects.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                  <select className="input" value={row.subject_id} onChange={e => updateSubject(i, 'subject_id', e.target.value)}>
                    <option value="">Subject</option>
                    {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select className="input" value={row.teacher_id} onChange={e => updateSubject(i, 'teacher_id', e.target.value)}>
                    <option value="">Teacher</option>
                    {allTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                  <input className="input text-center" type="number" min="0" placeholder="0"
                    value={row.sessions || ''} onChange={e => updateSubject(i, 'sessions', parseInt(e.target.value) || 0)} />
                  {subjects.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 flex justify-center">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 text-xs text-gray-400 px-1">
                <span>Subject</span><span>Teacher</span><span className="text-center">Sessions</span><span />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Parent&apos;s name</label>
              <input className="input" value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Contact number</label>
              <input className="input" inputMode="numeric" value={form.parent_contact}
                onChange={e => set('parent_contact', e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <div>
            <label className="label">Additional notes</label>
            <textarea className="input resize-none" rows={3} placeholder="Any notes…"
              value={form.additional_notes} onChange={e => set('additional_notes', e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center bg-teal-700 hover:bg-teal-800" disabled={saving}>
              {saving ? 'Enrolling…' : 'Enroll student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
