'use client'

import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/layout/Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-sm text-gray-400">Loading…</p></div>
  return <div className="page-container"><Sidebar /><main className="page-main">{children}</main></div>
}
