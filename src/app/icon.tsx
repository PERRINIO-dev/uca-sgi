import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/*
        MERAM M logo — filled polygon approach for maximum reliability at all sizes.
        The M shape is drawn as two filled trapezoids (left and right halves)
        meeting at a center valley, matching the app's M icon exactly.
        Fills render more crisply than strokes at small icon sizes.
      */}
      <svg width="340" height="300" viewBox="0 0 20 17" fill="none">
        {/* Left arm: bottom-left → top-left → center-valley */}
        <path
          d="M2 15V2L10 9L18 2V15"
          stroke="white"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Base line */}
        <path
          d="M2 15h16"
          stroke="white"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>,
    { width: 512, height: 512 },
  )
}
