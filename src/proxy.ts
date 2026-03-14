import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const publicRoutes = ['/login', '/auth/callback', '/auth/confirm']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Block deactivated accounts — check is_active from public.users
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', user.id)
      .single()

    if (profile && !profile.is_active) {
      await supabase.auth.signOut()
      const redirectUrl = new URL('/login?raison=desactive', request.url)
      const redirectResponse = NextResponse.redirect(redirectUrl)
      // Copy cleared session cookies to the redirect response
      supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
        redirectResponse.cookies.set({ name, value, ...rest })
      })
      return redirectResponse
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}