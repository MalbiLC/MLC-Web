'use client'

import { useEffect, useState, useCallback } from 'react'
import { getStudents } from '@/lib/studentQueries'
import { cn } from '@/lib/utils'
import { Plus, Search, Users, UserCheck } from 'lucide-react'
import type { Student } from '@/types/students'
import PotentialTable from '@/components/students/PotentialTable'
import RecurringTable from '@/components/students/RecurringTable'
import AddPotentialModal from '@/components/students/AddPotentialModal'
import AddRecurringModal from '@/components/students/AddRecurringModal'

type Tab = 'potential' | 'current'

export default function StudentsPage() {
  const [tab, setTab] = useState<Tab>('current')
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState<'potential' | 'recurring' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getStudents(tab).then(setStudents).finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { load() }, [load])

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.parent_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.parent_contact || '').includes(search)
  )

  const onSuccess = () => { setShowModal(null); load() }

  const expired   = students.filter(s => s.status === 'expired').length
  const low       = students.filter(s => s.status === 'low_session').length
  const noTrial   = students.filter(s => s.status === 'potential_no_trial').length
  const trialDone = students.filter(s => s.status === 'potential_trial_done').length

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowModal('potential')} className="btn-secondary">
            <Plus size={16} /> Potential student
          </button>
          <button onClick={() => setShowModal('recurring')} className="btn-primary">
            <Plus size={16} /> Recurring student
          </button>
        </div>
      </div>

      <div className="page-content space-y-5">
        <div className="flex gap-0 border-b border-gray-100">
          <button onClick={() => { setTab('current'); setSearch('') }} className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'current' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}>
            <UserCheck size={15} /> Recurring students
            {tab === 'current' && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-gray-900 text-white">{students.length}</span>}
          </button>
          <button onClick={() => { setTab('potential'); setSearch('') }} className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'potential' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}>
            <Users size={15} /> Potential students
            {tab === 'potential' && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-gray-900 text-white">{students.length}</span>}
          </button>
        </div>

        {tab === 'current' && (expired > 0 || low > 0) && (
          <div className="flex gap-3 flex-wrap">
            {expired > 0 && <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700"><span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />{expired} student{expired !== 1 ? 's' : ''} expired</div>}
            {low > 0 && <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />{low} student{low !== 1 ? 's' : ''} low on sessions</div>}
          </div>
        )}
        {tab === 'potential' && (noTrial > 0 || trialDone > 0) && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 w-fit">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            {noTrial} haven&apos;t done trial · {trialDone} trial done
          </div>
        )}

        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Search by name, parent, contact…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-8">Loading…</div>
        ) : tab === 'potential' ? (
          <PotentialTable students={filtered} onRefresh={load} />
        ) : (
          <RecurringTable students={filtered} />
        )}
      </div>

      {showModal === 'potential' && <AddPotentialModal onClose={() => setShowModal(null)} onSuccess={onSuccess} />}
      {showModal === 'recurring' && <AddRecurringModal onClose={() => setShowModal(null)} onSuccess={onSuccess} />}
    </div>
  )
}
