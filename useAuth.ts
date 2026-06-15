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
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        const { data } = await sb
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
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
      } catch {
        router.replace('/login')
      }
    }
    check()
  }, [router, requireRole])

  return { profile, loading }
}
