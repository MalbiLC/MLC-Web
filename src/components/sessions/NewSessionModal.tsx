'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DAYS } from '@/types/teachers'
import { cn, formatIDR } from '@/lib/utils'
import { X, Plus, Trash2, Users, Check } from 'lucide-react'
import type { ClassType } from '@/types/index'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLASS_TYPES: { value: ClassType; label: string; duration: number; max: number; location: string }[] = [
  { value: 'group',          label: 'Group Class',     duration: 75, max: 6, location: 'in_person' },
  { value: 'semi_private',   label: 'Semi-Private',    duration: 75, max: 3, location: 'in_person' },
  { value: 'private',        label: 'Private',         duration: 60, max: 1, location: 'in_person' },
  { value: 'private_online', label: 'Private Online',  duration: 60, max: 1, location: 'online'    },
]

const SUBJECTS = ['Math', 'Science', 'English', 'Mandarin']

interface AvailSlot { day_of_week: number; slot_start: string; slot_end: string }
interface FoundSlot { day_of_week: number; start: string; end: string; room_id: string; room_name: string; room_type: string }

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
function minToTime(m: number) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}` }

function intersect(slots: AvailSlot[][], durationMin: number): AvailSlot[] {
  if (slots.length === 0) return []
  let result = slots[0]
  for (let i = 1; i < slots.length; i++) {
    const next: AvailSlot[] = []
    for (const a of result) {
      for (const b of slots[i]) {
        if (a.day_of_week !== b.day_of_week) continue
        const start = Math.max(timeToMin(a.slot_start), timeToMin(b.slot_start))
        const end   = Math.min(timeToMin(a.slot_end),   timeToMin(b.slot_end))
        if (end - start >= durationMin) {
          next.push({ day_of_week: a.day_of_week, slot_start: minToTime(start), slot_end: minToTime(end) })
        }
      }
    }
    result = next
  }
  return result
}

interface Props { onClose: () => void; onSuccess: () => void }

export default function NewSessionModal({ onClose, onSuccess }: Props) {
  const sb = createClient()

  // Form state
  const [className, setClassName] = useState('')
  const [classType, setClassType] = useState<ClassType | null>(null)
  const [subject, setSubject] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<FoundSlot | null>(null)
  const [notes, setNotes] = useState('')

  // Data
  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [foundSlots, setFoundSlots] = useState<FoundSlot[]>([])

  // UI state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [finding, setFinding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const classConfig = CLASS_TYPES.find(c => c.value === classType)
  const isOnline = classType === 'private_online'

  useEffect(() => {
    Promise.all([
      sb.from('teachers').select('id, full_name, teacher_availability(*)').eq('status', 'active').order('full_name'),
      sb.from('students').select('id, full_name, student_availability(*), subject_sessions:student_subject_sessions(subject:subjects(name), sessions_remaining)').eq('student_type', 'current').order('full_name'),
      sb.from('rooms').select('*').order('type').order('name'),
    ]).then(([{ data: t }, { data: s }, { data: r }]) => {
      setTeachers(t || [])
      setStudents(s || [])
      setRooms(r || [])
    })
  }, [])

  // Auto-detect class type from students
  useEffect(() => {
    if (selectedStudents.length === 0 || classType) return
    // If only 1 student, suggest private; if 2-3 suggest semi-private; if more suggest group
    if (selectedStudents.length === 1) setClassType('private')
    else if (selectedStudents.length <= 3) setClassType('semi_private')
    else setClassType('group')
  }, [selectedStudents.length])

  const findSlots = useCallback(() => {
    if (!teacherId || selectedStudents.length === 0 || !classConfig) return
    setFinding(true)
    setFoundSlots([])
    setSelectedSlot(null)

    const teacher = teachers.find(t => t.id === teacherId)
    const teacherSlots: AvailSlot[] = (teacher?.teacher_availability || []).map((a: any) => ({
      day_of_week: a.day_of_week, slot_start: a.slot_start, slot_end: a.slot_end,
    }))

    const studentSlotSets: AvailSlot[][] = selectedStudents.map(sid => {
      const s = students.find(st => st.id === sid)
      return (s?.student_availability || []).map((a: any) => ({
        day_of_week: a.day_of_week, slot_start: a.slot_start, slot_end: a.slot_end,
      }))
    }).filter(s => s.length > 0)

    const allSlots = [teacherSlots, ...studentSlotSets]
    const common = intersect(allSlots, classConfig.duration)

    const matchRooms = rooms.filter(r =>
      isOnline ? r.type === 'zoom' : r.type === 'physical'
    )

    const result: FoundSlot[] = []
    for (const slot of common) {
      // Generate specific time slots within the window
      let start = timeToMin(slot.slot_start)
      const end = timeToMin(slot.slot_end)
      while (start + classConfig.duration <= end) {
        for (const room of matchRooms) {
          result.push({
            day_of_week: slot.day_of_week,
            start: minToTime(start),
            end: minToTime(start + classConfig.duration),
            room_id: room.id,
            room_name: room.name,
            room_type: room.type,
          })
        }
        start += 30 // 30-min increments
      }
    }

    setFoundSlots(result)
    setFinding(false)
    setStep(3)
  }, [teacherId, selectedStudents, classConfig, teachers, students, rooms, isOnline])

  const handleSave = async () => {
    if (!selectedSlot || !classType || !teacherId || selectedStudents.length === 0) {
      setError('Please complete all fields and select a time slot.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Find subject_id
      const { data: subjectRow } = await sb.from('subjects').select('id').eq('name', subject).single()

      // Find room
      const room = rooms.find(r => r.id === selectedSlot.room_id)

      // Create scheduled_at from day + time (use next occurrence of that day)
      const today = new Date()
      const dayDiff = (selectedSlot.day_of_week - today.getDay() + 7) % 7 || 7
      const sessionDate = new Date(today)
      sessionDate.setDate(today.getDate() + dayDiff)
      const [h, m] = selectedSlot.start.split(':').map(Number)
      sessionDate.setHours(h, m, 0, 0)

      // Insert session
      const { data: session, error: sessionErr } = await sb.from('sessions').insert({
        class_name: className || null,
        class_type: classType,
        teacher_id: teacherId,
        room_id: selectedSlot.room_id,
        subject_id: subjectRow?.id || null,
        scheduled_at: sessionDate.toISOString(),
        duration_minutes: classConfig?.duration || 60,
        max_students: classConfig?.max || 1,
        student_id: selectedStudents.length === 1 ? selectedStudents[0] : null,
        notes: notes || null,
        status: 'scheduled',
      }).select('id').single()

      if (sessionErr) throw sessionErr

      // Insert session_students for all students
      if (selectedStudents.length > 0) {
        await sb.from('session_students').insert(
          selectedStudents.map(sid => ({ session_id: session.id, student_id: sid }))
        )
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      if (classConfig && prev.length >= classConfig.max) return prev
      return [...prev, id]
    })
    setFoundSlots([])
    setSelectedSlot(null)
    if (step === 3) setStep(2)
  }

  // Filter students that have sessions for the selected subject
  const eligibleStudents = subject
    ? students.filter(s =>
        s.subject_sessions?.some((ss: any) =>
          ss.subject?.name === subject && ss.sessions_remaining > 0
        )
      )
    : students

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold">New session</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Step {step} of 3 — {step === 1 ? 'Session details' : step === 2 ? 'Add students' : 'Pick a time slot'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* ── STEP 1: Session details ─────────────────── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Session details</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Class name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input className="input" placeholder="e.g. Math Group A" value={className} onChange={e => setClassName(e.target.value)} />
              </div>
              <div>
                <label className="label">Subject <span className="text-red-500">*</span></label>
                <select className="input" value={subject} onChange={e => { setSubject(e.target.value); setSelectedStudents([]); setFoundSlots([]) }}>
                  <option value="">Select subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Class type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CLASS_TYPES.map(ct => (
                  <button key={ct.value} type="button"
                    onClick={() => { setClassType(ct.value); setSelectedStudents([]); setFoundSlots([]) }}
                    className={cn('flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-colors',
                      classType === ct.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    )}
                    style={classType === ct.value ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                    <span className="text-sm font-medium">{ct.label}</span>
                    <span className={cn('text-xs mt-0.5', classType === ct.value ? 'text-white/70' : 'text-gray-400')}>
                      {ct.duration} min · max {ct.max}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Teacher <span className="text-red-500">*</span></label>
              <select className="input" value={teacherId} onChange={e => { setTeacherId(e.target.value); setFoundSlots([]) }}>
                <option value="">Select teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* ── STEP 2: Students ────────────────────────── */}
          {subject && classType && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Students
                  {classConfig && (
                    <span className="ml-2 font-normal normal-case text-gray-300">
                      — {selectedStudents.length}/{classConfig.max} selected
                    </span>
                  )}
                </p>
                {selectedStudents.length > 0 && foundSlots.length === 0 && (
                  <button
                    onClick={findSlots}
                    disabled={!teacherId || finding}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--mlc-teal)' }}>
                    {finding ? 'Finding slots…' : 'Find available slots →'}
                  </button>
                )}
              </div>

              {eligibleStudents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No students with {subject} sessions remaining.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {eligibleStudents.map(s => {
                    const isSelected = selectedStudents.includes(s.id)
                    const sessionInfo = s.subject_sessions?.find((ss: any) => ss.subject?.name === subject)
                    const atMax = classConfig && selectedStudents.length >= classConfig.max && !isSelected

                    return (
                      <button key={s.id} type="button"
                        onClick={() => !atMax && toggleStudent(s.id)}
                        disabled={!!atMax}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors',
                          isSelected ? 'border-transparent text-white' : 'bg-white border-gray-100 hover:border-gray-300',
                          atMax && 'opacity-40 cursor-not-allowed'
                        )}
                        style={isSelected ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                        <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                          isSelected ? 'bg-white border-white' : 'border-gray-300'
                        )}>
                          {isSelected && <Check size={11} className="text-green-700" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium truncate', isSelected ? 'text-white' : 'text-gray-900')}>{s.full_name}</p>
                        </div>
                        {sessionInfo && (
                          <span className={cn('text-xs shrink-0',
                            isSelected ? 'text-white/70' : 'text-gray-400'
                          )}>
                            {sessionInfo.sessions_remaining} sessions left
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {!teacherId && selectedStudents.length > 0 && (
                <p className="text-xs text-amber-600">Select a teacher to find available slots.</p>
              )}
            </div>
          )}

          {/* ── STEP 3: Available slots ──────────────────── */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Available time slots
                </p>
                <button onClick={findSlots} className="text-xs text-gray-400 hover:text-gray-700 underline">
                  Refresh
                </button>
              </div>

              {foundSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No overlapping slots found. Check that teacher and students have availability set.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {foundSlots.map((slot, i) => {
                    const isSelected = selectedSlot === slot ||
                      (selectedSlot?.day_of_week === slot.day_of_week &&
                       selectedSlot?.start === slot.start &&
                       selectedSlot?.room_id === slot.room_id)
                    return (
                      <button key={i} type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                          isSelected ? 'text-white border-transparent' : 'bg-gray-50 border-gray-100 hover:border-gray-300 hover:bg-white'
                        )}
                        style={isSelected ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                        <div className="flex-1">
                          <p className={cn('text-sm font-medium', isSelected ? 'text-white' : 'text-gray-900')}>
                            {DAYS[slot.day_of_week]}
                          </p>
                          <p className={cn('text-xs mt-0.5', isSelected ? 'text-white/70' : 'text-gray-400')}>
                            {slot.start} – {slot.end}
                          </p>
                        </div>
                        <div className={cn('text-xs text-right shrink-0', isSelected ? 'text-white/70' : 'text-gray-500')}>
                          <p>{slot.room_name}</p>
                          <p className="mt-0.5">{classConfig?.duration} min</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {step === 3 && selectedSlot && (
            <div>
              <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea className="input resize-none" rows={2} placeholder="Any notes for this session…"
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          {/* Summary */}
          <div className="text-xs text-gray-400 flex-1 min-w-0">
            {classType && subject && (
              <span>{classConfig?.label} · {subject}</span>
            )}
            {selectedStudents.length > 0 && (
              <span className="ml-2">· {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''}</span>
            )}
            {selectedSlot && (
              <span className="ml-2">· {DAYS[selectedSlot.day_of_week]} {selectedSlot.start}</span>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            {step < 3 && selectedStudents.length > 0 && teacherId && (
              <button type="button" onClick={findSlots} disabled={finding}
                className="btn-primary">
                {finding ? 'Finding…' : 'Find slots →'}
              </button>
            )}
            {step === 3 && selectedSlot && (
              <button type="button" onClick={handleSave} disabled={saving}
                className="btn-primary">
                {saving ? 'Creating…' : 'Create session'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
