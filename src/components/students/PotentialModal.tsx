'use client'

import { useState, useEffect } from 'react'
import { createPotentialStudent, updatePotentialStudent } from '@/lib/studentQueries'
import { createClient } from '@/lib/supabase/client'
import SubjectTeacherPicker, { type SubjectRow } from './SubjectTeacherPicker'
import { X } from 'lucide-react'
import AvailabilityEditor from '@/components/teachers/AvailabilityEditor'
import type { AvailabilitySlot } from '@/types/teachers'
import { SUBJECTS } from '@/types/students'
import { cn } from '@/lib/utils'
import type { Student } from '@/types/students'

interface Props {
  student?: Student
  onClose: () => void
  onSuccess: () => void
}

export default function PotentialModal({ student, onClose, onSuccess }: Props) {
  const isEdit = !!student
  const [form, setForm] = useState({
    full_name: student?.full_name || '',
    parent_name: student?.parent_name || '',
    parent_contact: student?.parent_contact || '',
    reached_out_at: student?.reached_out_at || new Date().toISOString().split('T')[0],
    potential_notes: student?.potential_notes || '',
  })
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    student?.interested_subjects ? student.interested_subjects.split(',').map(s => s.trim()).filter(Boolean) : []
  )
  const [trialRows, setTrialRows] = useState<SubjectRow[]>(
    student?.trial_subject_teachers?.length
      ? student.trial_subject_teachers.map(t => ({ subject_id: t.subject, sessions: 0, location: 'in_person' }))
      : [{ subject_id: '', sessions: 0, location: 'in_person' }]
  )
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(
    student?.availability || []
  )
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.from('subjects').select('id, name').in('name', [...SUBJECTS]).order('name')
      .then(({ data: s }) => setAllSubjects(s || []))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const toggleSubject = (s: string) =>
    setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Student name is required.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        interested_subjects: selectedSubjects.join(', '),
        availability,
        trial_subject_teachers: trialRows
          .filter(r => r.subject_id)
          .map(r => ({
            subject: r.subject_id,
            teacher_id: '',
            teacher_name: '',
          })),
      }
      if (isEdit && student) {
        await updatePotentialStudent(student.id, payload)
      } else {
        await createPotentialStudent(payload)
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit potential student' : 'Add potential student'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Student name <span className="text-red-500">*</span></label>
            <input className="input" placeholder="Full name" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Parent&apos;s name</label>
              <input className="input" placeholder="Parent / guardian" value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Contact number</label>
              <input className="input" placeholder="08xx xxxx xxxx" inputMode="numeric"
                value={form.parent_contact} onChange={e => set('parent_contact', e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
          <div>
            <label className="label">Date reached out</label>
            <input className="input" type="date" value={form.reached_out_at} onChange={e => set('reached_out_at', e.target.value)} />
          </div>
          <div>
            <label className="label">Interested subjects</label>
            <div className="flex gap-2 flex-wrap mt-1">
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

          <SubjectTeacherPicker
            rows={trialRows}
            subjects={allSubjects}
            onChange={setTrialRows}
            label="Trial subjects"
          />

          <AvailabilityEditor slots={availability} onChange={setAvailability} />

          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={3}
              placeholder="Any notes about this student…"
              value={form.potential_notes} onChange={e => set('potential_notes', e.target.value)} />
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
