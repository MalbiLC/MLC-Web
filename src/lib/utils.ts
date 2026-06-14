import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// ── Tailwind class merger ─────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency (IDR) ───────────────────────────────────────────
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ── Date formatting ──────────────────────────────────────────
export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMMM yyyy', { locale: localeId })
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMM yyyy, HH:mm', { locale: localeId })
}

export function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm')
}

export function formatMonthYear(month: number, year: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: localeId })
}

export function getRelativeDay(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEE, d MMM', { locale: localeId })
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return days[dayOfWeek] ?? ''
}

// ── Session helpers ──────────────────────────────────────────
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Status badges ────────────────────────────────────────────
export const statusConfig = {
  session: {
    scheduled:   { label: 'Scheduled',   color: 'bg-blue-50 text-blue-800' },
    completed:   { label: 'Completed',   color: 'bg-teal-50 text-teal-800' },
    cancelled:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600' },
    rescheduled: { label: 'Rescheduled', color: 'bg-amber-50 text-amber-800' },
  },
  student: {
    ongoing: { label: 'Ongoing', color: 'bg-teal-50 text-teal-800' },
    expired: { label: 'Expired', color: 'bg-red-50 text-red-800'  },
  },
  invoice: {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600'  },
    sent:  { label: 'Sent',  color: 'bg-blue-50 text-blue-800'   },
    paid:  { label: 'Paid',  color: 'bg-teal-50 text-teal-800'   },
  },
  payslip: {
    draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600'    },
    finalised: { label: 'Finalised', color: 'bg-blue-50 text-blue-800'    },
    paid:      { label: 'Paid',      color: 'bg-teal-50 text-teal-800'    },
  },
} as const

// ── Initials avatar ──────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ── Invoice line total ───────────────────────────────────────
export function calcLineTotal(qty: number, unitPrice: number, discPct: number): number {
  return qty * unitPrice * (1 - discPct / 100)
}
