'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      router.replace(user ? '/dashboard' : '/login')
    }
    redirect()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  )
}
