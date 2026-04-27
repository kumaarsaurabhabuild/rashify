'use client';
import { useId } from 'react';

export function ConsentCheckbox({
  checked, onChange, error,
}: { checked: boolean; onChange: (b: boolean) => void; error?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex items-start gap-2 text-sm ${error ? 'text-red-600' : ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="I consent"
      />
      <span>
        I consent to receiving my Vedic profile on WhatsApp and to Rashify storing my birth details for analysis.{' '}
        <a href="/privacy" className="underline">Privacy policy</a>.
      </span>
    </label>
  );
}
