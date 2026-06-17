'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import { cn, formatIDR } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SubjectPackageRow {
  subject_id:  string
  subject_name: string
  package_id:  string
  package_name: string    // display label
  sessions:    number
  location:    string
  price:       number
}

const SUBJECTS = ['Math', 'Science', 'English', 'Mandarin']

interface Props {
  studentLevel?: string   // optional: pre-filter packages by student's grade
  rows: SubjectPackageRow[]
  onChange: (rows: SubjectPackageRow[]) => void
  label?: string
}

export default function SubjectPackagePicker({ rows, onChange, label = 'Subjects & packages' }: Props) {
  const sb = createClient()
  const [allSubjects, setAllSubjects]   = useState<{ id: string; name: string }[]>([])
  const [allPackages, setAllPackages]   = useState<any[]>([])
  const [openIdx,     setOpenIdx]       = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      sb.from('subjects').select('id, name').in('name', SUBJECTS).order('name'),
      sb.from('packages').select('*').order('subject').order('level').order('sessions'),
    ]).then(([{ data: s }, { data: p }]) => {
      setAllSubjects(s || [])
      setAllPackages(p || [])
    })
  }, [])

  const add = () => onChange([...rows, { subject_id: '', subject_name: '', package_id: '', package_name: '', sessions: 0, location: 'in_person', price: 0 }])
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const pickSubject = (i: number, subjectId: string) => {
    const subj = allSubjects.find(s => s.id === subjectId)
    onChange(rows.map((r, idx) => idx === i
      ? { ...r, subject_id: subjectId, subject_name: subj?.name || '', package_id: '', package_name: '', sessions: 0, price: 0 }
      : r
    ))
  }

  const pickPackage = (i: number, pkg: any) => {
    onChange(rows.map((r, idx) => idx === i
      ? {
          ...r,
          package_id:   pkg.id,
          package_name: [pkg.package_name, `${pkg.sessions} sessions`, pkg.level].filter(Boolean).join(' · '),
          sessions:     pkg.sessions,
          location:     pkg.location,
          price:        pkg.final_price ?? pkg.price,
        }
      : r
    ))
    setOpenIdx(null)
  }

  const getPackagesForSubject = (subjectName: string) =>
    allPackages.filter(p => p.subject === subjectName)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button type="button" onClick={add}
          className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
          <Plus size={12}/> Add subject
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const subjectPackages = row.subject_name ? getPackagesForSubject(row.subject_name) : []
          const isOpen = openIdx === i

          return (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                {/* Subject selector */}
                <select
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  value={row.subject_id}
                  onChange={e => pickSubject(i, e.target.value)}>
                  <option value="">Select subject</option>
                  {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {rows.length > 1 && (
                  <button type="button" onClick={() => remove(i)}
                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>

              {/* Package picker — only shows when subject selected */}
              {row.subject_id && (
                subjectPackages.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    No packages for {row.subject_name} yet. Add one in the Packages tab.
                  </p>
                ) : (
                  <div className="relative">
                    {/* Selected package display / trigger */}
                    <button type="button"
                      onClick={() => setOpenIdx(isOpen ? null : i)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left',
                        row.package_id
                          ? 'bg-white border-gray-300 text-gray-900'
                          : 'bg-white border-dashed border-gray-300 text-gray-400'
                      )}>
                      <span className="truncate">
                        {row.package_id ? row.package_name : 'Select a package…'}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {row.package_id && (
                          <span className="text-xs font-semibold text-gray-900">{formatIDR(row.price)}</span>
                        )}
                        <ChevronDown size={14} className={cn('text-gray-400 transition-transform', isOpen && 'rotate-180')}/>
                      </div>
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {subjectPackages.map(pkg => (
                          <button key={pkg.id} type="button"
                            onClick={() => pickPackage(i, pkg)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0',
                              row.package_id === pkg.id && 'bg-teal-50'
                            )}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {pkg.package_name && (
                                  <span className="text-sm font-medium text-gray-900">{pkg.package_name}</span>
                                )}
                                <span className="text-xs text-gray-400">{pkg.level}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {pkg.class_type?.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-gray-400">{pkg.location === 'online' ? '🖥' : '📍'}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{pkg.sessions} sessions</p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              {pkg.discount_pct > 0 && (
                                <p className="text-xs text-gray-400 line-through">{formatIDR(pkg.price)}</p>
                              )}
                              <p className="text-sm font-bold text-gray-900">{formatIDR(pkg.final_price ?? pkg.price)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Selected package summary */}
              {row.package_id && (
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="px-2 py-0.5 rounded bg-gray-100">{row.sessions} sessions</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100">{row.location === 'online' ? 'Online' : 'In person'}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
