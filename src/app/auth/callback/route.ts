import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const cookieStore = cookies()
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options: CookieOptions }>) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    })
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
  }
  return NextResponse.redirect(`${origin}/login`)
}
