import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
export function formatDate(s: string) { return format(parseISO(s), 'd MMMM yyyy') }
export function formatTime(s: string) { return format(parseISO(s), 'HH:mm') }
export function formatDuration(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60); const r = m % 60
  return r > 0 ? `${h}h ${r}m` : `${h}h`
}
export function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('')
}

export const sessionStatusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-teal-50 text-teal-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
  rescheduled: { label: 'Rescheduled', color: 'bg-amber-50 text-amber-700' },
}
export const studentStatusConfig: Record<string, { label: string; color: string }> = {
  ongoing: { label: 'Ongoing', color: 'bg-teal-50 text-teal-700' },
  expired: { label: 'Expired', color: 'bg-red-50 text-red-700' },
}
