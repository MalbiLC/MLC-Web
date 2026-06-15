'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function FinancePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await sb
        .from('profiles').select('role').eq('id', user.id).single()

      if (profile?.role !== 'owner') {
        router.push('/dashboard')
      } else {
        setAllowed(true)
      }
    }
    check()
  }, [router])

  if (allowed === null) return (
    <div className="page-content">
      <div className="text-sm text-gray-400">Checking access…</div>
    </div>
  )

  return (
    <div>
      <div className="page-header"><h1>Finance</h1></div>
      <div className="page-content">
        <div className="card text-center py-16 text-gray-400 text-sm">
          Finance module — coming soon.
        </div>
      </div>
    </div>
  )
}
