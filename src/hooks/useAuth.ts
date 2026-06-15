'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export function useAuth(requireRole?: 'owner') {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!data) {
        router.replace('/login')
        return
      }

      if (requireRole && data.role !== requireRole) {
        router.replace('/dashboard')
        return
      }

      setProfile(data as Profile)
      setLoading(false)
    }
    check()
  }, [router, requireRole])

  return { profile, loading }
}
