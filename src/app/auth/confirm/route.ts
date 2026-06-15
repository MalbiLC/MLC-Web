import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  if (tokenHash && type) {
    const cookieStore = cookies()
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options: CookieOptions }>) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    })
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
  }
  return NextResponse.redirect(`${origin}/login`)
}
