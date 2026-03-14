import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%',
      background: '#0C1A35',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '22%',
    }}>
      <div style={{
        color: '#FFFFFF', fontSize: 70, fontWeight: 800,
        fontFamily: 'serif', letterSpacing: '-2px',
      }}>
        UCA
      </div>
    </div>,
    { width: 180, height: 180 },
  )
}
