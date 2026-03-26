'use client'

import { useState, useLayoutEffect } from 'react'

// useLayoutEffect fires synchronously before the browser paints, so mobile
// devices never see the sidebar flash open on page transition.
export function useIsMobile(breakpoint = 768) {
  // Initialize synchronously from window when available (client-side navigation).
  // Falls back to false for SSR to avoid hydration mismatch.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useLayoutEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
