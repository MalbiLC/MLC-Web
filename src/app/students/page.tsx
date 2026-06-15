'use client'

import { useEffect, useState, useCallback } from 'react'
import { getStudents } from '@/lib/studentQueries'
import { cn } from '@/lib/utils'
import { Plus, Search, Users, UserCheck, UserX, AlertTriangle, TrendingUp } from 'lucide-react'
import type { Student } from '@/types/students'
import PotentialList from '@/components/students/PotentialList'
import RecurringList from '@/components/students/RecurringList'
import PotentialModal from '@/components/students/PotentialModal'
import RecurringModal from '@/components/students/RecurringModal'

type Tab = 'current' | 'potential'

export default function StudentsPage() {
  const [tab, setTab] = useState<Tab>('current')
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState<'potential' | 'recurring' | null>(null)
  const [allStudents, setAllStudents] = useState<{ current: Student[]; potential: Student[] }>({
    current: [], potential: [],
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [current, potential] = await Promise.all([getStudents('current'), getStudents('potential')])
    setAllStudents({ current, potential })
    setStudents(tab === 'current' ? current : potential)
    setLoading(false)
  }, [tab])

  const loadTab = useCallback(() => {
    setLoading(true)
    getStudents(tab).then(data => {
      setStudents(data)
      setAllStudents(prev => ({ ...prev, [tab]: data }))
    }).finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadTab() }, [tab])

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.parent_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.parent_contact || '').includes(search)
  )

  const onSuccess = () => { setShowModal(null); loadTab() }

  // Stats from all students
  const cur = allStudents.current
  const pot = allStudents.potential
  const ongoing   = cur.filter(s => s.status === 'ongoing').length
  const low       = cur.filter(s => s.status === 'low_session').length
  const expired   = cur.filter(s => s.status === 'expired').length
  const noTrial   = pot.filter(s => s.status === 'potential_no_trial').length
  const trialDone = pot.filter(s => s.status === 'potential_trial_done').length
  const totalPot  = pot.length
  const convRate  = totalPot > 0 ? Math.round((cur.filter(s => s.enrolled_at).length / totalPot) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowModal('potential')} className="btn-secondary">
            <Plus size={15} /> Potential
          </button>
          <button onClick={() => setShowModal('recurring')} className="btn-primary">
            <Plus size={15} /> Recurring
          </button>
        </div>
      </div>

      <div className="page-content space-y-5">
        {/* Dashboard stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <UserCheck size={13} /> Active students
            </div>
            <p className="text-2xl font-semibold text-gray-900">{ongoing}</p>
            <p className="text-xs text-gray-400 mt-0.5">Recurring · ongoing</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <AlertTriangle size={13} /> Needs attention
            </div>
            <p className="text-2xl font-semibold text-gray-900">{low + expired}</p>
            <p className="text-xs text-gray-400 mt-0.5">{low} low · {expired} expired</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Users size={13} /> Potential
            </div>
            <p className="text-2xl font-semibold text-gray-900">{totalPot}</p>
            <p className="text-xs text-gray-400 mt-0.5">{noTrial} pending · {trialDone} trialled</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <TrendingUp size={13} /> Conversion rate
            </div>
            <p className="text-2xl font-semibold text-gray-900">{convRate}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Potential → recurring</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-100">
          {([
            { key: 'current', label: 'Recurring', icon: UserCheck, count: cur.length },
            { key: 'potential', label: 'Potential', icon: Users, count: pot.length },
          ] as const).map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => { setTab(key); setSearch('') }}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              <Icon size={14} /> {label}
              <span className={cn('px-1.5 py-0.5 rounded-full text-xs',
                tab === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              )}>{count}</span>
            </button>
          ))}
        </div>

        {/* Alert banners */}
        {tab === 'current' && (expired > 0 || low > 0) && (
          <div className="flex gap-2 flex-wrap">
            {expired > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                <UserX size={12} /> {expired} student{expired !== 1 ? 's' : ''} expired
              </div>
            )}
            {low > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                <AlertTriangle size={12} /> {low} student{low !== 1 ? 's' : ''} low on sessions
              </div>
            )}
          </div>
        )}
        {tab === 'potential' && totalPot > 0 && (
          <div className="flex gap-2 flex-wrap">
            {noTrial > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                <Users size={12} /> {noTrial} haven&apos;t done trial yet
              </div>
            )}
            {trialDone > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700">
                <UserCheck size={12} /> {trialDone} trial done — ready to enroll
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" className="input pl-9 text-sm" placeholder="Search by name, parent, contact…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Lists */}
        {loading ? (
          <div className="text-sm text-gray-400 py-8">Loading…</div>
        ) : tab === 'potential' ? (
          <PotentialList students={filtered} onRefresh={loadTab} />
        ) : (
          <RecurringList students={filtered} onRefresh={loadTab} />
        )}
      </div>

      {showModal === 'potential' && <PotentialModal onClose={() => setShowModal(null)} onSuccess={onSuccess} />}
      {showModal === 'recurring' && <RecurringModal onClose={() => setShowModal(null)} onSuccess={onSuccess} />}
    </div>
  )
}
