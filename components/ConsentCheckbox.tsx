'use client';
import { useId } from 'react';

export function ConsentCheckbox({
  checked, onChange, error,
}: { checked: boolean; onChange: (b: boolean) => void; error?: boolean }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3"
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        lineHeight: 1.55,
        color: error ? '#a35a23' : 'var(--ink-soft)',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="I consent"
        style={{
          marginTop: 4,
          accentColor: 'var(--gold)',
          width: 18,
          height: 18,
          flex: 'none',
          cursor: 'pointer',
        }}
      />
      <span>
        I consent to receiving my Vedic profile on WhatsApp and to Rashify storing my birth details for analysis.{' '}
        <a
          href="/privacy"
          style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Privacy policy
        </a>
        .
      </span>
    </label>
  );
}
