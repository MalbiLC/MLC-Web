'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { X, Plus, Check, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import type { ClassType } from '@/types/index'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLASS_TYPES: { value: ClassType; label: string; duration: number; max: number }[] = [
  { value: 'group',          label: 'Group Class',    duration: 75, max: 6 },
  { value: 'semi_private',   label: 'Semi-Private',   duration: 75, max: 3 },
  { value: 'private',        label: 'Private',        duration: 60, max: 1 },
  { value: 'private_online', label: 'Private Online', duration: 60, max: 1 },
]

const SUBJECTS = ['Math', 'Science', 'English', 'Mandarin']
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props { onClose: () => void; onSuccess: () => void }

function generateDates(startDate: Date, selectedDays: number[], totalSessions: number): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)

  // Find the first occurrence of each selected day on or after startDate
  // Then interleave them week by week
  if (selectedDays.length === 0 || totalSessions === 0) return []

  // Build a sorted list of upcoming day occurrences, then keep going week by week
  let week = 0
  while (dates.length < totalSessions) {
    for (const day of [...selectedDays].sort()) {
      if (dates.length >= totalSessions) break
      const d = new Date(startDate)
      d.setHours(0, 0, 0, 0)
      // days until next occurrence of 'day' in this week offset
      const diff = (day - startDate.getDay() + 7) % 7 + week * 7
      d.setDate(d.getDate() + diff)
      // skip if before start date
      if (d < startDate && week === 0) continue
      dates.push(new Date(d))
    }
    week++
    if (week > 200) break // safety
  }

  return dates.sort((a, b) => a.getTime() - b.getTime()).slice(0, totalSessions)
}

