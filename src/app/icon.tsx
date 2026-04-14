import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(150deg, #6A3610 0%, #A0531A 65%, #C87B45 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 96,
    }}>
      <svg width="320" height="280" viewBox="0 0 20 16" fill="none">
        <path d="M2.5 14V2.5L10 9L17.5 2.5V14"
          stroke="#FAF5EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.5 14h15"
          stroke="#FAF5EE" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>,
    { width: 512, height: 512 },
  )
}
