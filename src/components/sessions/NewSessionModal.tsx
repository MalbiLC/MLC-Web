'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { X, Check, CalendarDays, ChevronDown, ChevronUp, Search, Plus, Trash2 } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */

const PACKAGE_CLASS_TYPE: Record<string, string> = {
  group:        'group',
  semi_private: 'semi_private',
  private:      'private',
  online:       'private_online',
}

const CLASS_TYPE_META: Record<string, { label: string; duration: number; max: number; online: boolean }> = {
  group:          { label: 'Group Class',    duration: 75, max: 6, online: false },
  semi_private:   { label: 'Semi-Private',   duration: 75, max: 3, online: false },
  private:        { label: 'Private',        duration: 60, max: 1, online: false },
  private_online: { label: 'Private Online', duration: 60, max: 1, online: true  },
}

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function buildDates(startISO: string, days: number[], total: number): Date[] {
  if (!startISO || days.length === 0 || total <= 0) return []
  const start  = new Date(startISO + 'T00:00:00')
  const sorted = [...days].sort((a, b) => a - b)
  const out: Date[] = []
  let week = 0
  while (out.length < total && week < 104) {
    for (const d of sorted) {
      if (out.length >= total) break
      const diff = ((d - start.getDay() + 7) % 7) + week * 7
      const dt   = new Date(start)
      dt.setDate(dt.getDate() + diff)
      if (dt >= start) out.push(dt)
    }
    week++
  }
  return out.sort((a, b) => a.getTime() - b.getTime()).slice(0, total)
}

interface Props { onClose: () => void; onSuccess: () => void }

