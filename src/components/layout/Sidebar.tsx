'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MLC_LOGO } from '@/lib/logo'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, GraduationCap, Calendar,
  Clock, FileText, Wallet, BarChart3, Settings, LogOut
} from 'lucide-react'

const nav = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/calendar',   label: 'Calendar',   icon: Calendar },
  { href: '/students',   label: 'Students',   icon: Users },
  { href: '/teachers',   label: 'Teachers',   icon: GraduationCap },
  { href: '/scheduling', label: 'Scheduling', icon: Clock },
  { href: '/invoices',   label: 'Invoices',   icon: FileText },
  { href: '/payslips',   label: 'Payslips',   icon: Wallet },
  { href: '/finance',    label: 'Finance',    icon: BarChart3 },
  { href: '/settings',   label: 'Settings',   icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const logout = async () => { await createClient().auth.signOut(); router.push('/login') }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-100 bg-white">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <img src={MLC_LOGO} alt="MLC Logo" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-[13px] font-bold tracking-tight leading-none" style={{ color: 'var(--mlc-teal)' }}>MALBI</p>
            <p className="text-[10px] font-medium tracking-widest text-gray-400 leading-none mt-0.5">LEARNING CENTER</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] mb-0.5 transition-colors',
              active
                ? 'text-white font-medium'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            )}
            style={active ? { backgroundColor: 'var(--mlc-teal)' } : {}}>
              <Icon size={16} strokeWidth={1.75} />{label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-100">
        <button onClick={logout} className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[13.5px] text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
          <LogOut size={16} strokeWidth={1.75} /> Sign out
        </button>
      </div>
    </aside>
  )
}
