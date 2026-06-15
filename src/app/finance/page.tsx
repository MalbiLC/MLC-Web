'use client'
import { useAuth } from '@/hooks/useAuth'
export default function FinancePage() {
  const { loading } = useAuth('owner')
  if (loading) return null
  return (<div><div className="page-header"><h1 className="text-2xl font-semibold">Finance</h1></div><div className="page-content"><div className="card text-center py-16 text-gray-400 text-sm">Finance module — coming soon.</div></div></div>)
}
