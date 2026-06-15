'use client'

import { useState, useEffect } from 'react'
import { createRecurringStudent, updateRecurringStudent } from '@/lib/studentQueries'
import { createClient } from '@/lib/supabase/client'
import SubjectTeacherPicker, { type SubjectRow } from './SubjectTeacherPicker'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUBJECTS } from '@/types/students'
import type { Student } from '@/types/students'

interface Props {
  student?: Student
  onClose: () => void
  onSuccess: () => void
}

const PACKAGES = [
  { value: 'private', label: 'Private' },
  { value: 'semi_private', label: 'Semi-Private' },
  { value: 'online', label: 'Online' },
]

export default function RecurringModal({ student, onClose, onSuccess }: Props) {
  const isEdit = !!student
  const [form, setForm] = useState({
    full_name: student?.full_name || '',
    date_of_birth: student?.date_of_birth || '',
    parent_name: student?.parent_name || '',
    parent_contact: student?.parent_contact || '',
    package: student?.package || 'private',
    additional_notes: student?.additional_notes || '',
  })
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>(
    student?.subject_sessions?.length
      ? student.subject_sessions.map(ss => ({
          subject_id: ss.subject_id,
          teacher_id: ss.teacher_id || '',
          sessions: ss.sessions_remaining,
        }))
      : [{ subject_id: '', teacher_id: '', sessions: 0 }]
  )
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string }[]>([])
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('subjects').select('id, name').in('name', [...SUBJECTS]).order('name'),
      sb.from('teachers').select('id, full_name').eq('status', 'active').order('full_name'),
    ]).then(([{ data: s }, { data: t }]) => {
      setAllSubjects(s || [])
      setTeachers(t || [])
    })
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Student name is required.'); return }
    const valid = subjectRows.filter(s => s.subject_id)
    if (valid.length === 0) { setError('Add at least one subject.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        date_of_birth: form.date_of_birth || undefined,
        additional_notes: form.additional_notes || undefined,
        subjects: valid.map(s => ({
          subject_id: s.subject_id,
          teacher_id: s.teacher_id || undefined,
          sessions: Number(s.sessions),
        })),
      }
      if (isEdit && student) {
        await updateRecurringStudent(student.id, payload)
      } else {
        await createRecurringStudent(payload)
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit recurring student' : 'Add recurring student'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Student name <span className="text-red-500">*</span></label>
            <input className="input" placeholder="Full name" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
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
                    form.package === p.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}>{p.label}</button>
              ))}
            </div>
          </div>

          <SubjectTeacherPicker
            rows={subjectRows}
            subjects={allSubjects}
            teachers={teachers}
            onChange={setSubjectRows}
            showSessions={true}
            maxRows={2}
            label="Subjects & sessions (max 2)"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Parent&apos;s name</label>
              <input className="input" placeholder="Parent / guardian" value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Contact number</label>
              <input className="input" inputMode="numeric" placeholder="08xx xxxx xxxx"
                value={form.parent_contact} onChange={e => set('parent_contact', e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
          <div>
            <label className="label">Additional notes</label>
            <textarea className="input resize-none" rows={3} placeholder="Any notes about this student…"
              value={form.additional_notes} onChange={e => set('additional_notes', e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
