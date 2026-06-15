import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for Supabase auth token in cookies
  const token = request.cookies.get('sb-access-token')?.value ||
    [...request.cookies.getAll()].find(c => c.name.includes('auth-token'))?.value

  const isLoggedIn = !!token
  const isLoginPage = pathname === '/login'
  const isAuthRoute = pathname.startsWith('/auth')
  const isRoot = pathname === '/'

  // Always allow auth routes through
  if (isAuthRoute) return NextResponse.next()

  // Root redirect
  if (isRoot) {
    return NextResponse.redirect(
      new URL(isLoggedIn ? '/dashboard' : '/login', request.url)
    )
  }

  // Not logged in → login page
  if (!isLoggedIn && !isLoginPage) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Already logged in → skip login
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
