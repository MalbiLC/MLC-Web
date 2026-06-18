'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatTime } from '@/lib/utils'
import { X, Monitor, MapPin } from 'lucide-react'
import type { CalendarSession } from '@/lib/sessionQueries'

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface Props {
  session: CalendarSession
  onClose: () => void
  onSuccess: () => void
}

export default function EditSessionModal({ session, onClose, onSuccess }: Props) {
  const sb = createClient()

  const scheduled = new Date(session.scheduled_at)

  const [date,      setDate]      = useState(scheduled.toISOString().split('T')[0])
  const [time,      setTime]      = useState(formatTime(session.scheduled_at))
  const [roomId,    setRoomId]    = useState('')
  const [className, setClassName] = useState(session.class_name ?? '')
  const [notes,     setNotes]     = useState(session.notes ?? '')
  const [status,    setStatus]    = useState(session.status)
  const [rooms,     setRooms]     = useState<any[]>([])
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const isOnline = session.class_type === 'private_online'

  useEffect(() => {
    sb.from('rooms').select('*').order('type').order('name')
      .then(({ data }) => {
        setRooms(data || [])
        // Find current room id by name
        const cur = (data || []).find((r: any) => r.name === session.room_name)
        if (cur) setRoomId(cur.id)
      })
  }, [])

  const filteredRooms = rooms.filter(r => isOnline ? r.type === 'zoom' : r.type === 'physical')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const [hh, mm] = time.split(':').map(Number)

      // Build local ISO string — no timezone suffix so Supabase stores the
      // intended local time as-is, avoiding the UTC-shift bug from toISOString().
      const yyyy = date.slice(0, 4)
      const mo   = date.slice(5, 7)
      const dd   = date.slice(8, 10)
      const hhStr  = String(hh).padStart(2, '0')
      const mmStr  = String(mm).padStart(2, '0')
      const scheduledAt = `${yyyy}-${mo}-${dd}T${hhStr}:${mmStr}:00`

      const { error: err } = await sb.from('sessions').update({
        scheduled_at: scheduledAt,
        room_id:      roomId  || null,
        class_name:   className || null,
        notes:        notes   || null,
        status,
      }).eq('id', session.id)

      if (err) throw new Error(err.message)
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold">Edit session</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {session.class_name || session.subject_name || 'Session'} · {session.teacher_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Date & time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)}/>
            </div>
            <div>
              <label className="label">Time</label>
              <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)}/>
            </div>
          </div>

          {/* Class name */}
          <div>
            <label className="label">Class name <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
            <input className="input" placeholder="e.g. Math A" value={className} onChange={e => setClassName(e.target.value)}/>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {(['scheduled','completed','rescheduled','cancelled'] as const).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                    status === s
                      ? s === 'completed'   ? 'bg-teal-600 text-white border-teal-600'
                      : s === 'cancelled'   ? 'bg-red-500 text-white border-red-500'
                      : s === 'rescheduled' ? 'bg-amber-500 text-white border-amber-500'
                                            : 'text-white border-transparent'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  )}
                  style={status === s && s === 'scheduled' ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Room */}
          <div>
            <label className="label">
              Room
              <span className="text-gray-400 text-xs font-normal ml-1">
                ({isOnline ? 'Zoom only' : 'Physical rooms'})
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRoomId('')}
                className={cn('px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors',
                  !roomId ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                )}
                style={!roomId ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                No room
              </button>
              {filteredRooms.map(r => (
                <button key={r.id} type="button" onClick={() => setRoomId(r.id)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors',
                    roomId === r.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}
                  style={roomId === r.id ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                  {r.type === 'zoom' ? <Monitor size={13}/> : <MapPin size={13}/>}
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2} placeholder="Notes for this session…"
              value={notes} onChange={e => setNotes(e.target.value)}/>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              ⚠ {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
