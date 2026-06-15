'use client'

import { useEffect, useState, useCallback } from 'react'
import { getTeachers } from '@/lib/teacherQueries'
import { useAuth } from '@/hooks/useAuth'
import TeacherList from '@/components/teachers/TeacherList'
import TeacherModal from '@/components/teachers/TeacherModal'
import { Plus, Search, GraduationCap, Users, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Teacher } from '@/types/teachers'

export default function TeachersPage() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getTeachers().then(setTeachers).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = teachers
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t =>
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (t.phone_number || '').includes(search) ||
      (t.subjects || []).some(s => s.name.toLowerCase().includes(search.toLowerCase()))
    )

  const active    = teachers.filter(t => t.status === 'active').length
  const inactive  = teachers.filter(t => t.status === 'inactive').length
  const fullTime  = teachers.filter(t => t.employment_type === 'full_time' && t.status === 'active').length
  const partTime  = teachers.filter(t => t.employment_type === 'part_time' && t.status === 'active').length

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Teachers</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> Add teacher
        </button>
      </div>

      <div className="page-content space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <GraduationCap size={13} /> Active teachers
            </div>
            <p className="text-2xl font-semibold text-gray-900">{active}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fullTime} full-time · {partTime} part-time</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Users size={13} /> Total students taught
            </div>
            <p className="text-2xl font-semibold text-gray-900">
              {teachers.reduce((acc, t) => acc + (t.students?.length || 0), 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Across all teachers</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <UserX size={13} /> Inactive
            </div>
            <p className="text-2xl font-semibold text-gray-900">{inactive}</p>
            <p className="text-xs text-gray-400 mt-0.5">Not currently teaching</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <GraduationCap size={13} /> Total teachers
            </div>
            <p className="text-2xl font-semibold text-gray-900">{teachers.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">All time</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-gray-100">
          {([
            { key: 'all', label: 'All', count: teachers.length },
            { key: 'active', label: 'Active', count: active },
            { key: 'inactive', label: 'Inactive', count: inactive },
          ] as const).map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                filter === key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {label}
              <span className={cn('px-1.5 py-0.5 rounded-full text-xs',
                filter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              )}>{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" className="input pl-9 text-sm"
            placeholder="Search by name, subject, phone…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-sm text-gray-400 py-8">Loading…</div>
        ) : (
          <TeacherList teachers={filtered} isOwner={isOwner} onRefresh={load} />
        )}
      </div>

      {showModal && (
        <TeacherModal
          isOwner={isOwner}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
