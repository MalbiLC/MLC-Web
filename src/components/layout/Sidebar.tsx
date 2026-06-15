'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, GraduationCap, Calendar, Clock, FileText, Wallet, BarChart3, Settings, LogOut } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/teachers', label: 'Teachers', icon: GraduationCap },
  { href: '/scheduling', label: 'Scheduling', icon: Clock },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/payslips', label: 'Payslips', icon: Wallet },
  { href: '/finance', label: 'Finance', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const logout = async () => { await createClient().auth.signOut(); router.push('/login') }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-100 bg-white">
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-[15px] font-semibold tracking-tight text-gray-900">MLC</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] mb-0.5 transition-colors',
            pathname.startsWith(href) ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
          )}><Icon size={16} strokeWidth={1.75} />{label}</Link>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-gray-100">
        <button onClick={logout} className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[13.5px] text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
          <LogOut size={16} strokeWidth={1.75} />Sign out
        </button>
      </div>
    </aside>
  )
}
