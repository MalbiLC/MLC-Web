'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAllSessions } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime, formatDuration } from '@/lib/utils'
import { Plus, X, MapPin, Monitor, Users, Trash2, Pencil,
         Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
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
  group: 'Group', semi_private: 'Semi-Private', private: 'Private', private_online: 'Online'
}

interface Room { id: string; name: string; type: string; zoom_link: string | null; capacity: number; notes: string | null }

// Group sessions by student name
function groupByStudent(sessions: CalendarSession[]) {
  const map: Record<string, { studentName: string; sessions: CalendarSession[] }> = {}
  for (const s of sessions) {
    for (const st of s.students) {
      if (!map[st.id]) map[st.id] = { studentName: st.full_name, sessions: [] }
      map[st.id].sessions.push(s)
    }
    // Also include sessions with no students linked (shouldn't happen but just in case)
    if (s.students.length === 0) {
      const key = `__no_student_${s.id}`
      map[key] = { studentName: '—', sessions: [s] }
    }
  }
  return Object.entries(map).sort(([,a],[,b]) => a.studentName.localeCompare(b.studentName))
}

export default function SchedulingPage() {
  useAuth()
  const sb = createClient()

  const [rooms, setRooms]               = useState<Room[]>([])
  const [sessions, setSessions]         = useState<CalendarSession[]>([])
  const [loading, setLoading]           = useState(true)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [showNewSession, setShowNewSession] = useState(false)
  const [editingSession,  setEditingSession]  = useState<CalendarSession | null>(null)
  const [deletingSession, setDeletingSession] = useState<CalendarSession | null>(null)
  const [deleteLoading,   setDeleteLoading]   = useState(false)
  const [deleteSeries,    setDeleteSeries]    = useState(false)

  // Room modal
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editRoom, setEditRoom]           = useState<Room | null>(null)
  const [deletingRoom, setDeletingRoom]   = useState<Room | null>(null)
  const [roomForm, setRoomForm]           = useState({ name:'', type:'physical', zoom_link:'', capacity:'1', notes:'' })
  const [roomSaving, setRoomSaving]       = useState(false)

  // Filters
  const [searchStudent, setSearchStudent] = useState('')
  const [searchTeacher, setSearchTeacher] = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [filterFrom,    setFilterFrom]    = useState('')
  const [filterTo,      setFilterTo]      = useState('')
  const [showFilters,   setShowFilters]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, data] = await Promise.all([
      sb.from('rooms').select('*').order('type').order('name'),
      getAllSessions(1, 6),
    ])
    setRooms(r || [])
    setSessions(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = sb.channel('sched-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'sessions' }, load)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [load])

  // Apply filters to sessions before grouping
  const filteredSessions = useMemo(() => sessions.filter(s => {
    if (searchStudent && !s.students.some(st => st.full_name.toLowerCase().includes(searchStudent.toLowerCase()))) return false
    if (searchTeacher && !s.teacher_name.toLowerCase().includes(searchTeacher.toLowerCase())) return false
    if (filterType && s.class_type !== filterType) return false
    if (filterFrom && new Date(s.scheduled_at) < new Date(filterFrom)) return false
    if (filterTo   && new Date(s.scheduled_at) > new Date(filterTo + 'T23:59:59')) return false
    return true
  }), [sessions, searchStudent, searchTeacher, filterType, filterFrom, filterTo])

  const studentGroups = useMemo(() => groupByStudent(filteredSessions), [filteredSessions])
  const hasFilters = searchStudent || searchTeacher || filterType || filterFrom || filterTo
  const clearFilters = () => { setSearchStudent(''); setSearchTeacher(''); setFilterType(''); setFilterFrom(''); setFilterTo('') }

  // Room CRUD
  const openRoomModal = (room?: Room) => {
    setEditRoom(room ?? null)
    setRoomForm(room
      ? { name: room.name, type: room.type, zoom_link: room.zoom_link||'', capacity: String(room.capacity||1), notes: room.notes||'' }
      : { name:'', type:'physical', zoom_link:'', capacity:'1', notes:'' })
    setShowRoomModal(true)
  }
  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault(); setRoomSaving(true)
    const payload = { name: roomForm.name, type: roomForm.type, zoom_link: roomForm.zoom_link||null, capacity: parseInt(roomForm.capacity)||1, notes: roomForm.notes||null, is_available: true }
    if (editRoom) await sb.from('rooms').update(payload).eq('id', editRoom.id)
    else          await sb.from('rooms').insert(payload)
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
    try {
      if (deleteSeries && deletingSession.series_id) {
        // Delete all sessions in this series from this point forward
        await sb.from('sessions')
          .delete()
          .eq('series_id', deletingSession.series_id)
          .gte('series_index', deletingSession.series_index ?? 1)
      } else {
        await sb.from('sessions').delete().eq('id', deletingSession.id)
      }
      setDeletingSession(null)
      setDeleteSeries(false)
      load()
    } finally {
      setDeleteLoading(false)
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

        {/* ── Sessions by student ───────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Students with sessions
              {!loading && <span className="text-gray-300"> · {studentGroups.length}</span>}
            </p>
            <button onClick={() => setShowFilters(v => !v)}
              className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                showFilters || hasFilters ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
              style={(showFilters || hasFilters) ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
              <Filter size={13}/> Filters {hasFilters && '·'}
            </button>
          </div>

          {/* Filters */}
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
              {hasFilters && <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-700 underline">Clear filters</button>}
            </div>
          )}

          {/* Student group list */}
          {loading ? <p className="text-sm text-gray-400 py-4">Loading…</p>
          : studentGroups.length === 0 ? (
            <div className="card text-center py-12 text-gray-400 text-sm">
              {hasFilters ? 'No sessions match your filters.' : 'No sessions yet. Click "New session" to create one.'}
            </div>
          ) : (
            <div className="space-y-2">
              {studentGroups.map(([studentId, { studentName, sessions: studentSessions }]) => {
                const isOpen = expanded === studentId

                // Group this student's sessions by subject
                const bySubject: Record<string, CalendarSession[]> = {}
                for (const s of studentSessions) {
                  const key = s.subject_name || 'Unknown'
                  if (!bySubject[key]) bySubject[key] = []
                  bySubject[key].push(s)
                }

                const upcoming  = studentSessions.filter(s => s.status === 'scheduled').length
                const completed = studentSessions.filter(s => s.status === 'completed').length
                const subjects  = Object.keys(bySubject)

                // Get class type from first session
                const firstType = studentSessions[0]?.class_type ?? ''
                const colors    = CT_COLORS[firstType] || CT_COLORS.private

                return (
                  <div key={studentId} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    {/* Collapsed row */}
                    <button type="button" onClick={() => setExpanded(isOpen ? null : studentId)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
                      {/* Color bar */}
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: colors.border }}/>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{studentName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {subjects.map(sub => (
                            <span key={sub} className="badge bg-gray-100 text-gray-600">{sub}</span>
                          ))}
                          {firstType && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: colors.bg, color: colors.text }}>
                              {CT_LABELS[firstType]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400 shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-gray-700 text-sm">{upcoming}</p>
                          <p>upcoming</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-700 text-sm">{completed}</p>
                          <p>done</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-700 text-sm">{studentSessions.length}</p>
                          <p>total</p>
                        </div>
                      </div>

                      {isOpen
                        ? <ChevronUp size={15} className="text-gray-400 shrink-0"/>
                        : <ChevronDown size={15} className="text-gray-400 shrink-0"/>
                      }
                    </button>

                    {/* Expanded: sessions per subject */}
                    {isOpen && (
                      <div className="border-t border-gray-50 bg-gray-50/30 px-5 py-4 space-y-4">
                        {Object.entries(bySubject).map(([subjectName, subSessions]) => {
                          const upcomingHere  = subSessions.filter(s => s.status === 'scheduled').length
                          const completedHere = subSessions.filter(s => s.status === 'completed').length
                          return (
                            <div key={subjectName}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="badge bg-gray-200 text-gray-700 font-semibold">{subjectName}</span>
                                <span className="text-xs text-gray-400">
                                  {upcomingHere} upcoming · {completedHere} done · {subSessions.length} total
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {subSessions
                                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                                  .map(s => {
                                    const isPast = new Date(s.scheduled_at) < new Date()
                                    const c = CT_COLORS[s.class_type || 'private'] || CT_COLORS.private
                                    return (
                                      <div key={s.id}
                                        className={cn('flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-lg',
                                          s.status === 'cancelled' && 'opacity-40'
                                        )}>
                                        <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: c.border }}/>

                                        {/* Date / time */}
                                        <div className="w-24 shrink-0">
                                          <p className="text-xs font-medium text-gray-800">
                                            {new Date(s.scheduled_at).toLocaleDateString('id-ID', { day:'numeric', month:'short' })}
                                          </p>
                                          <p className="text-xs text-gray-400">{formatTime(s.scheduled_at)}</p>
                                        </div>

                                        {/* Teacher / room */}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-gray-500 truncate">
                                            {s.teacher_name}
                                            {s.room_name && <> · {s.room_name}</>}
                                          </p>
                                          {s.series_index && (
                                            <p className="text-xs text-gray-300">Session {s.series_index}</p>
                                          )}
                                        </div>

                                        {/* Status badge */}
                                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                                          s.status === 'completed'   ? 'bg-teal-50 text-teal-700' :
                                          s.status === 'cancelled'   ? 'bg-gray-100 text-gray-400' :
                                          s.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' :
                                          isPast ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
                                        )}>
                                          {s.status === 'scheduled' && isPast ? 'overdue' : s.status}
                                        </span>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          {/* Quick complete */}
                                          {s.status === 'scheduled' && (
                                            <button title="Mark completed"
                                              onClick={async () => { await sb.from('sessions').update({ status: 'completed' }).eq('id', s.id); load() }}
                                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white text-xs font-bold hover:opacity-90 transition-opacity"
                                              style={{ backgroundColor: 'var(--mlc-teal)' }}>
                                              ✓
                                            </button>
                                          )}
                                          {/* Edit */}
                                          <button title="Edit session"
                                            onClick={() => setEditingSession(s)}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                                            <Pencil size={12}/>
                                          </button>
                                          {/* Delete */}
                                          <button title="Delete session"
                                            onClick={() => { setDeletingSession(s); setDeleteSeries(false) }}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 size={12}/>
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Rooms ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Physical rooms</p>
            {physicalRooms.length === 0
              ? <div className="card text-center py-6 text-gray-400 text-sm">No physical rooms yet.</div>
              : <div className="space-y-2">
                  {physicalRooms.map(r => (
                    <div key={r.id} className="card flex items-start justify-between py-3">
                      <div>
                        <div className="flex items-center gap-2"><MapPin size={14} className="text-gray-400"/><p className="text-sm font-medium">{r.name}</p></div>
                        <div className="flex items-center gap-1.5 mt-0.5 ml-5"><Users size={11} className="text-gray-400"/><p className="text-xs text-gray-400">Capacity: {r.capacity}</p></div>
                        {r.notes && <p className="text-xs text-gray-500 ml-5 mt-1">{r.notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openRoomModal(r)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-50"><Pencil size={13}/></button>
                        <button onClick={() => setDeletingRoom(r)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Zoom / Online</p>
            {zoomRooms.length === 0
              ? <div className="card text-center py-6 text-gray-400 text-sm">No Zoom links yet.</div>
              : <div className="space-y-2">
                  {zoomRooms.map(r => (
                    <div key={r.id} className="card flex items-start justify-between py-3">
                      <div>
                        <div className="flex items-center gap-2"><Monitor size={14} className="text-gray-400"/><p className="text-sm font-medium">{r.name}</p></div>
                        {r.zoom_link && <a href={r.zoom_link} target="_blank" rel="noopener noreferrer" className="text-xs ml-5 truncate block max-w-[200px]" style={{ color:'var(--mlc-teal)' }}>{r.zoom_link}</a>}
                        {r.notes && <p className="text-xs text-gray-500 ml-5 mt-1">{r.notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openRoomModal(r)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-50"><Pencil size={13}/></button>
                        <button onClick={() => setDeletingRoom(r)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>

      {/* Room modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editRoom ? 'Edit room' : 'Add room'}</h2>
              <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <form onSubmit={saveRoom} className="px-6 py-5 space-y-4">
              <div><label className="label">Room name <span className="text-red-500">*</span></label><input className="input" required value={roomForm.name} onChange={e => setRoomForm(f=>({...f,name:e.target.value}))}/></div>
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  {[{value:'physical',label:'Physical',icon:MapPin},{value:'zoom',label:'Zoom',icon:Monitor}].map(t=>(
                    <button key={t.value} type="button" onClick={()=>setRoomForm(f=>({...f,type:t.value}))}
                      className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors',
                        roomForm.type===t.value?'text-white border-transparent':'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={roomForm.type===t.value?{backgroundColor:'var(--mlc-teal)'}:{}}>
                      <t.icon size={14}/> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {roomForm.type==='physical' && <div><label className="label">Capacity</label><input className="input" type="number" min="1" value={roomForm.capacity} onChange={e=>setRoomForm(f=>({...f,capacity:e.target.value}))}/></div>}
              {roomForm.type==='zoom'     && <div><label className="label">Zoom link</label><input className="input" placeholder="https://zoom.us/j/..." value={roomForm.zoom_link} onChange={e=>setRoomForm(f=>({...f,zoom_link:e.target.value}))}/></div>}
              <div><label className="label">Notes / Equipment</label><textarea className="input resize-none" rows={2} value={roomForm.notes} onChange={e=>setRoomForm(f=>({...f,notes:e.target.value}))}/></div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={()=>setShowRoomModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={roomSaving}>{roomSaving?'Saving…':editRoom?'Save':'Add room'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewSession && <NewSessionModal onClose={()=>setShowNewSession(false)} onSuccess={()=>{setShowNewSession(false);load()}}/> }

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSuccess={() => { setEditingSession(null); load() }}
        />
      )}

      {/* Delete session confirm — with optional series delete */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500"/>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete session?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(deletingSession.scheduled_at).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}
                  {' · '}{formatTime(deletingSession.scheduled_at)}
                  {deletingSession.class_name && ` · ${deletingSession.class_name}`}
                </p>
              </div>
            </div>

            {/* Series option — only show if session is part of a series */}
            {deletingSession.series_id && (
              <div className="mb-5 space-y-2">
                <label className={cn(
                  'flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
                  !deleteSeries ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                )} onClick={() => setDeleteSeries(false)}>
                  <div className={cn('w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
                    !deleteSeries ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                  )}>
                    {!deleteSeries && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">This session only</p>
                    <p className="text-xs text-gray-400 mt-0.5">Other sessions in the series stay</p>
                  </div>
                </label>
                <label className={cn(
                  'flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
                  deleteSeries ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                )} onClick={() => setDeleteSeries(true)}>
                  <div className={cn('w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
                    deleteSeries ? 'border-red-500 bg-red-500' : 'border-gray-300'
                  )}>
                    {deleteSeries && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      This &amp; all future sessions in series
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Session {deletingSession.series_index} onwards will be deleted
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setDeletingSession(null); setDeleteSeries(false) }}
                className="btn-secondary flex-1 justify-center" disabled={deleteLoading}>
                Cancel
              </button>
              <button onClick={deleteSession} disabled={deleteLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleteLoading ? 'Deleting…' : deleteSeries ? 'Delete sessions' : 'Delete session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingRoom && <ConfirmDialog title="Delete room" message={`Delete "${deletingRoom.name}"?`} onConfirm={deleteRoom} onCancel={()=>setDeletingRoom(null)}/> }
    </div>
  )
}