export default function NewSessionModal({ onClose, onSuccess }: Props) {
  const sb = createClient()

  const [allStudents,  setAllStudents]   = useState<any[]>([])
  const [allTeachers,  setAllTeachers]   = useState<any[]>([])
  const [allRooms,     setAllRooms]      = useState<any[]>([])

  // Primary student
  const [studentId,    setStudentId]    = useState('')
  const [studentSearch,setStudentSearch]= useState('')
  // Additional students (for group/semi-private)
  const [extraStudentIds, setExtraStudentIds] = useState<string[]>([])
  const [extraSearch,     setExtraSearch]     = useState('')
  const [showExtraPicker, setShowExtraPicker] = useState(false)

  const [subjectId,    setSubjectId]    = useState('')
  const [teacherId,    setTeacherId]    = useState('')
  const [roomId,       setRoomId]       = useState('')
  const [days,         setDays]         = useState<number[]>([])
  const [startDate,    setStartDate]    = useState(new Date().toISOString().split('T')[0])
  const [sessionTime,  setSessionTime]  = useState('14:00')
  const [className,    setClassName]    = useState('')
  const [notes,        setNotes]        = useState('')

  const [preview,  setPreview]  = useState<Date[]>([])
  const [showAll,  setShowAll]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    Promise.all([
      sb.from('students')
        .select('id, full_name, package, subject_sessions:student_subject_sessions(subject_id, sessions_remaining, teacher_id, subjects(id, name), teachers(id, full_name))')
        .eq('student_type', 'current')
        .order('full_name'),
      sb.from('teachers').select('id, full_name, teacher_subjects(subject_id)').eq('status', 'active').order('full_name'),
      sb.from('rooms').select('*').order('type').order('name'),
    ]).then(([{ data: s }, { data: t }, { data: r }]) => {
      setAllStudents(s || [])
      setAllTeachers(t || [])
      setAllRooms(r || [])
    })
  }, [])

  const student    = useMemo(() => allStudents.find(s => s.id === studentId), [allStudents, studentId])
  const classType  = student?.package ? (PACKAGE_CLASS_TYPE[student.package] ?? null) : null
  const classMeta  = classType ? CLASS_TYPE_META[classType] : null
  const isOnline   = classMeta?.online ?? false
  const isMulti    = classType === 'group' || classType === 'semi_private'
  const maxExtra   = classMeta ? classMeta.max - 1 : 0 // slots remaining after primary student

  const studentSubjects = useMemo(() =>
    (student?.subject_sessions || []).filter((ss: any) => ss.sessions_remaining > 0),
    [student]
  )
  const selectedSubjectSession = useMemo(() =>
    studentSubjects.find((ss: any) => ss.subject_id === subjectId),
    [studentSubjects, subjectId]
  )
  const eligibleTeachers = useMemo(() => {
    if (!subjectId) return []
    return allTeachers.filter((t: any) =>
      (t.teacher_subjects || []).some((ts: any) => ts.subject_id === subjectId)
    )
  }, [allTeachers, subjectId])
  const filteredRooms = useMemo(() =>
    allRooms.filter(r => isOnline ? r.type === 'zoom' : r.type === 'physical'),
    [allRooms, isOnline]
  )
  const visibleStudents = useMemo(() =>
    allStudents.filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase())),
    [allStudents, studentSearch]
  )

  // Extra student picker — show other current students not already selected
  const eligibleExtra = useMemo(() =>
    allStudents.filter(s =>
      s.id !== studentId &&
      !extraStudentIds.includes(s.id) &&
      s.full_name.toLowerCase().includes(extraSearch.toLowerCase())
    ),
    [allStudents, studentId, extraStudentIds, extraSearch]
  )

  // Total sessions = auto from primary student's sessions remaining for that subject
  const totalSessions = selectedSubjectSession?.sessions_remaining ?? 0

  useEffect(() => {
    if (!subjectId) return
    const defaultTeacher = selectedSubjectSession?.teacher_id
    if (defaultTeacher) setTeacherId(defaultTeacher)
    else if (eligibleTeachers.length === 1) setTeacherId(eligibleTeachers[0].id)
  }, [subjectId, selectedSubjectSession, eligibleTeachers])

  useEffect(() => {
    setPreview(buildDates(startDate, days, totalSessions))
  }, [startDate, days, totalSessions])

  const selectStudent = (id: string) => {
    setStudentId(id); setSubjectId(''); setTeacherId(''); setRoomId('')
    setDays([]); setStudentSearch(''); setExtraStudentIds([])
  }
  const toggleDay = (d: number) =>
    setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort())

  const addExtra = (id: string) => {
    if (extraStudentIds.length < maxExtra) {
      setExtraStudentIds(prev => [...prev, id])
    }
    setExtraSearch('')
    if (extraStudentIds.length + 1 >= maxExtra) setShowExtraPicker(false)
  }
  const removeExtra = (id: string) =>
    setExtraStudentIds(prev => prev.filter(x => x !== id))

  const allStudentIds = [studentId, ...extraStudentIds].filter(Boolean)
  const subjectName   = selectedSubjectSession?.subjects?.name ?? ''

  const handleSave = async () => {
    setError('')
    if (!studentId)           return setError('Select a student.')
    if (!subjectId)           return setError('Select a subject.')
    if (!teacherId)           return setError('Select a teacher.')
    if (!classType)           return setError('Student has no package set.')
    if (days.length === 0)    return setError('Select at least one day of the week.')
    if (totalSessions <= 0)   return setError('Student has no sessions remaining for this subject.')
    if (preview.length === 0) return setError('No dates generated — check start date.')

    setSaving(true)
    try {
      const seriesId = crypto.randomUUID()
      const [hh, mm] = sessionTime.split(':').map(Number)

      const toInsert = preview.map((date, idx) => {
        const dt = new Date(date); dt.setHours(hh, mm, 0, 0)
        return {
          class_name:       className || null,
          class_type:       classType,
          teacher_id:       teacherId,
          room_id:          roomId    || null,
          subject_id:       subjectId,
          scheduled_at:     dt.toISOString(),
          duration_minutes: classMeta!.duration,
          max_students:     classMeta!.max,
          status:           'scheduled',
          series_id:        seriesId,
          series_index:     idx + 1,
          notes:            notes || null,
        }
      })

      const { data: created, error: insErr } = await sb
        .from('sessions').insert(toInsert).select('id')
      if (insErr) throw new Error(`Could not save: ${insErr.message}`)
      if (!created?.length) throw new Error('Insert returned no rows — check RLS policies.')

      // Link all students to every session
      const links = created.flatMap(sess =>
        allStudentIds.map(sid => ({ session_id: sess.id, student_id: sid }))
      )
      const { error: linkErr } = await sb.from('session_students').insert(links)
      if (linkErr) throw new Error(`Could not link students: ${linkErr.message}`)

      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally { setSaving(false) }
  }

  const visiblePreview = showAll ? preview : preview.slice(0, 5)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold">New session series</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── 1. Primary student ── */}
          <div>
            <label className="label">1 · Student <span className="text-red-500">*</span></label>
            {!studentId ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                  <Search size={14} className="text-gray-400 shrink-0"/>
                  <input className="flex-1 text-sm outline-none placeholder-gray-400"
                    placeholder="Search student…" value={studentSearch} autoFocus
                    onChange={e => setStudentSearch(e.target.value)}/>
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {visibleStudents.length === 0
                    ? <p className="px-3 py-3 text-sm text-gray-400">No students found.</p>
                    : visibleStudents.map(s => (
                      <button key={s.id} type="button" onClick={() => selectStudent(s.id)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                        <span className="text-sm font-medium text-gray-800">{s.full_name}</span>
                        <span className="text-xs text-gray-400 capitalize">{s.package?.replace('_','-') ?? 'no package'}</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{student?.full_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">
                    {student?.package?.replace('_','-')} package → {classType && CLASS_TYPE_META[classType]?.label}
                  </p>
                </div>
                <button onClick={() => selectStudent('')}
                  className="text-xs text-gray-400 hover:text-gray-700 underline">Change</button>
              </div>
            )}
          </div>

          {/* ── 2. Subject ── */}
          {studentId && (
            <div>
              <label className="label">2 · Subject <span className="text-red-500">*</span></label>
              {studentSubjects.length === 0
                ? <p className="text-sm text-gray-400">No active subjects with sessions remaining.</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {studentSubjects.map((ss: any) => (
                      <button key={ss.subject_id} type="button"
                        onClick={() => { setSubjectId(ss.subject_id); setTeacherId('') }}
                        className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                          subjectId === ss.subject_id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        )}
                        style={subjectId === ss.subject_id ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                        {ss.subjects?.name}
                        <span className={cn('text-xs', subjectId === ss.subject_id ? 'text-white/70' : 'text-gray-400')}>
                          {ss.sessions_remaining} left
                        </span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* ── 3. Teacher ── */}
          {subjectId && (
            <div>
              <label className="label">3 · Teacher <span className="text-red-500">*</span></label>
              {eligibleTeachers.length === 0
                ? <p className="text-sm text-gray-400">No teachers found for {subjectName}.</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {eligibleTeachers.map((t: any) => (
                      <button key={t.id} type="button" onClick={() => setTeacherId(t.id)}
                        className={cn('px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                          teacherId === t.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        )}
                        style={teacherId === t.id ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                        {t.full_name}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* ── 4. Class type (read-only) ── */}
          {studentId && classType && (
            <div>
              <label className="label">4 · Class type</label>
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                <Check size={15} className="text-teal-600 shrink-0"/>
                <div>
                  <p className="text-sm font-medium text-gray-800">{CLASS_TYPE_META[classType].label}</p>
                  <p className="text-xs text-gray-400">
                    {CLASS_TYPE_META[classType].duration} min · max {CLASS_TYPE_META[classType].max} student{CLASS_TYPE_META[classType].max > 1 ? 's' : ''}
                    {isOnline ? ' · Online (Zoom)' : ''}
                    {' · '}Auto-filled from student package
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Add students (group / semi-private only) ── */}
          {teacherId && isMulti && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">
                  Additional students
                  <span className="text-gray-400 text-xs font-normal ml-1">
                    ({extraStudentIds.length}/{maxExtra} slots filled)
                  </span>
                </label>
                {extraStudentIds.length < maxExtra && (
                  <button type="button" onClick={() => setShowExtraPicker(v => !v)}
                    className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors">
                    <Plus size={12}/> Add student
                  </button>
                )}
              </div>

              {/* Current extra students */}
              {extraStudentIds.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {extraStudentIds.map(id => {
                    const s = allStudents.find(x => x.id === id)
                    return s ? (
                      <div key={id} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                        <p className="text-sm text-gray-800 font-medium">{s.full_name}</p>
                        <button onClick={() => removeExtra(id)}
                          className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {/* Extra student search picker */}
              {showExtraPicker && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                    <Search size={14} className="text-gray-400 shrink-0"/>
                    <input className="flex-1 text-sm outline-none placeholder-gray-400" autoFocus
                      placeholder="Search student to add…"
                      value={extraSearch} onChange={e => setExtraSearch(e.target.value)}/>
                    <button onClick={() => setShowExtraPicker(false)} className="text-gray-400 hover:text-gray-700">
                      <X size={14}/>
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {eligibleExtra.length === 0
                      ? <p className="px-3 py-3 text-sm text-gray-400">No other students available.</p>
                      : eligibleExtra.map(s => (
                        <button key={s.id} type="button" onClick={() => addExtra(s.id)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                          <span className="text-sm font-medium text-gray-800">{s.full_name}</span>
                          <span className="text-xs text-gray-400 capitalize">{s.package?.replace('_','-')}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {extraStudentIds.length === 0 && !showExtraPicker && (
                <p className="text-xs text-gray-400">
                  Optional — add up to {maxExtra} more student{maxExtra !== 1 ? 's' : ''} to this {CLASS_TYPE_META[classType!]?.label} session.
                </p>
              )}
            </div>
          )}

          {/* ── 5. Notes ── */}
          {teacherId && (
            <div>
              <label className="label">5 · Notes <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Class name</label>
                  <input className="input" placeholder="e.g. Math A"
                    value={className} onChange={e => setClassName(e.target.value)}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                  <input className="input" placeholder="Any notes…"
                    value={notes} onChange={e => setNotes(e.target.value)}/>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. Schedule ── */}
          {teacherId && (
            <div className="space-y-3">
              <label className="label">6 · Schedule <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start date</label>
                  <input className="input" type="date" value={startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setStartDate(e.target.value)}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Time</label>
                  <input className="input" type="time" value={sessionTime}
                    onChange={e => setSessionTime(e.target.value)}/>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Days of week</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_LABELS.map((d, i) => (
                    <button key={d} type="button" onClick={() => toggleDay(i)}
                      className={cn('w-10 h-10 rounded-full text-xs font-semibold border transition-colors',
                        days.includes(i) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={days.includes(i) ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sessions info — read only */}
              {selectedSubjectSession && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-600">
                  <Check size={13} className="text-teal-600 shrink-0"/>
                  <span>
                    <span className="font-semibold">{totalSessions} sessions</span> will be scheduled
                    {' · '}auto-filled from {student?.full_name}&apos;s {subjectName} remaining sessions
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── 7. Room ── */}
          {teacherId && days.length > 0 && (
            <div>
              <label className="label">
                7 · Room
                <span className="text-gray-400 text-xs font-normal ml-1">
                  ({isOnline ? 'Zoom links only' : 'Physical rooms only'})
                </span>
              </label>
              {filteredRooms.length === 0 ? (
                <p className="text-sm text-gray-400">No {isOnline ? 'Zoom' : 'physical'} rooms added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setRoomId('')}
                    className={cn('px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                      !roomId ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    )}
                    style={!roomId ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                    No room
                  </button>
                  {filteredRooms.map(r => (
                    <button key={r.id} type="button" onClick={() => setRoomId(r.id)}
                      className={cn('px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                        roomId === r.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={roomId === r.id ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      {r.name}
                      {r.capacity && r.type === 'physical' && (
                        <span className={cn('text-xs ml-1.5', roomId === r.id ? 'text-white/70' : 'text-gray-400')}>
                          cap {r.capacity}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Preview ── */}
          {preview.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <CalendarDays size={13}/>
                  {preview.length} sessions will be created
                  {allStudentIds.length > 1 && ` for ${allStudentIds.length} students`}
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
                    <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center font-medium text-gray-400 shrink-0 text-[10px]">{i+1}</span>
                    <span className="w-7 text-gray-400">{DAY_LABELS[dt.getDay()]}</span>
                    <span className="font-medium">{dt.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</span>
                    <span className="text-gray-400">at {sessionTime}</span>
                  </div>
                ))}
                {!showAll && preview.length > 5 && (
                  <p className="text-xs text-gray-400 ml-7">…and {preview.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 truncate">
            {student && subjectName && classType
              ? `${student.full_name}${allStudentIds.length > 1 ? ` +${allStudentIds.length - 1}` : ''} · ${subjectName} · ${CLASS_TYPE_META[classType]?.label}`
              : 'Select student to begin'}
            {preview.length > 0 && ` · ${preview.length} sessions`}
          </p>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave}
              disabled={saving || preview.length === 0 || !teacherId}
              className="btn-primary">
              {saving ? 'Creating…' : `Create ${preview.length > 0 ? preview.length + ' ' : ''}sessions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
