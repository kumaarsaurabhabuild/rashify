export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { glyph: 14, label: 11, gap: 10, letter: 0.32 },
    md: { glyph: 20, label: 13, gap: 14, letter: 0.36 },
    lg: { glyph: 28, label: 16, gap: 18, letter: 0.4 },
  } as const;
  const s = sizes[size];
  return (
    <div
      className="font-ui"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        color: 'var(--gold)',
      }}
    >
      <span style={{ fontSize: s.glyph, lineHeight: 1, color: 'var(--gold)' }}>◆</span>
      <span
        style={{
          fontSize: s.label,
          letterSpacing: `${s.letter}em`,
          textTransform: 'uppercase',
        }}
      >
        Rashify
      </span>
    </div>
  );
}
