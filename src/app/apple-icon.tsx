import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

// MERAM brand Apple touch icon — used when saved to iPhone/iPad home screen.
// iOS automatically applies rounded corners and gloss — do NOT add borderRadius here.
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* MERAM M logo — viewBox 0 0 20 17, scaled to ~62% of canvas */}
      <svg width="111" height="94" viewBox="0 0 20 17" fill="none">
        <path
          d="M2 15V2L10 9L18 2V15"
          stroke="white" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          d="M2 15h16"
          stroke="white" strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { width: 180, height: 180 },
  )
}
