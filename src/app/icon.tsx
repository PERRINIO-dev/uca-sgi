import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%',
      background: '#0C1A35',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        color: '#FFFFFF', fontSize: 200, fontWeight: 800,
        fontFamily: 'serif', letterSpacing: '-6px',
      }}>
        UCA
      </div>
    </div>,
    { width: 512, height: 512 },
  )
}
