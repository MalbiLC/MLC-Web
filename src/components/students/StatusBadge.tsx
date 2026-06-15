import { cn } from '@/lib/utils'
import type { StudentStatus } from '@/types/students'

const config: Record<StudentStatus, { label: string; dot: string; text: string; bg: string }> = {
  potential_no_trial: { label: 'No trial yet', dot: 'bg-red-400',    text: 'text-red-700',   bg: 'bg-red-50'   },
  potential_trial_done: { label: 'Trial done',  dot: 'bg-green-400', text: 'text-green-700', bg: 'bg-green-50' },
  ongoing:             { label: 'Ongoing',      dot: 'bg-green-400', text: 'text-green-700', bg: 'bg-green-50' },
  low_session:         { label: 'Low session',  dot: 'bg-green-400', text: 'text-green-700', bg: 'bg-green-50' },
  expired:             { label: 'Expired',      dot: 'bg-red-400',   text: 'text-red-700',   bg: 'bg-red-50'   },
}

export default function StatusBadge({ status }: { status: StudentStatus }) {
  const c = config[status] || config['potential_no_trial']
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', c.bg, c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}
