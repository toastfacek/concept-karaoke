import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Badlobs - Make bad ad campaign concepts with friends'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 71, 255, 0.1) 25%, rgba(0, 71, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 71, 255, 0.1) 75%, rgba(0, 71, 255, 0.1) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 71, 255, 0.1) 25%, rgba(0, 71, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 71, 255, 0.1) 75%, rgba(0, 71, 255, 0.1) 76%, transparent 77%, transparent)',
            backgroundSize: '60px 60px',
            opacity: 0.3,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 32,
            zIndex: 1,
            border: '8px solid #0047FF',
            padding: '80px 120px',
            background: 'rgba(0, 0, 0, 0.8)',
            boxShadow: '16px 16px 0 #FF006E',
          }}
        >
          {/* Logo/Title */}
          <div
            style={{
              fontSize: 120,
              fontWeight: 'bold',
              color: '#FFD60A',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              fontFamily: 'monospace',
              textShadow: '4px 4px 0 #0047FF',
            }}
          >
            BADLOBS
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 36,
              color: '#FFFFFF',
              fontFamily: 'system-ui',
              textAlign: 'center',
              maxWidth: 800,
            }}
          >
            Make bad ad campaign concepts with friends
          </div>

          {/* Decorative elements */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 24,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                background: '#0047FF',
                border: '4px solid #FFD60A',
              }}
            />
            <div
              style={{
                width: 80,
                height: 80,
                background: '#FF006E',
                border: '4px solid #FFD60A',
              }}
            />
            <div
              style={{
                width: 80,
                height: 80,
                background: '#FFD60A',
                border: '4px solid #0047FF',
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}