export default function NewSessionModal({ onClose, onSuccess }: Props) {
  const sb = createClient()

  const [className, setClassName] = useState('')
  const [classType, setClassType] = useState<ClassType | null>(null)
  const [subject, setSubject] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [sessionDays, setSessionDays] = useState<number[]>([]) // 0=Sun..6=Sat
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionTime, setSessionTime] = useState('14:00')
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])

  const [previewDates, setPreviewDates] = useState<Date[]>([])
  const [showAllDates, setShowAllDates] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const classConfig = CLASS_TYPES.find(c => c.value === classType)
  const isOnline = classType === 'private_online'

  useEffect(() => {
    Promise.all([
      sb.from('teachers').select('id, full_name').eq('status', 'active').order('full_name'),
      sb.from('students').select('id, full_name, subject_sessions:student_subject_sessions(subject:subjects(name), sessions_remaining)').eq('student_type', 'current').order('full_name'),
      sb.from('rooms').select('*').order('type').order('name'),
    ]).then(([{ data: t }, { data: s }, { data: r }]) => {
      setTeachers(t || [])
      setStudents(s || [])
      setRooms(r || [])
    })
  }, [])

  // Auto-detect session count from first student's subject sessions
  useEffect(() => {
    if (!subject || selectedStudents.length === 0) { setSessionCount(null); return }
    const student = students.find(s => s.id === selectedStudents[0])
    const ss = student?.subject_sessions?.find((ss: any) => ss.subject?.name === subject)
    if (ss) setSessionCount(ss.sessions_remaining)
  }, [subject, selectedStudents, students])

  // Auto-detect class type from student count
  useEffect(() => {
    if (selectedStudents.length === 1 && !classType) setClassType('private')
    else if (selectedStudents.length <= 3 && selectedStudents.length > 1 && !classType) setClassType('semi_private')
    else if (selectedStudents.length > 3 && !classType) setClassType('group')
  }, [selectedStudents.length])

  // Generate preview dates whenever inputs change
  useEffect(() => {
    if (!startDate || sessionDays.length === 0 || !sessionCount) { setPreviewDates([]); return }
    const start = new Date(startDate + 'T00:00:00')
    setPreviewDates(generateDates(start, sessionDays, sessionCount))
  }, [startDate, sessionDays, sessionCount])

  const toggleDay = (day: number) => {
    setSessionDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort())
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      if (classConfig && prev.length >= classConfig.max) return prev
      return [...prev, id]
    })
  }

  const eligibleStudents = subject
    ? students.filter(s => s.subject_sessions?.some((ss: any) => ss.subject?.name === subject && ss.sessions_remaining > 0))
    : students

  const filteredRooms = rooms.filter(r => isOnline ? r.type === 'zoom' : r.type === 'physical')

  const handleSave = async () => {
    if (!classType || !subject || !teacherId || selectedStudents.length === 0) { setError('Fill in all required fields.'); return }
    if (sessionDays.length === 0) { setError('Select at least one day of the week.'); return }
    if (previewDates.length === 0) { setError('No session dates generated. Check start date and days.'); return }

    setSaving(true); setError('')
    try {
      const { data: subjectRow } = await sb.from('subjects').select('id').eq('name', subject).single()
      const seriesId = crypto.randomUUID()
      const [h, m] = sessionTime.split(':').map(Number)

      // Create all sessions upfront
      const sessionsToInsert = previewDates.map((date, idx) => {
        const scheduled = new Date(date)
        scheduled.setHours(h, m, 0, 0)
        return {
          class_name: className || null,
          class_type: classType,
          teacher_id: teacherId,
          room_id: roomId || null,
          subject_id: subjectRow?.id || null,
          scheduled_at: scheduled.toISOString(),
          duration_minutes: classConfig?.duration || 60,
          max_students: classConfig?.max || 1,
          student_id: selectedStudents.length === 1 ? selectedStudents[0] : null,
          notes: notes || null,
          status: 'scheduled',
          series_id: seriesId,
          series_index: idx + 1,
        }
      })

      const { data: createdSessions, error: insertErr } = await sb
        .from('sessions').insert(sessionsToInsert).select('id')
      if (insertErr) throw insertErr

      // Link all students to all sessions
      if (selectedStudents.length > 1 && createdSessions) {
        const studentLinks = createdSessions.flatMap(sess =>
          selectedStudents.map(sid => ({ session_id: sess.id, student_id: sid }))
        )
        await sb.from('session_students').insert(studentLinks)
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally { setSaving(false) }
  }

  const visibleDates = showAllDates ? previewDates : previewDates.slice(0, 4)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold">New session series</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Session details */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Session details</p>

              <div>
                <label className="label">Class name <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input className="input" placeholder="e.g. Math Group A" value={className} onChange={e => setClassName(e.target.value)} />
              </div>

              <div>
                <label className="label">Subject <span className="text-red-500">*</span></label>
                <select className="input" value={subject} onChange={e => { setSubject(e.target.value); setSelectedStudents([]) }}>
                  <option value="">Select subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Class type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {CLASS_TYPES.map(ct => (
                    <button key={ct.value} type="button"
                      onClick={() => { setClassType(ct.value); setSelectedStudents([]) }}
                      className={cn('flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-colors',
                        classType === ct.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={classType === ct.value ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      <span className="text-sm font-medium">{ct.label}</span>
                      <span className={cn('text-xs', classType === ct.value ? 'text-white/70' : 'text-gray-400')}>{ct.duration}m</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Teacher <span className="text-red-500">*</span></label>
                <select className="input" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Room <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <select className="input" value={roomId} onChange={e => setRoomId(e.target.value)}>
                  <option value="">Select room</option>
                  {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Notes <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <textarea className="input resize-none" rows={2} placeholder="Notes for all sessions in this series…"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            {/* RIGHT: Students + Schedule */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Students & schedule</p>

              {/* Students */}
              <div>
                <label className="label">
                  Students <span className="text-red-500">*</span>
                  {classConfig && <span className="text-gray-400 font-normal text-xs ml-1">— max {classConfig.max}</span>}
                </label>
                {!subject ? (
                  <p className="text-xs text-gray-400">Select a subject first</p>
                ) : eligibleStudents.length === 0 ? (
                  <p className="text-xs text-gray-400">No students with {subject} sessions remaining</p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {eligibleStudents.map(s => {
                      const isSelected = selectedStudents.includes(s.id)
                      const atMax = classConfig && selectedStudents.length >= classConfig.max && !isSelected
                      const ss = s.subject_sessions?.find((ss: any) => ss.subject?.name === subject)
                      return (
                        <button key={s.id} type="button"
                          onClick={() => !atMax && toggleStudent(s.id)}
                          disabled={!!atMax}
                          className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors text-sm',
                            isSelected ? 'text-white border-transparent' : 'bg-white border-gray-100 hover:border-gray-300',
                            atMax && 'opacity-40 cursor-not-allowed'
                          )}
                          style={isSelected ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                          <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                            isSelected ? 'bg-white border-white' : 'border-gray-300'
                          )}>
                            {isSelected && <Check size={9} className="text-green-700" strokeWidth={3} />}
                          </div>
                          <span className="flex-1 font-medium truncate">{s.full_name}</span>
                          {ss && <span className={cn('text-xs shrink-0', isSelected ? 'text-white/70' : 'text-gray-400')}>{ss.sessions_remaining} left</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div>
                <label className="label">Start date <span className="text-red-500">*</span></label>
                <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>

              <div>
                <label className="label">Session time <span className="text-red-500">*</span></label>
                <input className="input" type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
              </div>

              <div>
                <label className="label">Days of the week <span className="text-red-500">*</span></label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <button key={day} type="button"
                      onClick={() => toggleDay(idx)}
                      className={cn('w-10 h-10 rounded-full text-xs font-medium border transition-colors',
                        sessionDays.includes(idx) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={sessionDays.includes(idx) ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Total sessions</label>
                <input className="input" type="number" min="1" max="52"
                  value={sessionCount ?? ''}
                  placeholder="Auto-filled from student's registered sessions"
                  onChange={e => setSessionCount(parseInt(e.target.value) || null)} />
                {selectedStudents.length > 0 && subject && sessionCount !== null && (
                  <p className="text-xs text-gray-400 mt-1">
                    Auto-filled from {students.find(s => s.id === selectedStudents[0])?.full_name}&apos;s {subject} sessions
                  </p>
                )}
              </div>

              {/* Preview dates */}
              {previewDates.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                      <CalendarDays size={13} />
                      {previewDates.length} sessions will be created
                    </p>
                    {previewDates.length > 4 && (
                      <button type="button" onClick={() => setShowAllDates(v => !v)}
                        className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5">
                        {showAllDates ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> All</>}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {visibleDates.map((date, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-medium text-gray-500 shrink-0">{i + 1}</span>
                        <span>{DAYS_OF_WEEK[date.getDay()]}</span>
                        <span className="font-medium">{date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="text-gray-400">at {sessionTime}</span>
                      </div>
                    ))}
                    {!showAllDates && previewDates.length > 4 && (
                      <p className="text-xs text-gray-400 ml-7">+{previewDates.length - 4} more…</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {previewDates.length > 0
              ? `${previewDates.length} sessions · ${sessionDays.map(d => DAYS_OF_WEEK[d]).join(', ')} · starting ${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
              : 'Fill in all fields to preview sessions'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || previewDates.length === 0}
              className="btn-primary">
              {saving ? 'Creating…' : `Create ${previewDates.length || ''} sessions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
