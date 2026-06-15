import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMMM yyyy')
}

export function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm')
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('')
}

export function calcLineTotal(qty: number, unitPrice: number, discPct: number): number {
  return qty * unitPrice * (1 - discPct / 100)
}

export const sessionStatusConfig: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Scheduled',   color: 'bg-blue-50 text-blue-700' },
  completed:   { label: 'Completed',   color: 'bg-teal-50 text-teal-700' },
  cancelled:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-500' },
  rescheduled: { label: 'Rescheduled', color: 'bg-amber-50 text-amber-700' },
}

export const studentStatusConfig: Record<string, { label: string; color: string }> = {
  ongoing: { label: 'Ongoing', color: 'bg-teal-50 text-teal-700' },
  expired: { label: 'Expired', color: 'bg-red-50 text-red-700' },
}
