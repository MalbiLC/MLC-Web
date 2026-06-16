'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { X, Check, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import type { ClassType } from '@/types/index'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLASS_TYPES: { value: ClassType; label: string; duration: number; max: number }[] = [
  { value: 'group',          label: 'Group Class',    duration: 75, max: 6 },
  { value: 'semi_private',   label: 'Semi-Private',   duration: 75, max: 3 },
  { value: 'private',        label: 'Private',        duration: 60, max: 1 },
  { value: 'private_online', label: 'Private Online', duration: 60, max: 1 },
]

const SUBJECTS    = ['Math', 'Science', 'English', 'Mandarin']
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface Props { onClose: () => void; onSuccess: () => void }

// Generate all session dates given a start, selected weekdays, and total count
function buildDates(startISO: string, days: number[], total: number): Date[] {
  if (!startISO || days.length === 0 || total <= 0) return []
  const out: Date[] = []
  const start = new Date(startISO + 'T00:00:00')
  const sorted = [...days].sort((a, b) => a - b)
  let week = 0

  while (out.length < total) {
    for (const d of sorted) {
      if (out.length >= total) break
      const diff = ((d - start.getDay() + 7) % 7) + week * 7
      if (diff === 0 && week === 0) {
        // same day as start — include
        out.push(new Date(start))
      } else if (diff > 0 || week > 0) {
        const dt = new Date(start)
        dt.setDate(dt.getDate() + ((d - start.getDay() + 7) % 7) + week * 7)
        if (dt >= start) out.push(dt)
      }
    }
    week++
    if (week > 104) break // 2-year safety
  }

  return out.sort((a, b) => a.getTime() - b.getTime()).slice(0, total)
}

