'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSessionsForWeek, generateICS, updateSessionStatus } from '@/lib/sessionQueries'
import type { CalendarSession } from '@/lib/sessionQueries'
import { cn, formatTime } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Download, X,
  Check, RotateCcw, MapPin, Monitor, Users
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const COLORS: Record<string, { bg: string; text: string; border: string }> = {
  group:          { bg: '#E6F4F2', text: '#0F7B6C', border: '#0F7B6C' },
  semi_private:   { bg: '#E8F0FA', text: '#1A5FA8', border: '#1A5FA8' },
  private:        { bg: '#FEF3DC', text: '#B45309', border: '#E8A020' },
  private_online: { bg: '#F0F0FE', text: '#4338CA', border: '#6366F1' },
}
const TYPE_LABELS: Record<string, string> = {
  group: 'Group', semi_private: 'Semi-Private',
  private: 'Private', private_online: 'Online',
}
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const HOURS     = Array.from({ length: 15 }, (_, i) => i + 7) // 7am–9pm
const PX_PER_HR = 60

function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function dateToPx(d: Date): number {
  return ((d.getHours()-7) + d.getMinutes()/60) * PX_PER_HR
}

// Compute column layout to avoid overlapping sessions
function layoutSessions(sessions: CalendarSession[]): Array<{ session: CalendarSession; col: number; totalCols: number }> {
  // Sort by start time
  const sorted = [...sessions].sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const result: Array<{ session: CalendarSession; col: number; totalCols: number }> = []

  // Group overlapping sessions
  const groups: CalendarSession[][] = []
  for (const s of sorted) {
    const sStart = new Date(s.scheduled_at).getTime()
    const sEnd   = sStart + s.duration_minutes * 60000
    let placed   = false
    for (const group of groups) {
      const lastEnd = Math.max(...group.map(g => new Date(g.scheduled_at).getTime() + g.duration_minutes * 60000))
      if (sStart < lastEnd) { group.push(s); placed = true; break }
    }
    if (!placed) groups.push([s])
  }

  for (const group of groups) {
    const totalCols = group.length
    group.forEach((s, col) => result.push({ session: s, col, totalCols }))
  }

  return result
}

