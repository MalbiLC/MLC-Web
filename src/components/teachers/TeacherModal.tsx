'use client'

import { useState, useEffect } from 'react'
import { createTeacher, updateTeacher } from '@/lib/teacherQueries'
import AvailabilityEditor from './AvailabilityEditor'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUBJECTS } from '@/types/students'
import type { Teacher, AvailabilitySlot } from '@/types/teachers'

interface Props {
  teacher?: Teacher
  isOwner: boolean
  onClose: () => void
  onSuccess: () => void
}

const EMP_TYPES = [
  { value: 'part_time', label: 'Part-time' },
  { value: 'full_time', label: 'Full-time' },
]

export default function TeacherModal({ teacher, isOwner, onClose, onSuccess }: Props) {
  const isEdit = !!teacher
  const [form, setForm] = useState({
    full_name: teacher?.full_name || '',
    phone_number: teacher?.phone_number || '',
    employment_type: teacher?.employment_type || 'part_time',
    status: teacher?.status || 'active',
    rate_per_session: teacher?.rate_per_session?.toString() || '',
    monthly_salary: teacher?.monthly_salary?.toString() || '',
    notes: teacher?.notes || '',
  })
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    teacher?.subjects?.map(s => s.name) || []
  )
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(
    teacher?.availability || []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const toggleSubject = (s: string) =>
    setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Teacher name is required.'); return }
    if (selectedSubjects.length === 0) { setError('Select at least one subject.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        full_name: form.full_name,
        phone_number: form.phone_number || undefined,
        employment_type: form.employment_type,
        status: form.status,
        rate_per_session: form.rate_per_session ? parseFloat(form.rate_per_session) : undefined,
        monthly_salary: form.monthly_salary ? parseFloat(form.monthly_salary) : undefined,
        notes: form.notes || undefined,
        subjects: selectedSubjects,
        availability,
      }
      if (isEdit && teacher) {
        await updateTeacher(teacher.id, payload)
      } else {
        await createTeacher(payload)
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setSaving(false) }
  }

  const isFullTime = form.employment_type === 'full_time'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit teacher' : 'Add teacher'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full name <span className="text-red-500">*</span></label>
              <input className="input" placeholder="Teacher's full name"
                value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input className="input" placeholder="08xx xxxx xxxx" inputMode="numeric"
                value={form.phone_number}
                onChange={e => set('phone_number', e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Employment type */}
          <div>
            <label className="label">Employment type</label>
            <div className="flex gap-2">
              {EMP_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => set('employment_type', t.value)}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    form.employment_type === t.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Rate — owner only */}
          {isOwner && (
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Compensation — visible to owner only
              </p>
              {!isFullTime ? (
                <div>
                  <label className="label">Base rate per session (Rp)</label>
                  <input className="input" type="number" min="0" placeholder="e.g. 75000"
                    value={form.rate_per_session}
                    onChange={e => set('rate_per_session', e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">
                    Individual student rates can be set in the expanded view.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="label">Monthly salary (Rp)</label>
                  <input className="input" type="number" min="0" placeholder="e.g. 5000000"
                    value={form.monthly_salary}
                    onChange={e => set('monthly_salary', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Subjects */}
          <div>
            <label className="label">Subjects taught <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SUBJECTS.map(s => (
                <button key={s} type="button" onClick={() => toggleSubject(s)}
                  className={cn('px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    selectedSubjects.includes(s)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}>{s}</button>
              ))}
            </div>
          </div>

          {/* Availability */}
          <AvailabilityEditor slots={availability} onChange={setAvailability} />

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2}
              placeholder="Any notes about this teacher…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
