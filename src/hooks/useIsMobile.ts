'use client'

import { useState, useLayoutEffect } from 'react'

// useLayoutEffect fires synchronously before the browser paints, so mobile
// devices never see the sidebar flash open on page transition.
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useLayoutEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
