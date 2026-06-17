'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatIDR } from '@/lib/utils'
import { Plus, X, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/hooks/useAuth'

/* eslint-disable @typescript-eslint/no-explicit-any */

const SUBJECTS    = ['Math', 'Science', 'English', 'Mandarin']
const CLASS_TYPES = [
  { value: 'group',          label: 'Group',          duration: 75 },
  { value: 'semi_private',   label: 'Semi-Private',   duration: 75 },
  { value: 'private',        label: 'Private',        duration: 60 },
  { value: 'private_online', label: 'Online Private', duration: 60 },
]

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Math:     { bg: '#E6F4F2', text: '#0F7B6C', border: '#0F7B6C' },
  Science:  { bg: '#E8F0FA', text: '#1A5FA8', border: '#1A5FA8' },
  English:  { bg: '#FEF3DC', text: '#B45309', border: '#E8A020' },
  Mandarin: { bg: '#F0F0FE', text: '#4338CA', border: '#6366F1' },
}

interface Package {
  id: string; subject: string; level: string; package_name: string | null
  class_type: string; sessions: number; price: number; discount_pct: number
  final_price: number; location: string; notes: string | null
}

// ── Package modal ────────────────────────────────────────────────
function PackageModal({ pkg, onClose, onSuccess }: {
  pkg?: Package; onClose: () => void; onSuccess: () => void
}) {
  const sb     = createClient()
  const isEdit = !!pkg

  const [form, setForm] = useState({
    subject:      pkg?.subject      || 'Math',
    level:        pkg?.level        || '',
    package_name: pkg?.package_name || '',
    class_type:   pkg?.class_type   || 'private',
    sessions:     pkg?.sessions?.toString()     || '',
    price:        pkg?.price?.toString()        || '',
    discount_pct: pkg?.discount_pct?.toString() || '0',
    location:     pkg?.location     || 'in_person',
    notes:        pkg?.notes        || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const price      = parseFloat(form.price)   || 0
  const discount   = parseFloat(form.discount_pct) || 0
  const finalPrice = Math.round(price * (1 - discount / 100))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.level.trim()) { setError('Level/grade is required.'); return }
    if (!form.price)        { setError('Price is required.'); return }
    if (!form.sessions)     { setError('Number of sessions is required.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        subject:      form.subject,
        level:        form.level.trim(),
        package_name: form.package_name || null,
        class_type:   form.class_type,
        sessions:     parseInt(form.sessions),
        price:        parseFloat(form.price),
        discount_pct: parseFloat(form.discount_pct) || 0,
        location:     form.location,
        notes:        form.notes || null,
      }
      const { error: e } = isEdit && pkg
        ? await sb.from('packages').update(payload).eq('id', pkg.id)
        : await sb.from('packages').insert(payload)
      if (e) throw new Error(e.message)
      onSuccess()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit package' : 'New package'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          {/* Subject */}
          <div>
            <label className="label">Subject <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(s => {
                const c = SUBJECT_COLORS[s]
                return (
                  <button key={s} type="button" onClick={() => set('subject', s)}
                    className={cn('px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                      form.subject === s ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    )}
                    style={form.subject === s ? { backgroundColor: c.border } : {}}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Level + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Level / Grade <span className="text-red-500">*</span></label>
              <input className="input" placeholder="e.g. SD, SMP, SMA, Grade 1"
                value={form.level} onChange={e => set('level', e.target.value)} required/>
            </div>
            <div>
              <label className="label">Package name <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
              <input className="input" placeholder="e.g. Regular, Lite"
                value={form.package_name} onChange={e => set('package_name', e.target.value)}/>
            </div>
          </div>

          {/* Class type */}
          <div>
            <label className="label">Class type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {CLASS_TYPES.map(ct => (
                <button key={ct.value} type="button"
                  onClick={() => { set('class_type', ct.value); set('location', ct.value === 'private_online' ? 'online' : 'in_person') }}
                  className={cn('flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors',
                    form.class_type === ct.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}
                  style={form.class_type === ct.value ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                  <span className="text-sm font-medium">{ct.label}</span>
                  <span className={cn('text-xs', form.class_type === ct.value ? 'text-white/70' : 'text-gray-400')}>{ct.duration}m</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="label">Location</label>
            <div className="flex gap-2">
              {[{ v:'in_person', l:'In person' }, { v:'online', l:'Online (Zoom)' }].map(({ v, l }) => (
                <button key={v} type="button" onClick={() => set('location', v)}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    form.location === v ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}
                  style={form.location === v ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Sessions + Price + Discount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Sessions <span className="text-red-500">*</span></label>
              <input className="input" type="number" min="1" placeholder="e.g. 12"
                value={form.sessions} onChange={e => set('sessions', e.target.value)} required/>
            </div>
            <div>
              <label className="label">Price (Rp) <span className="text-red-500">*</span></label>
              <input className="input" type="number" min="0" placeholder="e.g. 1200000"
                value={form.price} onChange={e => set('price', e.target.value)} required/>
            </div>
            <div>
              <label className="label">Discount %</label>
              <input className="input" type="number" min="0" max="100" placeholder="0"
                value={form.discount_pct} onChange={e => set('discount_pct', e.target.value)}/>
            </div>
          </div>

          {/* Price preview */}
          {price > 0 && (
            <div className="px-4 py-3 bg-gray-50 rounded-xl flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {discount > 0
                  ? <><span className="line-through text-gray-400 mr-2">{formatIDR(price)}</span><span className="text-green-600 font-medium">−{discount}%</span></>
                  : 'Final price'}
              </div>
              <p className="text-lg font-bold text-gray-900">{formatIDR(finalPrice)}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2} placeholder="Any additional details…"
              value={form.notes} onChange={e => set('notes', e.target.value)}/>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function PackagesPage() {
  useAuth()
  const sb = createClient()
  const [packages, setPackages]   = useState<Package[]>([])
  const [loading,  setLoading]    = useState(true)
  const [modal,    setModal]      = useState<'add' | Package | null>(null)
  const [deleting, setDeleting]   = useState<Package | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await sb
      .from('packages')
      .select('*')
      .order('subject')
      .order('level')
      .order('sessions')
    if (error) console.error('[packages]', error)
    setPackages(data || [])
    // Auto-expand all level groups on first load
    if (data && data.length > 0) {
      const keys = new Set<string>()
      data.forEach(p => keys.add(`${p.subject}|${p.level}`))
      setExpandedLevels(keys)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    await sb.from('packages').delete().eq('id', deleting.id)
    setDeleteLoading(false); setDeleting(null); load()
  }

  const toggleLevel = (key: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Group: subject → level → packages[]
  // Level sort: try numeric prefix (Grade 1, Grade 2…), else alphabetical
  const grouped = useMemo(() => {
    const bySubject: Record<string, Record<string, Package[]>> = {}
    for (const p of packages) {
      if (!bySubject[p.subject])        bySubject[p.subject] = {}
      if (!bySubject[p.subject][p.level]) bySubject[p.subject][p.level] = []
      bySubject[p.subject][p.level].push(p)
    }
    return bySubject
  }, [packages])

  const sortLevels = (levels: string[]) =>
    [...levels].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0
      const numB = parseInt(b.replace(/\D/g, '')) || 0
      if (numA && numB) return numA - numB
      return a.localeCompare(b)
    })

  const ctLabel: Record<string, string> = {
    group: 'Group', semi_private: 'Semi-Private',
    private: 'Private', private_online: 'Online',
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-2xl font-semibold">Packages</h1>
        <button onClick={() => setModal('add')} className="btn-primary">
          <Plus size={15}/> New package
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <p className="text-sm text-gray-400 py-8">Loading…</p>
        ) : packages.length === 0 ? (
          <div className="card text-center py-20 text-gray-400 text-sm">
            No packages yet. Click &ldquo;New package&rdquo; to create one.
          </div>
        ) : (
          <div className="space-y-8">
            {SUBJECTS.filter(s => grouped[s]).map(subject => {
              const c      = SUBJECT_COLORS[subject]
              const levels = sortLevels(Object.keys(grouped[subject]))
              const total  = Object.values(grouped[subject]).flat().length

              return (
                <div key={subject}>
                  {/* Subject divider */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.border }}/>
                    <h2 className="text-lg font-bold text-gray-900">{subject}</h2>
                    <span className="text-xs text-gray-400">{total} package{total !== 1 ? 's' : ''}</span>
                    <div className="flex-1 h-px bg-gray-100"/>
                  </div>

                  {/* Level groups */}
                  <div className="space-y-3">
                    {levels.map(level => {
                      const key  = `${subject}|${level}`
                      const pkgs = grouped[subject][level]
                      const open = expandedLevels.has(key)

                      return (
                        <div key={level} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                          {/* Level header */}
                          <button type="button" onClick={() => toggleLevel(key)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50/50 transition-colors">
                            <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: c.border, opacity: 0.4 }}/>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{level}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {pkgs.length} package{pkgs.length !== 1 ? 's' : ''}
                                {' · '}
                                {[...new Set(pkgs.map(p => ctLabel[p.class_type] || p.class_type))].join(' · ')}
                              </p>
                            </div>
                            {/* Price range */}
                            <div className="hidden sm:block text-right shrink-0 text-xs text-gray-400">
                              {pkgs.length === 1
                                ? formatIDR(pkgs[0].final_price)
                                : `${formatIDR(Math.min(...pkgs.map(p => p.final_price)))} – ${formatIDR(Math.max(...pkgs.map(p => p.final_price)))}`
                              }
                            </div>
                            {open
                              ? <ChevronUp size={15} className="text-gray-400 shrink-0"/>
                              : <ChevronDown size={15} className="text-gray-400 shrink-0"/>
                            }
                          </button>

                          {/* Package cards */}
                          {open && (
                            <div className="border-t border-gray-50 px-5 py-4 bg-gray-50/30">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {pkgs.map(p => (
                                  <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: c.bg, color: c.text }}>
                                            {ctLabel[p.class_type] || p.class_type}
                                          </span>
                                          <span className="text-xs text-gray-400">
                                            {p.location === 'online' ? '🖥 Online' : '📍 In person'}
                                          </span>
                                        </div>
                                        {p.package_name && (
                                          <p className="text-sm font-semibold text-gray-800 mt-1.5">{p.package_name}</p>
                                        )}
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        <button onClick={() => setModal(p)}
                                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                                          <Pencil size={12}/>
                                        </button>
                                        <button onClick={() => setDeleting(p)}
                                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                          <Trash2 size={12}/>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">{p.sessions} sessions</span>
                                      </div>
                                      <div className="flex items-end justify-between">
                                        <div>
                                          {p.discount_pct > 0 && (
                                            <p className="text-xs text-gray-400 line-through">{formatIDR(p.price)}</p>
                                          )}
                                          <p className="text-base font-bold text-gray-900">{formatIDR(p.final_price)}</p>
                                        </div>
                                        {p.discount_pct > 0 && (
                                          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                            −{p.discount_pct}%
                                          </span>
                                        )}
                                      </div>
                                      {p.notes && (
                                        <p className="text-xs text-gray-400 italic border-t border-gray-50 pt-1.5">{p.notes}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal === 'add' && (
        <PackageModal onClose={() => setModal(null)} onSuccess={() => { setModal(null); load() }}/>
      )}
      {modal && modal !== 'add' && (
        <PackageModal pkg={modal as Package} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load() }}/>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete package"
          message={`Delete ${deleting.subject} · ${deleting.level}${deleting.package_name ? ` · ${deleting.package_name}` : ''}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}
