'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import { Bell, UserCheck, AlertTriangle, Clock, CalendarClock, FileText, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Reminder {
  id: string
  type: 'trial_followup' | 'low_sessions' | 'expired' | 'invoice_due' | 'payslip_due'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  link?: string
  date?: string
}

const PRIORITY_STYLE = {
  high:   'border-red-200 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low:    'border-gray-200 bg-gray-50',
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  trial_followup: <CalendarClock size={16} className="text-blue-600"/>,
  low_sessions:   <AlertTriangle size={16} className="text-amber-600"/>,
  expired:        <UserCheck size={16} className="text-red-600"/>,
  invoice_due:    <FileText size={16} className="text-purple-600"/>,
  payslip_due:    <Wallet size={16} className="text-teal-600"/>,
}

const TYPE_BADGE: Record<string, string> = {
  trial_followup: 'bg-blue-50 text-blue-700',
  low_sessions:   'bg-amber-50 text-amber-700',
  expired:        'bg-red-50 text-red-700',
  invoice_due:    'bg-purple-50 text-purple-700',
  payslip_due:    'bg-teal-50 text-teal-700',
}

const TYPE_LABEL: Record<string, string> = {
  trial_followup: 'Trial follow-up',
  low_sessions:   'Low sessions',
  expired:        'Expired',
  invoice_due:    'Invoice',
  payslip_due:    'Payslip',
}

export default function RemindersPage() {
  useAuth()
  const sb = createClient()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<string>('all')

  useEffect(() => {
    const build = async () => {
      setLoading(true)
      const list: Reminder[] = []

      // ── 1. Trial follow-ups ─────────────────────────────
      const { data: trialStudents } = await sb
        .from('students')
        .select('id, full_name, followup_date, parent_name, parent_contact')
        .eq('student_type', 'potential')
        .eq('status', 'potential_trial_done')
        .not('followup_date', 'is', null)
        .order('followup_date')

      const today = new Date(); today.setHours(0,0,0,0)

      for (const s of trialStudents || []) {
        const fDate = new Date(s.followup_date)
        const isPast = fDate <= today
        list.push({
          id:          `trial-${s.id}`,
          type:        'trial_followup',
          priority:    isPast ? 'high' : 'medium',
          title:       `Follow up with ${s.full_name}`,
          description: `Trial done · Follow-up ${isPast ? 'was due' : 'due'} ${formatDate(s.followup_date)}${s.parent_contact ? ` · ${s.parent_contact}` : ''}`,
          date:        s.followup_date,
          link:        '/students',
        })
      }

      // ── 2. Low sessions ─────────────────────────────────
      const { data: lowSessions } = await sb
        .from('student_subject_sessions')
        .select('sessions_remaining, student:students(id, full_name), subject:subjects(name)')
        .lte('sessions_remaining', 2)
        .gt('sessions_remaining', 0)
        .eq('students.student_type', 'current')

      for (const ss of lowSessions || []) {
        const student = Array.isArray(ss.student) ? ss.student[0] : ss.student
        const subject = Array.isArray(ss.subject) ? ss.subject[0] : ss.subject
        if (!student) continue
        list.push({
          id:          `low-${student.id}-${subject?.name}`,
          type:        'low_sessions',
          priority:    ss.sessions_remaining === 1 ? 'high' : 'medium',
          title:       `${student.full_name} — ${subject?.name} sessions low`,
          description: `Only ${ss.sessions_remaining} session${ss.sessions_remaining !== 1 ? 's' : ''} remaining. Time to renew.`,
          link:        '/students',
        })
      }

      // ── 3. Expired students ──────────────────────────────
      const { data: expired } = await sb
        .from('students')
        .select('id, full_name, parent_contact')
        .eq('student_type', 'current')
        .eq('status', 'expired')

      for (const s of expired || []) {
        list.push({
          id:          `expired-${s.id}`,
          type:        'expired',
          priority:    'high',
          title:       `${s.full_name} — sessions expired`,
          description: `All sessions used up. Contact parent to renew package.${s.parent_contact ? ` · ${s.parent_contact}` : ''}`,
          link:        '/students',
        })
      }

      // ── 4. Placeholders for future features ─────────────
      list.push({
        id:          'invoice-placeholder',
        type:        'invoice_due',
        priority:    'low',
        title:       'Invoice module coming soon',
        description: 'Invoice reminders will appear here once the invoice module is set up.',
      })
      list.push({
        id:          'payslip-placeholder',
        type:        'payslip_due',
        priority:    'low',
        title:       'Payslip module coming soon',
        description: 'Teacher payslip reminders will appear here once the payslip module is set up.',
      })

      // Sort: high → medium → low, then by date
      list.sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 }
        if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority]
        return (a.date || '').localeCompare(b.date || '')
      })

      setReminders(list)
      setLoading(false)
    }

    build()
  }, [])

  const counts = {
    all:            reminders.length,
    trial_followup: reminders.filter(r => r.type === 'trial_followup').length,
    low_sessions:   reminders.filter(r => r.type === 'low_sessions').length,
    expired:        reminders.filter(r => r.type === 'expired').length,
  }

  const highCount = reminders.filter(r => r.priority === 'high').length
  const shown = filter === 'all' ? reminders : reminders.filter(r => r.type === filter)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Reminders</h1>
          {highCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">
              {highCount} urgent
            </span>
          )}
        </div>
      </div>

      <div className="page-content space-y-5">
        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-gray-100 flex-wrap">
          {([
            { key: 'all',            label: 'All',           icon: Bell          },
            { key: 'trial_followup', label: 'Trial follow-up',icon: CalendarClock },
            { key: 'low_sessions',   label: 'Low sessions',  icon: AlertTriangle  },
            { key: 'expired',        label: 'Expired',       icon: Clock          },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                filter === key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              <Icon size={13}/>
              {label}
              <span className={cn('px-1.5 py-0.5 rounded-full text-xs',
                filter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              )}>
                {counts[key] ?? reminders.filter(r => r.type === key).length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Checking for reminders…</p>
        ) : shown.length === 0 ? (
          <div className="card text-center py-16">
            <Bell size={32} className="mx-auto text-gray-200 mb-3"/>
            <p className="text-gray-400 text-sm">No reminders in this category.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(r => (
              <div key={r.id}
                className={cn('border rounded-xl px-5 py-4 flex items-start gap-4', PRIORITY_STYLE[r.priority])}>
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                  {TYPE_ICON[r.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', TYPE_BADGE[r.type])}>
                      {TYPE_LABEL[r.type]}
                    </span>
                    {r.priority === 'high' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Urgent</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{r.description}</p>
                  {r.date && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <CalendarClock size={11}/> {formatDate(r.date)}
                    </p>
                  )}
                </div>
                {r.link && (
                  <a href={r.link}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition-colors shrink-0">
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
