'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAllSessions } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime, formatDuration, formatIDR } from '@/lib/utils'
import {
  Plus, X, MapPin, Monitor, Users, Trash2, Pencil,
  Search, Filter, ChevronDown, ChevronUp,
  CalendarClock, Zap, AlertCircle, Clock,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import NewSessionModal from '@/components/sessions/NewSessionModal'
import EditSessionModal from '@/components/sessions/EditSessionModal'
import { useAuth } from '@/hooks/useAuth'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  group:          { bg: '#E6F4F2', text: '#0F7B6C', border: '#0F7B6C' },
  semi_private:   { bg: '#E8F0FA', text: '#1A5FA8', border: '#1A5FA8' },
  private:        { bg: '#FEF3DC', text: '#B45309', border: '#E8A020' },
  private_online: { bg: '#F0F0FE', text: '#4338CA', border: '#6366F1' },
}
const CT_LABELS: Record<string, string> = {
  group: 'Group', semi_private: 'Semi-Private', private: 'Private', private_online: 'Online',
}
const PACKAGE_TO_CLASS: Record<string, string> = {
  group: 'group', semi_private: 'semi_private', private: 'private', online: 'private_online',
}
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface Room { id: string; name: string; type: string; zoom_link: string | null; capacity: number; notes: string | null }