export default function NewSessionModal({ onClose, onSuccess }: Props) {
  const sb = createClient()

  // Form fields
  const [className,  setClassName]  = useState('')
  const [classType,  setClassType]  = useState<ClassType | null>(null)
  const [subject,    setSubject]    = useState('')
  const [teacherId,  setTeacherId]  = useState('')
  const [roomId,     setRoomId]     = useState('')
  const [students,   setStudents]   = useState<string[]>([])
  const [days,       setDays]       = useState<number[]>([])
  const [startDate,  setStartDate]  = useState(new Date().toISOString().split('T')[0])
  const [time,       setTime]       = useState('14:00')
  const [total,      setTotal]      = useState<number | null>(null)
  const [notes,      setNotes]      = useState('')

  // Data from DB
  const [allTeachers, setAllTeachers] = useState<any[]>([])
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [allRooms,    setAllRooms]    = useState<any[]>([])

  // UI
  const [preview,      setPreview]      = useState<Date[]>([])
  const [showAll,      setShowAll]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const cfg = CLASS_TYPES.find(c => c.value === classType)

  useEffect(() => {
    Promise.all([
      sb.from('teachers').select('id, full_name').eq('status','active').order('full_name'),
      sb.from('students')
        .select('id, full_name, subs:student_subject_sessions(subject:subjects(name), sessions_remaining)')
        .eq('student_type','current').order('full_name'),
      sb.from('rooms').select('*').order('type').order('name'),
    ]).then(([{ data: t }, { data: s }, { data: r }]) => {
      setAllTeachers(t || [])
      setAllStudents(s || [])
      setAllRooms(r || [])
    })
  }, [])

  // Auto-set total from first student's subject sessions
  useEffect(() => {
    if (!subject || students.length === 0) return
    const st = allStudents.find(s => s.id === students[0])
    const ss = st?.subs?.find((x: any) => x.subject?.name === subject)
    if (ss?.sessions_remaining) setTotal(ss.sessions_remaining)
  }, [subject, students, allStudents])

  // Auto-detect class type from count
  useEffect(() => {
    if (classType) return
    if (students.length === 1) setClassType('private')
    else if (students.length <= 3) setClassType('semi_private')
    else if (students.length > 3) setClassType('group')
  }, [students.length, classType])

  // Rebuild preview dates
  useEffect(() => {
    setPreview(buildDates(startDate, days, total ?? 0))
  }, [startDate, days, total])

  const toggleDay = (d: number) =>
    setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort())

  const toggleStudent = (id: string) => {
    setStudents(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (cfg && prev.length >= cfg.max) return prev
      return [...prev, id]
    })
  }

  const eligible = subject
    ? allStudents.filter(s =>
        s.subs?.some((x: any) => x.subject?.name === subject && x.sessions_remaining > 0)
      )
    : allStudents

  const filteredRooms = allRooms.filter(r =>
    classType === 'private_online' ? r.type === 'zoom' : r.type === 'physical'
  )

  const handleSave = async () => {
    setError('')
    if (!classType)             return setError('Select a class type.')
    if (!subject)               return setError('Select a subject.')
    if (!teacherId)             return setError('Select a teacher.')
    if (students.length === 0)  return setError('Add at least one student.')
    if (days.length === 0)      return setError('Select at least one day of the week.')
    if (!total || total <= 0)   return setError('Session count must be at least 1.')
    if (preview.length === 0)   return setError('No dates generated — check start date.')

    setSaving(true)
    try {
      // Get subject id
      const { data: subj, error: subjErr } = await sb
        .from('subjects').select('id').eq('name', subject).single()
      if (subjErr) throw new Error(`Subject not found: ${subjErr.message}`)

      const seriesId = crypto.randomUUID()
      const [hh, mm] = time.split(':').map(Number)

      const toInsert = preview.map((date, idx) => {
        const dt = new Date(date)
        dt.setHours(hh, mm, 0, 0)
        return {
          class_name:       className || null,
          class_type:       classType,
          teacher_id:       teacherId,
          room_id:          roomId    || null,
          subject_id:       subj.id,
          scheduled_at:     dt.toISOString(),
          duration_minutes: cfg!.duration,
          max_students:     cfg!.max,
          status:           'scheduled',
          series_id:        seriesId,
          series_index:     idx + 1,
          notes:            notes || null,
        }
      })

      const { data: created, error: insErr } = await sb
        .from('sessions')
        .insert(toInsert)
        .select('id')

      if (insErr) throw new Error(`Could not save sessions: ${insErr.message}`)
      if (!created || created.length === 0) throw new Error('Insert returned no rows — check RLS policies.')

      // Link students to every session
      const links = created.flatMap(sess =>
        students.map(sid => ({ session_id: sess.id, student_id: sid }))
      )
      const { error: linkErr } = await sb.from('session_students').insert(links)
      if (linkErr) throw new Error(`Could not link students: ${linkErr.message}`)

      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const visiblePreview = showAll ? preview : preview.slice(0, 5)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold">New session series</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── LEFT ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Session details</p>

              <div>
                <label className="label">Class name <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
                <input className="input" placeholder="e.g. Math Group A"
                  value={className} onChange={e => setClassName(e.target.value)}/>
              </div>

              <div>
                <label className="label">Subject <span className="text-red-500">*</span></label>
                <select className="input" value={subject}
                  onChange={e => { setSubject(e.target.value); setStudents([]); setTotal(null) }}>
                  <option value="">Select subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Class type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {CLASS_TYPES.map(ct => (
                    <button key={ct.value} type="button"
                      onClick={() => { setClassType(ct.value); setStudents([]) }}
                      className={cn('flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors',
                        classType === ct.value
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={classType === ct.value ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      <span className="text-sm font-medium">{ct.label}</span>
                      <span className={cn('text-xs', classType === ct.value ? 'text-white/70' : 'text-gray-400')}>
                        {ct.duration}m · max {ct.max}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Teacher <span className="text-red-500">*</span></label>
                <select className="input" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
                  <option value="">Select teacher</option>
                  {allTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Room <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
                <select className="input" value={roomId} onChange={e => setRoomId(e.target.value)}>
                  <option value="">Select room</option>
                  {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Notes <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
                <textarea className="input resize-none" rows={2} placeholder="Notes for all sessions…"
                  value={notes} onChange={e => setNotes(e.target.value)}/>
              </div>
            </div>

            {/* ── RIGHT ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Students &amp; schedule</p>

              {/* Students */}
              <div>
                <label className="label">
                  Students <span className="text-red-500">*</span>
                  {cfg && <span className="text-gray-400 text-xs font-normal ml-1">— max {cfg.max}</span>}
                </label>
                {!subject ? (
                  <p className="text-xs text-gray-400">Select a subject first</p>
                ) : eligible.length === 0 ? (
                  <p className="text-xs text-gray-400">No students with {subject} sessions remaining</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {eligible.map(s => {
                      const sel = students.includes(s.id)
                      const atMax = !sel && cfg != null && students.length >= cfg.max
                      const ss = s.subs?.find((x: any) => x.subject?.name === subject)
                      return (
                        <button key={s.id} type="button"
                          onClick={() => !atMax && toggleStudent(s.id)}
                          disabled={atMax}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left text-sm transition-colors',
                            sel   ? 'text-white border-transparent' : 'bg-white border-gray-100 hover:border-gray-300',
                            atMax ? 'opacity-40 cursor-not-allowed' : ''
                          )}
                          style={sel ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                          <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                            sel ? 'bg-white border-white' : 'border-gray-300'
                          )}>
                            {sel && <Check size={9} className="text-green-700" strokeWidth={3}/>}
                          </div>
                          <span className="flex-1 font-medium truncate">{s.full_name}</span>
                          {ss && <span className={cn('text-xs shrink-0', sel ? 'text-white/70' : 'text-gray-400')}>
                            {ss.sessions_remaining} left
                          </span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div>
                <label className="label">Start date <span className="text-red-500">*</span></label>
                <input className="input" type="date" value={startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setStartDate(e.target.value)}/>
              </div>

              <div>
                <label className="label">Session time <span className="text-red-500">*</span></label>
                <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)}/>
              </div>

              <div>
                <label className="label">Days of week <span className="text-red-500">*</span></label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_LABELS.map((d, i) => (
                    <button key={d} type="button" onClick={() => toggleDay(i)}
                      className={cn(
                        'w-10 h-10 rounded-full text-xs font-semibold border transition-colors',
                        days.includes(i)
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={days.includes(i) ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Total sessions <span className="text-red-500">*</span></label>
                <input className="input" type="number" min="1" max="100"
                  placeholder="Auto-filled from student's sessions"
                  value={total ?? ''}
                  onChange={e => setTotal(parseInt(e.target.value) || null)}/>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                      <CalendarDays size={13}/>
                      {preview.length} sessions will be created
                    </p>
                    {preview.length > 5 && (
                      <button type="button" onClick={() => setShowAll(v => !v)}
                        className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5">
                        {showAll ? <><ChevronUp size={12}/> Less</> : <><ChevronDown size={12}/> All</>}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {visiblePreview.map((dt, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center font-medium text-gray-500 shrink-0 text-[10px]">
                          {i + 1}
                        </span>
                        <span className="w-7 text-gray-400">{DAY_LABELS[dt.getDay()]}</span>
                        <span className="font-medium">
                          {dt.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
                        </span>
                        <span className="text-gray-400">at {time}</span>
                      </div>
                    ))}
                    {!showAll && preview.length > 5 && (
                      <p className="text-xs text-gray-400 ml-7">…and {preview.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 truncate">
            {preview.length > 0
              ? `${preview.length} sessions · ${days.map(d => DAY_LABELS[d]).join(', ')} · from ${new Date(startDate).toLocaleDateString('id-ID', { day:'numeric', month:'short' })}`
              : 'Fill in all fields to preview sessions'}
          </p>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave}
              disabled={saving || preview.length === 0}
              className="btn-primary">
              {saving ? 'Creating…' : `Create ${preview.length > 0 ? preview.length + ' ' : ''}sessions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
