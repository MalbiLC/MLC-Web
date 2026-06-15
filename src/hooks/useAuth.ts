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
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      sb.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
        if (!data) { router.replace('/login'); return }
        if (requireRole && data.role !== requireRole) { router.replace('/dashboard'); return }
        setProfile(data as Profile)
        setLoading(false)
      })
    }).catch(() => { router.replace('/login') })
  }, [router, requireRole])

  return { profile, loading }
}
