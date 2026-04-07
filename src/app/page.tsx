import { redirect } from 'next/navigation'

// Root always redirects — middleware handles auth state,
// but this is a server-side fallback in case middleware is bypassed.
export default function RootPage() {
  redirect('/dashboard')
}
