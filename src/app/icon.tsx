import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

// MERAM brand icon — M logo on blue gradient background.
// Used as: browser tab favicon, PWA icon, Android home screen icon.
// iOS applies its own rounded corners — do NOT add borderRadius here.
export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* MERAM M logo — viewBox 0 0 20 17, scaled to ~62% of canvas */}
      <svg width="318" height="270" viewBox="0 0 20 17" fill="none">
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
    { width: 512, height: 512 },
  )
}
