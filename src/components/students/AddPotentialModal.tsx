'use client'

import { useState, useEffect } from 'react'
import { createPotentialStudent } from '@/lib/studentQueries'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUBJECTS = ['Math', 'English', 'Science', 'Mandarin']

interface Props { onClose: () => void; onSuccess: () => void }

export default function AddPotentialModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    full_name: '', parent_name: '', parent_contact: '',
    reached_out_at: new Date().toISOString().split('T')[0],
    trial_teacher_id: '',
  })
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().from('teachers').select('id, full_name').eq('status', 'active').order('full_name')
      .then(({ data }) => setTeachers(data || []))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const toggleSubject = (s: string) => {
    setSelectedSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Student name is required.'); return }
    setSaving(true); setError('')
    try {
      await createPotentialStudent({
        ...form,
        interested_subjects: selectedSubjects.join(', '),
        trial_teacher_id: form.trial_teacher_id || undefined,
      })
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold">Add potential student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Student name <span className="text-red-500">*</span></label>
            <input className="input" placeholder="Full name" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Parent&apos;s name</label>
            <input className="input" placeholder="Parent / guardian name" value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Contact number</label>
            <input className="input" placeholder="08xx xxxx xxxx" inputMode="numeric"
              value={form.parent_contact}
              onChange={e => set('parent_contact', e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className="label">Date reached out</label>
            <input className="input" type="date" value={form.reached_out_at} onChange={e => set('reached_out_at', e.target.value)} />
          </div>
          <div>
            <label className="label">Interested subjects</label>
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
          <div>
            <label className="label">Trial teacher</label>
            <select className="input" value={form.trial_teacher_id} onChange={e => set('trial_teacher_id', e.target.value)}>
              <option value="">Select teacher (optional)</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'Saving…' : 'Add student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