function SessionBlock({ session, col, totalCols, onClick }: {
  session: CalendarSession; col: number; totalCols: number; onClick: () => void
}) {
  const start  = new Date(session.scheduled_at)
  const top    = dateToPx(start)
  const height = Math.max((session.duration_minutes / 60) * PX_PER_HR - 2, 18)
  const c      = COLORS[session.class_type || 'private'] || COLORS.private

  if (top < 0 || top > HOURS.length * PX_PER_HR) return null

  // Column layout: divide width evenly
  const widthPct  = 100 / totalCols
  const leftPct   = col * widthPct
  const gutterPx  = col > 0 ? 2 : 0  // small gap between columns

  return (
    <div onClick={onClick}
      className="absolute cursor-pointer overflow-hidden"
      style={{
        top:             `${top}px`,
        height:          `${height}px`,
        left:            `calc(${leftPct}% + ${gutterPx}px)`,
        width:           `calc(${widthPct}% - ${gutterPx + 1}px)`,
        backgroundColor: c.bg,
        borderLeft:      `3px solid ${c.border}`,
        borderRadius:    6,
        padding:         '3px 5px',
        zIndex:          col + 1,
      }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: c.text, lineHeight: '1.3',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {session.class_name || session.subject_name || 'Session'}
      </p>
      {height > 28 && (
        <p style={{ fontSize: 10, color: c.text, opacity: 0.75, lineHeight: '1.3',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatTime(session.scheduled_at)} · {session.teacher_name}
        </p>
      )}
    </div>
  )
}

function DetailPanel({ session, onClose, onRefresh }: {
  session: CalendarSession; onClose: () => void; onRefresh: () => void
}) {
  const [busy, setBusy] = useState(false)
  const c     = COLORS[session.class_type || 'private'] || COLORS.private
  const start = new Date(session.scheduled_at)
  const end   = new Date(start.getTime() + session.duration_minutes * 60_000)

  const act = async (status: string) => {
    setBusy(true)
    await updateSessionStatus(session.id, status)
    setBusy(false); onRefresh(); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: c.bg, color: c.text }}>
                {TYPE_LABELS[session.class_type || 'private']}
              </span>
              {session.subject_name && <span className="badge bg-gray-100 text-gray-600">{session.subject_name}</span>}
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                session.status==='completed'   ? 'bg-teal-50 text-teal-700' :
                session.status==='cancelled'   ? 'bg-gray-100 text-gray-500' :
                session.status==='rescheduled' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
              )}>{session.status}</span>
            </div>
            <h2 className="text-base font-semibold">{session.class_name || session.subject_name || 'Session'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18}/></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Date &amp; time</p>
            <p className="text-sm font-medium text-gray-900">
              {DAY_FULL[start.getDay()]}, {start.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}
            </p>
            <p className="text-xs text-gray-500">{formatTime(session.scheduled_at)} – {end.toTimeString().slice(0,5)} · {session.duration_minutes} min</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Teacher</p>
            <p className="text-sm font-medium text-gray-700">{session.teacher_name}</p>
          </div>
          {session.room_name && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              {session.room_type==='zoom' ? <Monitor size={14} className="text-gray-400"/> : <MapPin size={14} className="text-gray-400"/>}
              {session.room_name}
            </div>
          )}
          {session.students.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1"><Users size={12}/> Students ({session.students.length})</p>
              <div className="space-y-1">
                {session.students.map(s => (
                  <div key={s.id} className="flex items-center px-3 py-2 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{s.full_name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {session.notes && <p className="text-sm text-gray-400 italic">{session.notes}</p>}
        </div>
        {session.status==='scheduled' && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
            <button onClick={()=>act('completed')} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl text-white"
              style={{ backgroundColor:'var(--mlc-teal)' }}>
              <Check size={14}/> Mark completed
            </button>
            <button onClick={()=>act('rescheduled')} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
              <RotateCcw size={14}/> Reschedule
            </button>
          </div>
        )}
        {(session.status==='completed'||session.status==='rescheduled'||session.status==='cancelled') && (
          <div className="px-6 py-4 border-t border-gray-100">
            <button onClick={()=>act('scheduled')} disabled={busy}
              className="w-full py-2.5 text-sm font-medium rounded-xl bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100">
              Restore to scheduled
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [sessions,  setSessions]  = useState<CalendarSession[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<CalendarSession | null>(null)
  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd  = addDays(weekStart, 7)
  const gridH    = HOURS.length * PX_PER_HR

  const load = useCallback(async () => {
    setLoading(true)
    try { setSessions(await getSessionsForWeek(weekStart, weekEnd)) }
    catch (e) { console.error('Calendar load:', e) }
    finally { setLoading(false) }
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
    const sb = createClient()
    const ch = sb.channel('cal-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'sessions' }, load)
      .subscribe()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { sb.removeChannel(ch); window.removeEventListener('focus', onFocus) }
  }, [load])

  const exportICS = () => {
    const blob = new Blob([generateICS(sessions)], { type:'text/calendar' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `mlc-${weekStart.toISOString().split('T')[0]}.ics`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      {/* Header */}
      <div className="page-header shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <div className="flex items-center gap-0.5">
            <button onClick={()=>setWeekStart(w=>addDays(w,-7))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18}/></button>
            <button onClick={()=>setWeekStart(startOfWeek(new Date()))} className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 text-gray-600">Today</button>
            <button onClick={()=>setWeekStart(w=>addDays(w,7))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18}/></button>
            <span className="text-sm font-medium text-gray-700 ml-1">
              {weekStart.toLocaleDateString('en-US', { month:'long', year:'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            {Object.entries(TYPE_LABELS).map(([k,l]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor:COLORS[k].border }}/>
                <span className="text-xs text-gray-500">{l}</span>
              </div>
            ))}
          </div>
          <button onClick={exportICS} className="btn-secondary text-xs py-1.5 px-3"><Download size={13}/> Export .ics</button>
        </div>
      </div>

      {loading && <div className="px-8 py-2 text-xs text-gray-400 shrink-0">Loading sessions…</div>}

      {/* Calendar grid */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
        {/* Sticky day header */}
        <div style={{ position:'sticky', top:0, zIndex:30, backgroundColor:'white', borderBottom:'1px solid #f3f4f6',
          display:'grid', gridTemplateColumns:`56px repeat(7, 1fr)` }}>
          <div style={{ borderRight:'1px solid #f3f4f6', padding:'8px', fontSize:'11px', color:'#9ca3af' }}>WIB</div>
          {weekDays.map(day => {
            const isToday = sameDay(day, today)
            return (
              <div key={day.toISOString()} style={{ borderRight:'1px solid #f3f4f6', padding:'8px', textAlign:'center' }}>
                <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>{DAY_SHORT[day.getDay()]}</p>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', margin:'0 auto',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'14px', fontWeight:'600',
                  backgroundColor: isToday ? 'var(--mlc-teal)' : 'transparent',
                  color: isToday ? 'white' : '#374151' }}>
                  {day.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div style={{ display:'grid', gridTemplateColumns:`56px repeat(7, 1fr)`, height:`${gridH}px`, position:'relative' }}>
          {/* Hour labels */}
          <div style={{ borderRight:'1px solid #f3f4f6', position:'relative' }}>
            {HOURS.map((h,i) => (
              <div key={h} style={{ position:'absolute', top:`${i*PX_PER_HR}px`, left:0, right:0, paddingLeft:'6px', paddingTop:'2px' }}>
                <span style={{ fontSize:'11px', color:'#9ca3af' }}>{h===12?'12 PM':h<12?`${h} AM`:`${h-12} PM`}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(day => {
            const daySessions = sessions.filter(s => sameDay(new Date(s.scheduled_at), day))
            const isToday     = sameDay(day, today)
            const nowPx       = isToday ? dateToPx(today) : null
            const laid        = layoutSessions(daySessions)

            return (
              <div key={day.toISOString()} style={{
                borderRight:'1px solid #f3f4f6', position:'relative', height:`${gridH}px`,
                backgroundColor: isToday ? 'rgba(15,123,108,0.03)' : 'transparent',
              }}>
                {/* Hour lines */}
                {HOURS.map((_,i) => (
                  <div key={i} style={{ position:'absolute', top:`${i*PX_PER_HR}px`, left:0, right:0,
                    borderBottom:'1px solid #f9fafb', height:`${PX_PER_HR}px` }}/>
                ))}
                {/* Current time */}
                {nowPx!==null && nowPx>=0 && nowPx<=gridH && (
                  <div style={{ position:'absolute', top:`${nowPx}px`, left:0, right:0,
                    display:'flex', alignItems:'center', zIndex:10 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor:'#ef4444', marginLeft:-5, flexShrink:0 }}/>
                    <div style={{ flex:1, height:1, backgroundColor:'#ef4444' }}/>
                  </div>
                )}
                {/* Session blocks — with overlap columns */}
                {laid.map(({ session, col, totalCols }) => (
                  <SessionBlock key={session.id} session={session} col={col} totalCols={totalCols} onClick={()=>setSelected(session)}/>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {selected && <DetailPanel session={selected} onClose={()=>setSelected(null)} onRefresh={load}/>}
    </div>
  )
}
