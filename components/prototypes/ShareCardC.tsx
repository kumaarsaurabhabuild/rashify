import type { Archetype } from '@/lib/astro/chart-types';

/* PROTOTYPE C — BuzzFeed quiz-result style.
   Bright bold colors, multi-color words, casual conversational voice,
   playful background pattern, big "find yours" CTA. */

export function ShareCardC({ archetype: a }: { archetype: Archetype }) {
  const words = a.label.split(' ');
  const splitColors = ['#fff5e1', '#ff6b9d', '#ffd166'];

  return (
    <div
      style={{
        width: 1080, height: 1920,
        background: 'linear-gradient(145deg, #ff5470 0%, #ff8c42 50%, #ffd166 100%)',
        padding: 72,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Playful confetti dots in background */}
      {[...Array(12)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${(i * 137) % 100}%`,
          left: `${(i * 67) % 100}%`,
          width: 14 + (i % 3) * 8,
          height: 14 + (i % 3) * 8,
          background: i % 2 ? '#ffffff' : '#1a1a1a',
          opacity: 0.18,
          borderRadius: '50%',
          display: 'flex',
        }} />
      ))}

      {/* Top — big tag */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, zIndex: 1 }}>
        <div style={{
          background: '#1a1a1a',
          color: '#ffd166',
          padding: '14px 32px',
          alignSelf: 'flex-start',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 32, fontWeight: 800,
          letterSpacing: 4, textTransform: 'uppercase',
          display: 'flex',
          transform: 'rotate(-2deg)',
        }}>You got →</div>

        {/* Massive multi-color archetype name */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, marginTop: 32,
        }}>
          {words.map((w, i) => (
            <span key={i} style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 168, lineHeight: 0.92,
              fontWeight: 900, letterSpacing: -6,
              color: splitColors[i % splitColors.length],
              textShadow: '0 6px 0 rgba(0,0,0,0.18)',
              display: 'flex',
            }}>{w}</span>
          ))}
        </div>

        {/* Sanskrit subtitle, fun pill */}
        <div style={{
          marginTop: 28,
          background: '#ffffff',
          color: '#1a1a1a',
          padding: '14px 28px',
          borderRadius: 999,
          alignSelf: 'flex-start',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          fontSize: 38,
          display: 'flex',
        }}>aka {a.sanskritLabel}</div>
      </div>

      {/* Mid — punchline */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 16, zIndex: 1,
      }}>
        <span style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 26, fontWeight: 800, letterSpacing: 4,
          color: '#1a1a1a', textTransform: 'uppercase', display: 'flex',
        }}>Translation:</span>
        <span style={{
          fontFamily: 'Georgia, serif',
          fontSize: 72, fontStyle: 'italic',
          fontWeight: 400, lineHeight: 1.1,
          color: '#1a1a1a', display: 'flex',
        }}>{a.oneLiner}</span>
      </div>

      {/* Trait checklist */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 14, zIndex: 1,
      }}>
        {a.coreTraits.map((t, i) => (
          <div key={t} style={{
            display: 'flex', alignItems: 'center', gap: 18,
            background: i % 2 ? '#1a1a1a' : '#ffffff',
            color: i % 2 ? '#ffffff' : '#1a1a1a',
            padding: '20px 28px',
            borderRadius: 4,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 34, fontWeight: 600,
          }}>
            <span style={{
              fontSize: 32, display: 'flex',
              color: i % 2 ? '#ffd166' : '#ff5470',
            }}>✓</span>
            <span style={{ display: 'flex' }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Bottom — CTA + brand */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        zIndex: 1,
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          background: '#1a1a1a',
          color: '#ffd166',
          padding: '24px 32px',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <span style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700, display: 'flex' }}>FIND YOURS</span>
          <span style={{ fontSize: 38, fontWeight: 900, color: '#ffffff', display: 'flex' }}>rashify.app →</span>
        </div>
        <span style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 22, fontWeight: 700,
          background: '#ffffff',
          color: '#1a1a1a',
          padding: '10px 18px',
          borderRadius: 999,
          letterSpacing: 2,
          display: 'flex',
          textTransform: 'uppercase',
        }}>1 of 108 ✦</span>
      </div>
    </div>
  );
}