// Slot intersection helper
function timeToMin(t: string) { const [h,m] = t.split(':').map(Number); return h*60+(m||0) }
function minToTime(m: number) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}` }

function intersectSlots(
  slotsA: any[], slotsB: any[], durationMin: number
): Array<{ day_of_week: number; start: string; end: string }> {
  const result: Array<{ day_of_week: number; start: string; end: string }> = []
  for (const a of slotsA) {
    for (const b of slotsB) {
      if (a.day_of_week !== b.day_of_week) continue
      const start = Math.max(timeToMin(a.slot_start), timeToMin(b.slot_start))
      const end   = Math.min(timeToMin(a.slot_end),   timeToMin(b.slot_end))
      if (end - start >= durationMin) {
        // Generate 30-min increment slots within the window
        let s = start
        while (s + durationMin <= end) {
          result.push({ day_of_week: a.day_of_week, start: minToTime(s), end: minToTime(s + durationMin) })
          s += 30
        }
      }
    }
  }
  return result
}

// ── Smart slot finder modal ──────────────────────────────────────
function SlotFinderModal({
  student, subjectSession, allTeachers, allRooms,
  onClose, onScheduled,
}: {
  student: any; subjectSession: any; allTeachers: any[]; allRooms: any[]
  onClose: () => void; onScheduled: () => void
}) {
  const sb = createClient()
  const classType = PACKAGE_TO_CLASS[student.package] ?? 'private'
  const meta = { group: { duration: 75, max: 6 }, semi_private: { duration: 75, max: 3 }, private: { duration: 60, max: 1 }, private_online: { duration: 60, max: 1 } }[classType] ?? { duration: 60, max: 1 }
  const isOnline = classType === 'private_online'
  const subjectName = subjectSession.subjects?.name ?? subjectSession.subject_name ?? ''

  const [teacherId,  setTeacherId]  = useState('')
  const [slots,      setSlots]      = useState<any[]>([])
  const [altSlots,   setAltSlots]   = useState<{ teacher: any; slots: any[] }[]>([])
  const [finding,    setFinding]    = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null)
  const [roomId,     setRoomId]     = useState('')
  const [startDate,  setStartDate]  = useState('')
  const [sessionTime,setSessionTime]= useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const eligibleTeachers = useMemo(() =>
    allTeachers.filter(t =>
      (t.teacher_subjects || []).some((ts: any) => ts.subject_id === subjectSession.subject_id)
    ),
    [allTeachers, subjectSession]
  )
  const filteredRooms = allRooms.filter(r => isOnline ? r.type === 'zoom' : r.type === 'physical')
  const studentSlots: any[] = student.student_availability || []

  const findSlots = async (tId: string) => {
    if (!tId) return
    setFinding(true); setSlots([]); setAltSlots([]); setSelectedSlot(null)
    const teacher = allTeachers.find(t => t.id === tId)
    const teacherSlots: any[] = teacher?.teacher_availability || []

    const common = intersectSlots(studentSlots, teacherSlots, meta.duration)
    setSlots(common)

    // No overlap — suggest alternatives per teacher
    if (common.length === 0) {
      const alts: { teacher: any; slots: any[] }[] = []
      for (const t of eligibleTeachers) {
        if (t.id === tId) continue
        const ts: any[] = t.teacher_availability || []
        const inter = intersectSlots(studentSlots, ts, meta.duration)
        if (inter.length > 0) alts.push({ teacher: t, slots: inter.slice(0, 3) })
      }
      setAltSlots(alts)
    }
    setFinding(false)
  }

  const selectTeacher = (id: string) => { setTeacherId(id); findSlots(id) }

  const pickSlot = (slot: any) => {
    setSelectedSlot(slot)
    // Pre-fill start date to next occurrence of that day
    const today = new Date(); today.setHours(0,0,0,0)
    const diff  = (slot.day_of_week - today.getDay() + 7) % 7 || 7
    const next  = new Date(today); next.setDate(today.getDate() + diff)
    setStartDate(next.toISOString().split('T')[0])
    setSessionTime(slot.start)
  }

  const handleSchedule = async () => {
    if (!selectedSlot || !teacherId) { setError('Select a time slot first.'); return }
    if (!startDate || !sessionTime)  { setError('Start date and time are required.'); return }

    setSaving(true); setError('')
    try {
      const seriesId = crypto.randomUUID()
      const [hh, mm] = sessionTime.split(':').map(Number)
      const totalSessions = subjectSession.sessions_remaining

      // Build all dates (weekly from startDate, same day of week as selectedSlot)
      const dates: Date[] = []
      const start = new Date(startDate + 'T00:00:00')
      start.setHours(hh, mm, 0, 0)
      let cur = new Date(start)
      while (dates.length < totalSessions) {
        dates.push(new Date(cur))
        cur.setDate(cur.getDate() + 7)
      }

      const toInsert = dates.map((dt, idx) => ({
        class_type:       classType,
        teacher_id:       teacherId,
        room_id:          roomId || null,
        subject_id:       subjectSession.subject_id,
        scheduled_at:     dt.toISOString(),
        duration_minutes: meta.duration,
        max_students:     meta.max,
        status:           'scheduled',
        series_id:        seriesId,
        series_index:     idx + 1,
      }))

      const { data: created, error: insErr } = await sb.from('sessions').insert(toInsert).select('id')
      if (insErr) throw new Error(insErr.message)
      if (!created?.length) throw new Error('Insert returned no rows.')

      // Link student to sessions
      const links = created.map(s => ({ session_id: s.id, student_id: student.id }))
      await sb.from('session_students').insert(links)

      onScheduled()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold">Schedule sessions</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {student.full_name} · {subjectName} · {CT_LABELS[classType] || classType}
              · {subjectSession.sessions_remaining} sessions
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Teacher */}
          <div>
            <label className="label">1 · Select teacher</label>
            {eligibleTeachers.length === 0 ? (
              <p className="text-sm text-gray-400">No teachers found for {subjectName}.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {eligibleTeachers.map(t => (
                  <button key={t.id} type="button" onClick={() => selectTeacher(t.id)}
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

          {/* Slot results */}
          {teacherId && !finding && (
            <>
              {slots.length > 0 ? (
                <div>
                  <label className="label">
                    2 · Available slots
                    <span className="text-gray-400 text-xs font-normal ml-1">— intersection of student & teacher availability</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                    {slots.map((slot, i) => {
                      const isSelected = selectedSlot?.day_of_week === slot.day_of_week && selectedSlot?.start === slot.start
                      return (
                        <button key={i} type="button" onClick={() => pickSlot(slot)}
                          className={cn('flex flex-col px-4 py-3 rounded-xl border text-left transition-colors',
                            isSelected ? 'text-white border-transparent' : 'bg-gray-50 border-gray-100 hover:border-gray-300 hover:bg-white'
                          )}
                          style={isSelected ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                          <span className="text-sm font-semibold">{DAYS[slot.day_of_week]}</span>
                          <span className={cn('text-xs mt-0.5', isSelected ? 'text-white/70' : 'text-gray-400')}>
                            {slot.start} – {slot.end} · {meta.duration}m
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={15} className="text-amber-600 shrink-0"/>
                    <p className="text-sm font-semibold text-amber-800">No overlapping slots found</p>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    {student.full_name}&apos;s availability doesn&apos;t overlap with the selected teacher.
                    {studentSlots.length === 0 ? ' Student has no availability set.' : ''}
                  </p>
                  {altSlots.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-800 mb-2">Suggested alternatives with other teachers:</p>
                      {altSlots.map(({ teacher, slots: altS }, ti) => (
                        <div key={ti} className="mb-2">
                          <p className="text-xs text-amber-700 mb-1">
                            <span className="font-medium">{teacher.full_name}</span> is available:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {altS.map((s: any, si: number) => (
                              <button key={si} type="button"
                                onClick={() => { selectTeacher(teacher.id) }}
                                className="text-xs px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors">
                                {DAYS[s.day_of_week]} {s.start}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {altSlots.length === 0 && (
                    <p className="text-xs text-amber-600">No other teachers available either. Update availability in the Students or Teachers tab.</p>
                  )}
                </div>
              )}
            </>
          )}

          {finding && <p className="text-sm text-gray-400">Finding available slots…</p>}

          {/* After slot selected: start date + room */}
          {selectedSlot && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">3 · Start date</label>
                  <input className="input" type="date" value={startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setStartDate(e.target.value)}/>
                  <p className="text-xs text-gray-400 mt-1">Weekly on {DAYS[selectedSlot.day_of_week]}s</p>
                </div>
                <div>
                  <label className="label">Time</label>
                  <input className="input" type="time" value={sessionTime}
                    onChange={e => setSessionTime(e.target.value)}/>
                </div>
              </div>

              {/* Session count info */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-600">
                <Clock size={13} className="text-teal-600 shrink-0"/>
                <span>
                  <span className="font-semibold">{subjectSession.sessions_remaining} sessions</span> will be created
                  {' · '}every {DAYS[selectedSlot.day_of_week]} from{' '}
                  {startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('id-ID', { day:'numeric', month:'short' }) : '…'}
                </span>
              </div>

              <div>
                <label className="label">
                  4 · Room
                  <span className="text-gray-400 text-xs font-normal ml-1">({isOnline ? 'Zoom only' : 'Physical rooms'})</span>
                </label>
                {filteredRooms.length === 0 ? (
                  <p className="text-sm text-gray-400">No {isOnline ? 'Zoom' : 'physical'} rooms yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setRoomId('')}
                      className={cn('px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                        !roomId ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={!roomId ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      No room
                    </button>
                    {filteredRooms.map(r => (
                      <button key={r.id} type="button" onClick={() => setRoomId(r.id)}
                        className={cn('px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                          roomId === r.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        )}
                        style={roomId === r.id ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSchedule}
            disabled={!selectedSlot || !teacherId || saving}
            className="btn-primary flex-1 justify-center">
            {saving ? 'Scheduling…' : `Schedule ${subjectSession.sessions_remaining} sessions`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Needs Scheduling card ────────────────────────────────────────
function NeedsSchedulingSection({
  students, allTeachers, allRooms, onScheduled,
}: {
  students: any[]; allTeachers: any[]; allRooms: any[]; onScheduled: () => void
}) {
  const [scheduling, setScheduling] = useState<{ student: any; subjectSession: any } | null>(null)

  if (students.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Needs scheduling — {students.length} student{students.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-2">
        {students.map(student => {
          const unscheduledSubs = (student.subject_sessions || []).filter(
            (ss: any) => ss.sessions_remaining > 0 && !ss.has_scheduled
          )
          return unscheduledSubs.map((ss: any) => (
            <div key={`${student.id}-${ss.subject_id}`}
              className="bg-white border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="w-2 h-10 rounded-full bg-amber-300 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{student.full_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {ss.subjects?.name} · {ss.sessions_remaining} sessions · {student.package?.replace('_','-')} package
                  {ss.packages?.package_name && ` · ${ss.packages.package_name}`}
                </p>
              </div>
              <button
                onClick={() => setScheduling({ student, subjectSession: ss })}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl text-white shrink-0 transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--mlc-amber)' }}>
                <Zap size={13}/> Schedule
              </button>
            </div>
          ))
        })}
      </div>

      {scheduling && (
        <SlotFinderModal
          student={scheduling.student}
          subjectSession={scheduling.subjectSession}
          allTeachers={allTeachers}
          allRooms={allRooms}
          onClose={() => setScheduling(null)}
          onScheduled={() => { setScheduling(null); onScheduled() }}
        />
      )}
    </div>
  )
}

// ── Main scheduling page ─────────────────────────────────────────
export default function SchedulingPage() {
  useAuth()
  const sb = createClient()

  const [rooms,    setRooms]    = useState<Room[]>([])
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showNewSession,  setShowNewSession]  = useState(false)
  const [editingSession,  setEditingSession]  = useState<CalendarSession | null>(null)
  const [deletingSession,    setDeletingSession]    = useState<CalendarSession | null>(null)
  const [deleteLoading,      setDeleteLoading]      = useState(false)
  const [deleteSeries,       setDeleteSeries]       = useState(false)
  const [deletingAllStudent, setDeletingAllStudent] = useState<{ name: string; ids: string[] } | null>(null)
  const [deleteAllLoading,   setDeleteAllLoading]   = useState(false)

  // For NeedsScheduling
  const [allStudents,  setAllStudents]  = useState<any[]>([])
  const [allTeachers,  setAllTeachers]  = useState<any[]>([])

  // Room modal
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editRoom,      setEditRoom]      = useState<Room | null>(null)
  const [deletingRoom,  setDeletingRoom]  = useState<Room | null>(null)
  const [roomForm,      setRoomForm]      = useState({ name:'', type:'physical', zoom_link:'', capacity:'1', notes:'' })
  const [roomSaving,    setRoomSaving]    = useState(false)

  // Filters
  const [searchStudent, setSearchStudent] = useState('')
  const [searchTeacher, setSearchTeacher] = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [filterFrom,    setFilterFrom]    = useState('')
  const [filterTo,      setFilterTo]      = useState('')
  const [showFilters,   setShowFilters]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, sessionData, { data: s }, { data: t }] = await Promise.all([
      sb.from('rooms').select('*').order('type').order('name'),
      getAllSessions(1, 6),
      sb.from('students')
        .select(`id, full_name, package, student_availability(*),
          subject_sessions:student_subject_sessions(
            subject_id, sessions_remaining, package_id,
            subjects(id,name), packages(id,package_name,class_type,sessions)
          )`)
        .eq('student_type', 'current').order('full_name'),
      sb.from('teachers')
        .select('id, full_name, teacher_subjects(subject_id), teacher_availability(*)')
        .eq('status','active').order('full_name'),
    ])
    setRooms(r || [])
    setSessions(sessionData)
    setAllStudents(s || [])
    setAllTeachers(t || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = sb.channel('sched-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'sessions' }, load)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [load])

  // Figure out which student-subject combos have NO scheduled sessions
  const needsScheduling = useMemo(() => {
    const scheduledStudentSubjects = new Set<string>()
    sessions.forEach(sess => {
      sess.students.forEach(st => {
        scheduledStudentSubjects.add(`${st.id}|${sess.subject_name}`)
      })
    })

    return allStudents.filter(s => {
      const subs = s.subject_sessions || []
      return subs.some((ss: any) => {
        if (ss.sessions_remaining <= 0) return false
        const subjectName = ss.subjects?.name
        return !scheduledStudentSubjects.has(`${s.id}|${subjectName}`)
      })
    }).map(s => ({
      ...s,
      subject_sessions: (s.subject_sessions || []).map((ss: any) => ({
        ...ss,
        has_scheduled: scheduledStudentSubjects.has(`${s.id}|${ss.subjects?.name}`),
      })),
    }))
  }, [allStudents, sessions])

  // Filters + group by student
  const filteredSessions = useMemo(() => sessions.filter(s => {
    if (searchStudent && !s.students.some(st => st.full_name.toLowerCase().includes(searchStudent.toLowerCase()))) return false
    if (searchTeacher && !s.teacher_name.toLowerCase().includes(searchTeacher.toLowerCase())) return false
    if (filterType && s.class_type !== filterType) return false
    if (filterFrom && new Date(s.scheduled_at) < new Date(filterFrom)) return false
    if (filterTo   && new Date(s.scheduled_at) > new Date(filterTo + 'T23:59:59')) return false
    return true
  }), [sessions, searchStudent, searchTeacher, filterType, filterFrom, filterTo])

  const studentGroups = useMemo(() => {
    const map: Record<string, { studentName: string; sessions: CalendarSession[] }> = {}
    for (const s of filteredSessions) {
      for (const st of s.students) {
        if (!map[st.id]) map[st.id] = { studentName: st.full_name, sessions: [] }
        map[st.id].sessions.push(s)
      }
      if (s.students.length === 0) {
        const key = `__no_${s.id}`
        map[key] = { studentName: '—', sessions: [s] }
      }
    }
    return Object.entries(map).sort(([,a],[,b]) => a.studentName.localeCompare(b.studentName))
  }, [filteredSessions])

  const hasFilters = searchStudent || searchTeacher || filterType || filterFrom || filterTo

  // Room CRUD
  const openRoomModal = (room?: Room) => {
    setEditRoom(room ?? null)
    setRoomForm(room
      ? { name:room.name, type:room.type, zoom_link:room.zoom_link||'', capacity:String(room.capacity||1), notes:room.notes||'' }
      : { name:'', type:'physical', zoom_link:'', capacity:'1', notes:'' })
    setShowRoomModal(true)
  }
  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault(); setRoomSaving(true)
    const p = { name:roomForm.name, type:roomForm.type, zoom_link:roomForm.zoom_link||null, capacity:parseInt(roomForm.capacity)||1, notes:roomForm.notes||null, is_available:true }
    if (editRoom) await sb.from('rooms').update(p).eq('id', editRoom.id)
    else          await sb.from('rooms').insert(p)
    setRoomSaving(false); setShowRoomModal(false); load()
  }
  const deleteRoom = async () => {
    if (!deletingRoom) return
    await sb.from('rooms').delete().eq('id', deletingRoom.id)
    setDeletingRoom(null); load()
  }

  const deleteSession = async () => {
    if (!deletingSession) return
    setDeleteLoading(true)
    if (deleteSeries && deletingSession.series_id) {
      await sb.from('sessions').delete()
        .eq('series_id', deletingSession.series_id)
        .gte('series_index', deletingSession.series_index ?? 1)
    } else {
      await sb.from('sessions').delete().eq('id', deletingSession.id)
    }
    setDeleteLoading(false); setDeletingSession(null); setDeleteSeries(false); load()
  }

  const deleteAllStudentSessions = async () => {
    if (!deletingAllStudent) return
    setDeleteAllLoading(true)
    try {
      await sb.from('sessions').delete().in('id', deletingAllStudent.ids)
    } finally {
      setDeleteAllLoading(false)
      setDeletingAllStudent(null)
      load()
    }
  }

  const physicalRooms = rooms.filter(r => r.type === 'physical')
  const zoomRooms     = rooms.filter(r => r.type === 'zoom')

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Scheduling</h1>
        <div className="flex gap-2">
          <button onClick={() => openRoomModal()} className="btn-secondary"><Plus size={15}/> Add room</button>
          <button onClick={() => setShowNewSession(true)} className="btn-primary"><Plus size={15}/> New session</button>
        </div>
      </div>

      <div className="page-content space-y-8">

        {/* ── Needs scheduling ── */}
        {!loading && (
          <NeedsSchedulingSection
            students={needsScheduling}
            allTeachers={allTeachers}
            allRooms={rooms}
            onScheduled={load}
          />
        )}

        {/* ── Sessions by student ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Scheduled students {!loading && <span className="text-gray-300">· {studentGroups.length}</span>}
            </p>
            <button onClick={() => setShowFilters(v => !v)}
              className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                showFilters || hasFilters ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
              style={(showFilters || hasFilters) ? { backgroundColor:'var(--mlc-teal)' } : {}}>
              <Filter size={13}/> Filters{hasFilters && ' ·'}
            </button>
          </div>

          {showFilters && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input className="input pl-8 text-sm" placeholder="Student name…"
                    value={searchStudent} onChange={e => setSearchStudent(e.target.value)}/>
                </div>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input className="input pl-8 text-sm" placeholder="Teacher name…"
                    value={searchTeacher} onChange={e => setSearchTeacher(e.target.value)}/>
                </div>
                <select className="input text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All types</option>
                  {Object.entries(CT_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <div className="flex gap-2">
                  <input className="input text-sm flex-1" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From"/>
                  <input className="input text-sm flex-1" type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   title="To"/>
                </div>
              </div>
              {hasFilters && <button onClick={() => { setSearchStudent(''); setSearchTeacher(''); setFilterType(''); setFilterFrom(''); setFilterTo('') }} className="text-xs text-gray-400 hover:text-gray-700 underline">Clear filters</button>}
            </div>
          )}

          {loading ? <p className="text-sm text-gray-400 py-4">Loading…</p>
          : studentGroups.length === 0 ? (
            <div className="card text-center py-10 text-gray-400 text-sm">
              {hasFilters ? 'No sessions match your filters.' : 'No sessions scheduled yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {studentGroups.map(([studentId, { studentName, sessions: studentSessions }]) => {
                const isOpen = expanded === studentId
                const bySubject: Record<string, CalendarSession[]> = {}
                for (const s of studentSessions) {
                  const key = s.subject_name || 'Unknown'
                  if (!bySubject[key]) bySubject[key] = []
                  bySubject[key].push(s)
                }
                const upcoming  = studentSessions.filter(s => s.status === 'scheduled').length
                const completed = studentSessions.filter(s => s.status === 'completed').length
                const firstType = studentSessions[0]?.class_type ?? ''
                const colors    = CT_COLORS[firstType] || CT_COLORS.private

                return (
                  <div key={studentId} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : studentId)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: colors.border }}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{studentName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {Object.keys(bySubject).map(sub => <span key={sub} className="badge bg-gray-100 text-gray-600">{sub}</span>)}
                          {firstType && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor:colors.bg, color:colors.text }}>{CT_LABELS[firstType]}</span>}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400 shrink-0">
                        <div className="text-right"><p className="font-semibold text-gray-700 text-sm">{upcoming}</p><p>upcoming</p></div>
                        <div className="text-right"><p className="font-semibold text-gray-700 text-sm">{completed}</p><p>done</p></div>
                        <div className="text-right"><p className="font-semibold text-gray-700 text-sm">{studentSessions.length}</p><p>total</p></div>
                      </div>
                      {isOpen ? <ChevronUp size={15} className="text-gray-400 shrink-0"/> : <ChevronDown size={15} className="text-gray-400 shrink-0"/>}
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-50 bg-gray-50/30 px-5 py-4 space-y-4">
                        {Object.entries(bySubject).map(([subjectName, subSessions]) => (
                          <div key={subjectName}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="badge bg-gray-200 text-gray-700 font-semibold">{subjectName}</span>
                              <span className="text-xs text-gray-400">
                                {subSessions.filter(s=>s.status==='scheduled').length} upcoming · {subSessions.filter(s=>s.status==='completed').length} done · {subSessions.length} total
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {subSessions.sort((a,b) => new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime()).map(s => {
                                const isPast = new Date(s.scheduled_at) < new Date()
                                const c = CT_COLORS[s.class_type||'private'] || CT_COLORS.private
                                return (
                                  <div key={s.id} className={cn('flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-lg', s.status==='cancelled'&&'opacity-40')}>
                                    <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor:c.border }}/>
                                    <div className="w-24 shrink-0">
                                      <p className="text-xs font-medium text-gray-800">{new Date(s.scheduled_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</p>
                                      <p className="text-xs text-gray-400">{formatTime(s.scheduled_at)}</p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-gray-500 truncate">
                                        {s.teacher_name}{s.room_name && ` · ${s.room_name}`}
                                      </p>
                                      {s.series_index && <p className="text-xs text-gray-300">Session {s.series_index}</p>}
                                    </div>
                                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                                      s.status==='completed'?'bg-teal-50 text-teal-700':s.status==='cancelled'?'bg-gray-100 text-gray-400':s.status==='rescheduled'?'bg-amber-50 text-amber-700':isPast?'bg-red-50 text-red-600':'bg-blue-50 text-blue-700'
                                    )}>{s.status==='scheduled'&&isPast?'overdue':s.status}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {s.status==='scheduled' && (
                                        <button title="Mark completed"
                                          onClick={async()=>{await sb.from('sessions').update({status:'completed'}).eq('id',s.id);load()}}
                                          className="w-7 h-7 flex items-center justify-center rounded-lg text-white text-xs font-bold"
                                          style={{backgroundColor:'var(--mlc-teal)'}}>✓</button>
                                      )}
                                      <button title="Edit" onClick={()=>setEditingSession(s)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                                        <Pencil size={12}/>
                                      </button>
                                      <button title="Delete" onClick={()=>{setDeletingSession(s);setDeleteSeries(false)}}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                        <Trash2 size={12}/>
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Rooms ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Physical rooms</p>
            {physicalRooms.length === 0 ? <div className="card text-center py-6 text-gray-400 text-sm">No physical rooms yet.</div>
            : <div className="space-y-2">{physicalRooms.map(r=>(
              <div key={r.id} className="card flex items-start justify-between py-3">
                <div>
                  <div className="flex items-center gap-2"><MapPin size={14} className="text-gray-400"/><p className="text-sm font-medium">{r.name}</p></div>
                  <div className="flex items-center gap-1.5 mt-0.5 ml-5"><Users size={11} className="text-gray-400"/><p className="text-xs text-gray-400">Capacity: {r.capacity}</p></div>
                  {r.notes&&<p className="text-xs text-gray-500 ml-5 mt-1">{r.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>openRoomModal(r)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-50"><Pencil size={13}/></button>
                  <button onClick={()=>setDeletingRoom(r)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}</div>}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Zoom / Online</p>
            {zoomRooms.length === 0 ? <div className="card text-center py-6 text-gray-400 text-sm">No Zoom links yet.</div>
            : <div className="space-y-2">{zoomRooms.map(r=>(
              <div key={r.id} className="card flex items-start justify-between py-3">
                <div>
                  <div className="flex items-center gap-2"><Monitor size={14} className="text-gray-400"/><p className="text-sm font-medium">{r.name}</p></div>
                  {r.zoom_link&&<a href={r.zoom_link} target="_blank" rel="noopener noreferrer" className="text-xs ml-5 truncate block max-w-[200px]" style={{color:'var(--mlc-teal)'}}>{r.zoom_link}</a>}
                  {r.notes&&<p className="text-xs text-gray-500 ml-5 mt-1">{r.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>openRoomModal(r)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-50"><Pencil size={13}/></button>
                  <button onClick={()=>setDeletingRoom(r)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}</div>}
          </div>
        </div>
      </div>

      {/* Room modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editRoom?'Edit room':'Add room'}</h2>
              <button onClick={()=>setShowRoomModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <form onSubmit={saveRoom} className="px-6 py-5 space-y-4">
              <div><label className="label">Room name <span className="text-red-500">*</span></label><input className="input" required value={roomForm.name} onChange={e=>setRoomForm(f=>({...f,name:e.target.value}))}/></div>
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  {[{value:'physical',label:'Physical',icon:MapPin},{value:'zoom',label:'Zoom',icon:Monitor}].map(t=>(
                    <button key={t.value} type="button" onClick={()=>setRoomForm(f=>({...f,type:t.value}))}
                      className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors',
                        roomForm.type===t.value?'text-white border-transparent':'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )} style={roomForm.type===t.value?{backgroundColor:'var(--mlc-teal)'}:{}}>
                      <t.icon size={14}/> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {roomForm.type==='physical'&&<div><label className="label">Capacity</label><input className="input" type="number" min="1" value={roomForm.capacity} onChange={e=>setRoomForm(f=>({...f,capacity:e.target.value}))}/></div>}
              {roomForm.type==='zoom'&&<div><label className="label">Zoom link</label><input className="input" placeholder="https://zoom.us/j/..." value={roomForm.zoom_link} onChange={e=>setRoomForm(f=>({...f,zoom_link:e.target.value}))}/></div>}
              <div><label className="label">Notes / Equipment</label><textarea className="input resize-none" rows={2} value={roomForm.notes} onChange={e=>setRoomForm(f=>({...f,notes:e.target.value}))}/></div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={()=>setShowRoomModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={roomSaving}>{roomSaving?'Saving…':editRoom?'Save':'Add room'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewSession && <NewSessionModal onClose={()=>setShowNewSession(false)} onSuccess={()=>{setShowNewSession(false);load()}}/>}
      {editingSession && <EditSessionModal session={editingSession} onClose={()=>setEditingSession(null)} onSuccess={()=>{setEditingSession(null);load()}}/>}

      {/* Delete session confirm */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-red-500"/></div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete session?</h3>
                <p className="text-sm text-gray-500 mt-1">{new Date(deletingSession.scheduled_at).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})} · {formatTime(deletingSession.scheduled_at)}</p>
              </div>
            </div>
            {deletingSession.series_id && (
              <div className="mb-5 space-y-2">
                {[{v:false,t:'This session only',d:'Other sessions in the series stay'},{v:true,t:'This & all future sessions',d:`Session ${deletingSession.series_index} onwards deleted`}].map(({v,t,d})=>(
                  <label key={String(v)} onClick={()=>setDeleteSeries(v)}
                    className={cn('flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
                      deleteSeries===v?(v?'border-red-300 bg-red-50':'border-gray-900 bg-gray-50'):'border-gray-200 hover:border-gray-300'
                    )}>
                    <div className={cn('w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
                      deleteSeries===v?(v?'border-red-500 bg-red-500':'border-gray-900 bg-gray-900'):'border-gray-300'
                    )}>
                      {deleteSeries===v&&<div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                    </div>
                    <div><p className="text-sm font-medium text-gray-800">{t}</p><p className="text-xs text-gray-400 mt-0.5">{d}</p></div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={()=>{setDeletingSession(null);setDeleteSeries(false)}} className="btn-secondary flex-1 justify-center" disabled={deleteLoading}>Cancel</button>
              <button onClick={deleteSession} disabled={deleteLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleteLoading?'Deleting…':deleteSeries?'Delete sessions':'Delete session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingRoom && <ConfirmDialog title="Delete room" message={`Delete "${deletingRoom.name}"?`} onConfirm={deleteRoom} onCancel={()=>setDeletingRoom(null)}/>}

      {/* Delete all sessions for student confirm */}
      {deletingAllStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500"/>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete all sessions?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete all <span className="font-semibold text-gray-800">{deletingAllStudent.ids.length} sessions</span> for{' '}
                  <span className="font-semibold text-gray-800">{deletingAllStudent.name}</span>.
                </p>
                <p className="text-xs text-red-500 mt-2 bg-red-50 px-3 py-2 rounded-lg">
                  ⚠ This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingAllStudent(null)}
                className="btn-secondary flex-1 justify-center"
                disabled={deleteAllLoading}>
                Cancel
              </button>
              <button
                onClick={deleteAllStudentSessions}
                disabled={deleteAllLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleteAllLoading ? 'Deleting…' : `Delete ${deletingAllStudent.ids.length} sessions`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
