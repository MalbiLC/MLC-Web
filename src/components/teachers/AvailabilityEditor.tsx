'use client'

import { Plus, Trash2 } from 'lucide-react'
import { DAYS } from '@/types/teachers'
import type { AvailabilitySlot } from '@/types/teachers'

interface Props {
  slots: AvailabilitySlot[]
  onChange: (slots: AvailabilitySlot[]) => void
}

export default function AvailabilityEditor({ slots, onChange }: Props) {
  const add = () => onChange([...slots, { day_of_week: 1, slot_start: '09:00', slot_end: '17:00' }])
  const remove = (i: number) => onChange(slots.filter((_, idx) => idx !== i))
  const update = (i: number, k: keyof AvailabilitySlot, v: string | number) =>
    onChange(slots.map((s, idx) => idx === i ? { ...s, [k]: v } : s))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">Weekly availability</label>
        <button type="button" onClick={add}
          className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
          <Plus size={12} /> Add slot
        </button>
      </div>
      {slots.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No availability slots — click Add slot to set schedule.</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot, i) => (
            <div key={i} className="grid grid-cols-[140px_1fr_1fr_28px] gap-2 items-center">
              <select
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={slot.day_of_week}
                onChange={e => update(i, 'day_of_week', parseInt(e.target.value))}>
                {DAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
              </select>
              <input type="time" value={slot.slot_start}
                onChange={e => update(i, 'slot_start', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              <input type="time" value={slot.slot_end}
                onChange={e => update(i, 'slot_end', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              <button type="button" onClick={() => remove(i)}
                className="flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="grid grid-cols-[140px_1fr_1fr_28px] gap-2 text-xs text-gray-400 px-0.5">
            <span>Day</span><span>From</span><span>To</span><span />
          </div>
        </div>
      )}
    </div>
  )
}
