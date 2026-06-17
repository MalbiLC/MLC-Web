'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createRecurringStudent, updateRecurringStudent } from '@/lib/studentQueries'
import SubjectTeacherPicker, { type SubjectRow } from './SubjectTeacherPicker'
import AvailabilityEditor from '@/components/teachers/AvailabilityEditor'
import type { AvailabilitySlot } from '@/types/teachers'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUBJECTS } from '@/types/students'
import type { Student } from '@/types/students'

interface Props { student?: Student; onClose: () => void; onSuccess: () => void }

const PACKAGES = [
  { value: 'group',        label: 'Group Class'   },
  { value: 'semi_private', label: 'Semi-Private'  },
  { value: 'private',      label: 'Private'       },
  { value: 'online',       label: 'Online'        },
]

export default function RecurringModal({ student, onClose, onSuccess }: Props) {
  const isEdit = !!student
  const [form, setForm] = useState({
    full_name:        student?.full_name        || '',
    date_of_birth:    student?.date_of_birth    || '',
    parent_name:      student?.parent_name      || '',
    parent_contact:   student?.parent_contact   || '',
    package:          student?.package          || 'private',
    additional_notes: student?.additional_notes || '',
  })
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>(
    student?.subject_sessions?.length
      ? student.subject_sessions.map(ss => ({
          subject_id: ss.subject_id,
          sessions:   ss.sessions_remaining,
          location:   ss.location || 'in_person',
        }))
      : [{ subject_id: '', sessions: 0, location: 'in_person' }]
  )
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(student?.availability || [])
  const [allSubjects, setAllSubjects]   = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    createClient()
      .from('subjects').select('id, name').in('name', [...SUBJECTS]).order('name')
      .then(({ data }) => setAllSubjects(data || []))
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
        date_of_birth:    form.date_of_birth    || undefined,
        additional_notes: form.additional_notes || undefined,
        availability,
        subjects: valid.map(s => ({
          subject_id: s.subject_id,
          location:   s.location || 'in_person',
          sessions:   Number(s.sessions),
        })),
      }
      if (isEdit && student) await updateRecurringStudent(student.id, payload)
      else                   await createRecurringStudent(payload)
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Student name <span className="text-red-500">*</span></label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} required/>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input className="input" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/>
          </div>
          <div>
            <label className="label">Package <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PACKAGES.map(p => (
                <button key={p.value} type="button" onClick={() => set('package', p.value)}
                  className={cn('py-2 rounded-lg text-sm font-medium border transition-colors',
                    form.package === p.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}
                  style={form.package === p.value ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <SubjectTeacherPicker
            rows={subjectRows}
            subjects={allSubjects}
            onChange={setSubjectRows}
            label="Subjects & sessions"
          />

          <AvailabilityEditor slots={availability} onChange={setAvailability}/>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Parent&apos;s name</label>
              <input className="input" value={form.parent_name} onChange={e => set('parent_name', e.target.value)}/>
            </div>
            <div>
              <label className="label">Contact number</label>
              <input className="input" inputMode="numeric" value={form.parent_contact}
                onChange={e => set('parent_contact', e.target.value.replace(/\D/g, ''))}/>
            </div>
          </div>
          <div>
            <label className="label">Additional notes</label>
            <textarea className="input resize-none" rows={2} value={form.additional_notes}
              onChange={e => set('additional_notes', e.target.value)}/>
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
