import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="120" height="102" viewBox="0 0 20 17" fill="none">
        <path
          d="M2 15V2L10 9L18 2V15"
          stroke="white"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M2 15h16"
          stroke="white"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>,
    { width: 180, height: 180 },
  )
}
