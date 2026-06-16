'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Plus, X, MapPin, Monitor, Users, Trash2, Pencil } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import NewSessionModal from '@/components/sessions/NewSessionModal'
import { useAuth } from '@/hooks/useAuth'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Room {
  id: string; name: string; type: string
  zoom_link: string | null; is_available: boolean
  capacity: number; notes: string | null
}

export default function SchedulingPage() {
  useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  // Room modal
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState({ name: '', type: 'physical', zoom_link: '', capacity: '1', notes: '' })
  const [roomSaving, setRoomSaving] = useState(false)

  // New session modal
  const [showNewSession, setShowNewSession] = useState(false)

  const sb = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: r } = await sb.from('rooms').select('*').order('type').order('name')
    setRooms(r || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openRoomModal = (room?: Room) => {
    if (room) {
      setEditRoom(room)
      setRoomForm({ name: room.name, type: room.type, zoom_link: room.zoom_link || '', capacity: String(room.capacity || 1), notes: room.notes || '' })
    } else {
      setEditRoom(null)
      setRoomForm({ name: '', type: 'physical', zoom_link: '', capacity: '1', notes: '' })
    }
    setShowRoomModal(true)
  }

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setRoomSaving(true)
    const payload = {
      name: roomForm.name, type: roomForm.type,
      zoom_link: roomForm.zoom_link || null,
      capacity: parseInt(roomForm.capacity) || 1,
      notes: roomForm.notes || null,
      is_available: true,
    }
    if (editRoom) await sb.from('rooms').update(payload).eq('id', editRoom.id)
    else await sb.from('rooms').insert(payload)
    setRoomSaving(false)
    setShowRoomModal(false)
    load()
  }

  const deleteRoom = async () => {
    if (!deletingRoom) return
    await sb.from('rooms').delete().eq('id', deletingRoom.id)
    setDeletingRoom(null)
    load()
  }

  const physicalRooms = rooms.filter(r => r.type === 'physical')
  const zoomRooms     = rooms.filter(r => r.type === 'zoom')

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Scheduling</h1>
        <div className="flex gap-2">
          <button onClick={() => openRoomModal()} className="btn-secondary">
            <Plus size={15} /> Add room
          </button>
          <button onClick={() => setShowNewSession(true)} className="btn-primary">
            <Plus size={15} /> New session
          </button>
        </div>
      </div>

      <div className="page-content space-y-6">
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (<>

          {/* Physical rooms */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Physical rooms</p>
            {physicalRooms.length === 0 ? (
              <div className="card text-center py-8 text-gray-400 text-sm">No physical rooms yet. Click &quot;Add room&quot; to add one.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {physicalRooms.map(room => (
                  <div key={room.id} className="card flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <MapPin size={15} className="text-gray-400 shrink-0" />
                          <p className="text-sm font-medium text-gray-900">{room.name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 ml-5">
                          <Users size={12} className="text-gray-400" />
                          <p className="text-xs text-gray-400">Capacity: {room.capacity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openRoomModal(room)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setDeletingRoom(room)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {room.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{room.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zoom rooms */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Zoom / Online</p>
            {zoomRooms.length === 0 ? (
              <div className="card text-center py-8 text-gray-400 text-sm">No Zoom links yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {zoomRooms.map(room => (
                  <div key={room.id} className="card flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Monitor size={15} className="text-gray-400 shrink-0" />
                          <p className="text-sm font-medium text-gray-900">{room.name}</p>
                        </div>
                        {room.zoom_link && (
                          <a href={room.zoom_link} target="_blank" rel="noopener noreferrer"
                            className="text-xs ml-5 mt-0.5 block truncate max-w-[200px]"
                            style={{ color: 'var(--mlc-teal)' }}>
                            {room.zoom_link}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openRoomModal(room)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setDeletingRoom(room)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {room.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{room.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}
      </div>

      {/* Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editRoom ? 'Edit room' : 'Add room'}</h2>
              <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={saveRoom} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Room name <span className="text-red-500">*</span></label>
                <input className="input" placeholder="e.g. Room 1, Zoom A" required
                  value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  {[{ value: 'physical', label: 'Physical room', icon: MapPin },
                    { value: 'zoom', label: 'Zoom / Online', icon: Monitor }].map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setRoomForm(f => ({ ...f, type: t.value }))}
                      className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors',
                        roomForm.type === t.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      )}
                      style={roomForm.type === t.value ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                      <t.icon size={14} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {roomForm.type === 'physical' && (
                <div>
                  <label className="label">Capacity</label>
                  <input className="input" type="number" min="1" placeholder="Number of students"
                    value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: e.target.value }))} />
                </div>
              )}
              {roomForm.type === 'zoom' && (
                <div>
                  <label className="label">Zoom link</label>
                  <input className="input" placeholder="https://zoom.us/j/..."
                    value={roomForm.zoom_link} onChange={e => setRoomForm(f => ({ ...f, zoom_link: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="label">Notes / Equipment</label>
                <textarea className="input resize-none" rows={3}
                  placeholder="e.g. Has projector, large whiteboard, AC…"
                  value={roomForm.notes} onChange={e => setRoomForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowRoomModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={roomSaving}>
                  {roomSaving ? 'Saving…' : editRoom ? 'Save changes' : 'Add room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showNewSession && (
        <NewSessionModal
          onClose={() => setShowNewSession(false)}
          onSuccess={() => { setShowNewSession(false); load() }}
        />
      )}

      {/* Delete confirm */}
      {deletingRoom && (
        <ConfirmDialog
          title="Delete room"
          message={`Are you sure you want to delete "${deletingRoom.name}"?`}
          onConfirm={deleteRoom}
          onCancel={() => setDeletingRoom(null)} />
      )}
    </div>
  )
}
