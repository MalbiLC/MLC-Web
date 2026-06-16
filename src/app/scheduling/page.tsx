'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAllSessions } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime, formatDuration } from '@/lib/utils'
import { Plus, X, MapPin, Monitor, Users, Trash2, Pencil, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import NewSessionModal from '@/components/sessions/NewSessionModal'
import { useAuth } from '@/hooks/useAuth'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLASS_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  group:          { bg: '#E6F4F2', text: '#0F7B6C', border: '#0F7B6C' },
  semi_private:   { bg: '#E8F0FA', text: '#1A5FA8', border: '#1A5FA8' },
  private:        { bg: '#FEF3DC', text: '#B45309', border: '#E8A020' },
  private_online: { bg: '#F0F0FE', text: '#4338CA', border: '#6366F1' },
}

const CLASS_TYPE_LABELS: Record<string, string> = {
  group: 'Group', semi_private: 'Semi-Private', private: 'Private', private_online: 'Online'
}

interface Room { id: string; name: string; type: string; zoom_link: string | null; is_available: boolean; capacity: number; notes: string | null }

export default function SchedulingPage() {
  useAuth()
  const sb = createClient()

  // Rooms
  const [rooms, setRooms] = useState<Room[]>([])
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState({ name: '', type: 'physical', zoom_link: '', capacity: '1', notes: '' })
  const [roomSaving, setRoomSaving] = useState(false)

  // Sessions
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [showNewSession, setShowNewSession] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Filters
  const [searchStudent, setSearchStudent] = useState('')
  const [searchTeacher, setSearchTeacher] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    // Load rooms
    const { data: r } = await sb.from('rooms').select('*').order('type').order('name')
    setRooms(r || [])

    // Load all sessions (1 month back, 6 months ahead)
    const data = await getAllSessions(1, 6)
    setSessions(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    // Realtime refresh
    const sb = createClient()
    const channel = sb
      .channel('scheduling-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [load])

  // Filter sessions
  const filtered = sessions.filter(s => {
    if (searchStudent && !s.students.some(st => st.full_name.toLowerCase().includes(searchStudent.toLowerCase()))) return false
    if (searchTeacher && !s.teacher_name.toLowerCase().includes(searchTeacher.toLowerCase())) return false
    if (filterType && s.class_type !== filterType) return false
    if (filterFrom && new Date(s.scheduled_at) < new Date(filterFrom)) return false
    if (filterTo && new Date(s.scheduled_at) > new Date(filterTo + 'T23:59:59')) return false
    return true
  })

  const hasFilters = searchStudent || searchTeacher || filterType || filterFrom || filterTo
  const clearFilters = () => { setSearchStudent(''); setSearchTeacher(''); setFilterType(''); setFilterFrom(''); setFilterTo('') }

  // Room CRUD
  const openRoomModal = (room?: Room) => {
    if (room) { setEditRoom(room); setRoomForm({ name: room.name, type: room.type, zoom_link: room.zoom_link || '', capacity: String(room.capacity || 1), notes: room.notes || '' }) }
    else { setEditRoom(null); setRoomForm({ name: '', type: 'physical', zoom_link: '', capacity: '1', notes: '' }) }
    setShowRoomModal(true)
  }

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault(); setRoomSaving(true)
    const payload = { name: roomForm.name, type: roomForm.type, zoom_link: roomForm.zoom_link || null, capacity: parseInt(roomForm.capacity) || 1, notes: roomForm.notes || null, is_available: true }
    if (editRoom) await sb.from('rooms').update(payload).eq('id', editRoom.id)
    else await sb.from('rooms').insert(payload)
    setRoomSaving(false); setShowRoomModal(false); load()
  }

  const deleteRoom = async () => {
    if (!deletingRoom) return
    await sb.from('rooms').delete().eq('id', deletingRoom.id)
    setDeletingRoom(null); load()
  }

  const cancelSession = async (id: string) => {
    await sb.from('sessions').update({ status: 'cancelled' }).eq('id', id)
    load()
  }

  const physicalRooms = rooms.filter(r => r.type === 'physical')
  const zoomRooms     = rooms.filter(r => r.type === 'zoom')

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Scheduling</h1>
        <div className="flex gap-2">
          <button onClick={() => openRoomModal()} className="btn-secondary"><Plus size={15} /> Add room</button>
          <button onClick={() => setShowNewSession(true)} className="btn-primary"><Plus size={15} /> New session</button>
        </div>
      </div>

      <div className="page-content space-y-8">
        {/* ── Sessions list ──────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              All sessions {!loading && <span className="text-gray-300">· {filtered.length} shown</span>}
            </p>
            <button onClick={() => setShowFilters(v => !v)}
              className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                showFilters || hasFilters ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
              style={(showFilters || hasFilters) ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
              <Filter size={13} /> Filters {hasFilters && '•'}
            </button>
          </div>

          {/* Filter row */}
          {showFilters && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-8 text-sm" placeholder="Student name…"
                    value={searchStudent} onChange={e => setSearchStudent(e.target.value)} />
                </div>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-8 text-sm" placeholder="Teacher name…"
                    value={searchTeacher} onChange={e => setSearchTeacher(e.target.value)} />
                </div>
                <select className="input text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All class types</option>
                  {Object.entries(CLASS_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <div className="flex gap-2">
                  <input className="input text-sm flex-1" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date" />
                  <input className="input text-sm flex-1" type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To date" />
                </div>
              </div>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-700 underline">Clear all filters</button>
              )}
            </div>
          )}

          {/* Session rows */}
          {loading ? <p className="text-sm text-gray-400 py-4">Loading…</p> : filtered.length === 0 ? (
            <div className="card text-center py-12 text-gray-400 text-sm">
              {hasFilters ? 'No sessions match your filters.' : 'No sessions yet. Click "New session" to create one.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => {
                const colors = CLASS_TYPE_COLORS[s.class_type || 'private'] || CLASS_TYPE_COLORS.private
                const isExpanded = expanded === s.id
                const scheduledDate = new Date(s.scheduled_at)
                const endDate = new Date(scheduledDate.getTime() + s.duration_minutes * 60000)
                const isPast = scheduledDate < new Date()

                return (
                  <div key={s.id} className={cn('bg-white border border-gray-100 rounded-xl overflow-hidden transition-opacity', s.status === 'cancelled' && 'opacity-50')}>
                    {/* Collapsed row */}
                    <button type="button" onClick={() => setExpanded(isExpanded ? null : s.id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50/50 transition-colors">

                      {/* Color bar */}
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: colors.border }} />

                      {/* Date/time */}
                      <div className="w-28 shrink-0">
                        <p className="text-sm font-medium text-gray-900">{scheduledDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                        <p className="text-xs text-gray-400">{formatTime(s.scheduled_at)} · {formatDuration(s.duration_minutes)}</p>
                      </div>

                      {/* Class info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {s.class_name || s.subject_name || 'Session'}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium" style={{ backgroundColor: colors.bg, color: colors.text }}>
                            {CLASS_TYPE_LABELS[s.class_type || 'private']}
                          </span>
                          {s.subject_name && <span className="badge bg-gray-100 text-gray-600 shrink-0">{s.subject_name}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {s.teacher_name}
                          {s.room_name && ` · ${s.room_name}`}
                          {s.students.length > 0 && ` · ${s.students.map(st => st.full_name.split(' ')[0]).join(', ')}`}
                        </p>
                      </div>

                      {/* Status */}
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full shrink-0',
                        s.status === 'completed'   ? 'bg-teal-50 text-teal-700' :
                        s.status === 'cancelled'   ? 'bg-gray-100 text-gray-400' :
                        s.status === 'rescheduled' ? 'bg-amber-50 text-amber-700' :
                        isPast ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
                      )}>
                        {s.status === 'scheduled' && isPast ? 'overdue' : s.status}
                      </span>

                      {isExpanded ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-50 bg-gray-50/40 px-5 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Date & time</p>
                            <p className="font-medium text-gray-800">{scheduledDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                            <p className="text-gray-500 text-xs">{formatTime(s.scheduled_at)} – {endDate.toTimeString().slice(0,5)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Teacher</p>
                            <p className="font-medium text-gray-800">{s.teacher_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Location</p>
                            <div className="flex items-center gap-1.5 text-gray-700">
                              {s.room_type === 'zoom' ? <Monitor size={13} className="text-gray-400" /> : <MapPin size={13} className="text-gray-400" />}
                              <span>{s.room_name || '—'}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                            <p className="font-medium text-gray-800">{formatDuration(s.duration_minutes)}</p>
                          </div>
                        </div>

                        {/* Students */}
                        {s.students.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Users size={12} /> Students ({s.students.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {s.students.map(st => (
                                <div key={st.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-xs">
                                  <span className="font-medium text-gray-700">{st.full_name}</span>
                                  <span className={cn('font-medium',
                                    st.sessions_remaining === 0 ? 'text-red-500' :
                                    st.sessions_remaining <= 2 ? 'text-amber-500' : 'text-teal-600'
                                  )}>{st.sessions_remaining} left</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {s.notes && <p className="text-xs text-gray-500 mb-4 italic">{s.notes}</p>}

                        {/* Actions */}
                        {s.status === 'scheduled' && (
                          <div className="flex gap-2 pt-3 border-t border-gray-100">
                            <button onClick={async () => { await sb.from('sessions').update({ status: 'completed' }).eq('id', s.id); load() }}
                              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-colors"
                              style={{ backgroundColor: 'var(--mlc-teal)' }}>
                              ✓ Mark completed
                            </button>
                            <button onClick={async () => { await sb.from('sessions').update({ status: 'rescheduled' }).eq('id', s.id); load() }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-medium hover:bg-amber-100 transition-colors">
                              Reschedule
                            </button>
                            <button onClick={() => cancelSession(s.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 font-medium hover:bg-gray-100 transition-colors">
                              Cancel this session
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Rooms ────────────────────────────────────── */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Physical rooms</p>
              {physicalRooms.length === 0 ? (
                <div className="card text-center py-6 text-gray-400 text-sm">No physical rooms yet.</div>
              ) : (
                <div className="space-y-2">
                  {physicalRooms.map(room => (
                    <div key={room.id} className="card flex items-start justify-between py-3">
                      <div>
                        <div className="flex items-center gap-2"><MapPin size={14} className="text-gray-400" /><p className="text-sm font-medium">{room.name}</p></div>
                        <div className="flex items-center gap-1.5 mt-0.5 ml-5"><Users size={11} className="text-gray-400" /><p className="text-xs text-gray-400">Capacity: {room.capacity}</p></div>
                        {room.notes && <p className="text-xs text-gray-500 ml-5 mt-1">{room.notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openRoomModal(room)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-50"><Pencil size={13} /></button>
                        <button onClick={() => setDeletingRoom(room)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Zoom / Online</p>
              {zoomRooms.length === 0 ? (
                <div className="card text-center py-6 text-gray-400 text-sm">No Zoom links yet.</div>
              ) : (
                <div className="space-y-2">
                  {zoomRooms.map(room => (
                    <div key={room.id} className="card flex items-start justify-between py-3">
                      <div>
                        <div className="flex items-center gap-2"><Monitor size={14} className="text-gray-400" /><p className="text-sm font-medium">{room.name}</p></div>
                        {room.zoom_link && <a href={room.zoom_link} target="_blank" rel="noopener noreferrer" className="text-xs ml-5 truncate block max-w-[200px]" style={{ color: 'var(--mlc-teal)' }}>{room.zoom_link}</a>}
                        {room.notes && <p className="text-xs text-gray-500 ml-5 mt-1">{room.notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openRoomModal(room)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-50"><Pencil size={13} /></button>
                        <button onClick={() => setDeletingRoom(room)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Room modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editRoom ? 'Edit room' : 'Add room'}</h2>
              <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={saveRoom} className="px-6 py-5 space-y-4">
              <div><label className="label">Room name <span className="text-red-500">*</span></label><input className="input" required value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  {[{ value: 'physical', label: 'Physical', icon: MapPin }, { value: 'zoom', label: 'Zoom', icon: Monitor }].map(t => (
                    <button key={t.value} type="button" onClick={() => setRoomForm(f => ({ ...f, type: t.value }))}
                      className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors',
                        roomForm.type === t.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={roomForm.type === t.value ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      <t.icon size={14} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {roomForm.type === 'physical' && <div><label className="label">Capacity</label><input className="input" type="number" min="1" value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: e.target.value }))} /></div>}
              {roomForm.type === 'zoom' && <div><label className="label">Zoom link</label><input className="input" placeholder="https://zoom.us/j/..." value={roomForm.zoom_link} onChange={e => setRoomForm(f => ({ ...f, zoom_link: e.target.value }))} /></div>}
              <div><label className="label">Notes / Equipment</label><textarea className="input resize-none" rows={2} value={roomForm.notes} onChange={e => setRoomForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowRoomModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={roomSaving}>{roomSaving ? 'Saving…' : editRoom ? 'Save' : 'Add room'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewSession && <NewSessionModal onClose={() => setShowNewSession(false)} onSuccess={() => { setShowNewSession(false); load() }} />}
      {deletingRoom && <ConfirmDialog title="Delete room" message={`Delete "${deletingRoom.name}"?`} onConfirm={deleteRoom} onCancel={() => setDeletingRoom(null)} />}
    </div>
  )
}
