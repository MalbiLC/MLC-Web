'use client'

import { useEffect, useState } from 'react'
import { getStudents } from '@/lib/queries'
import { formatDate, studentStatusConfig, cn, getInitials } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'
import type { Student } from '@/types'

const colors = ['bg-blue-50 text-blue-800','bg-teal-50 text-teal-800','bg-purple-50 text-purple-800','bg-amber-50 text-amber-800','bg-pink-50 text-pink-800']

export default function StudentsPage() {
  const [tab, setTab] = useState<'current'|'potential'>('current')
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setLoading(true); getStudents(tab).then(setStudents).finally(() => setLoading(false)) }, [tab])

  const filtered = students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || (s.parent_name||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header"><h1 className="text-2xl font-semibold">Students</h1><button className="btn-primary"><Plus size={16} />Add student</button></div>
      <div className="page-content space-y-4">
        <div className="flex gap-1 border-b border-gray-100">
          {(['current','potential'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch('') }} className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize', tab===t?'border-gray-900 text-gray-900':'border-transparent text-gray-500 hover:text-gray-700')}>{t} students</button>
          ))}
        </div>
        <div className="relative max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" className="input pl-9" placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        {loading ? <p className="text-sm text-gray-400 py-8">Loading…</p> : (
          <div className="table-container"><table><thead><tr>
            <th>Student</th><th>Grade / Level</th><th>Subjects</th><th>Parent</th><th>Contact</th>
            {tab==='current'&&<th>Sessions</th>}{tab==='current'&&<th>Status</th>}{tab==='potential'&&<th>Reached out</th>}
          </tr></thead><tbody>
            {filtered.length===0 ? <tr><td colSpan={7} className="text-center text-gray-400 py-10">{search?'No results.':'No students yet.'}</td></tr> : filtered.map((s,i) => {
              const badge = studentStatusConfig[s.status]; const isLow = s.sessions_remaining<=3 && s.sessions_remaining>0
              return (<tr key={s.id}>
                <td><div className="flex items-center gap-2.5"><div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0',colors[i%colors.length])}>{getInitials(s.full_name)}</div><div><p className="font-medium text-gray-900">{s.full_name}</p><p className="text-xs text-gray-400">{s.school||'—'}</p></div></div></td>
                <td>{[s.grade,s.level].filter(Boolean).join(' · ')||'—'}</td>
                <td><div className="flex flex-wrap gap-1">{s.subjects?.length ? s.subjects.map(sub => <span key={sub.id} className="badge bg-gray-100 text-gray-600">{sub.name}</span>) : <span className="text-gray-400">—</span>}</div></td>
                <td>{s.parent_name||'—'}</td><td>{s.parent_contact||'—'}</td>
                {tab==='current'&&<td><span className={cn('font-medium',s.sessions_remaining===0?'text-red-600':isLow?'text-amber-600':'text-gray-700')}>{s.sessions_remaining}</span>{isLow&&<span className="ml-1 text-xs text-amber-500">Low</span>}</td>}
                {tab==='current'&&badge&&<td><span className={cn('badge',badge.color)}>{badge.label}</span></td>}
                {tab==='potential'&&<td>{s.reached_out_at?formatDate(s.reached_out_at):'—'}</td>}
              </tr>)
            })}
          </tbody></table></div>
        )}
      </div>
    </div>
  )
}
