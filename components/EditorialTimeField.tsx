'use client';
import { useEffect, useMemo, useState } from 'react';

export function EditorialTimeField({
  value,
  onChange,
  label = 'Time of birth',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const initial = useMemo(() => {
    const [hStr = '', mStr = ''] = value ? value.split(':') : ['', ''];
    const h = parseInt(hStr, 10);
    const mn = parseInt(mStr, 10);
    if (Number.isNaN(h) || Number.isNaN(mn)) return { h12: 0, mm: -1, mer: 'AM' as const };
    const meridiem: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    const twelve = ((h + 11) % 12) + 1;
    return { h12: twelve, mm: mn, mer: meridiem };
  }, [value]);

  const [h12, setH12] = useState<number>(initial.h12);
  const [mm, setMm] = useState<number>(initial.mm);
  const [mer, setMer] = useState<'AM' | 'PM'>(initial.mer);

  useEffect(() => {
    if (!value) { setH12(0); setMm(-1); setMer('AM'); }
  }, [value]);

  const sync = (nh: number, nmm: number, nmer: 'AM' | 'PM') => {
    setH12(nh); setMm(nmm); setMer(nmer);
    if (!nh || nmm < 0) {
      onChange('');
      return;
    }
    let h = nh;
    if (nmer === 'AM') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    onChange(`${String(h).padStart(2, '0')}:${String(nmm).padStart(2, '0')}`);
  };

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  return (
    <div className="flex flex-col">
      <span className="label">{label}</span>
      <div className="ed-time">
        <select
          aria-label="Hour"
          value={h12 || ''}
          onChange={(e) => sync(parseInt(e.target.value, 10), mm, mer)}
          required
        >
          <option value="" disabled>Hr</option>
          {hours.map((h) => (<option key={h} value={h}>{h}</option>))}
        </select>

        <span className="colon">:</span>

        <select
          aria-label="Minute"
          value={mm >= 0 ? mm : ''}
          onChange={(e) => sync(h12, parseInt(e.target.value, 10), mer)}
          required
        >
          <option value="" disabled>Min</option>
          {minutes.map((m) => (<option key={m} value={m}>{String(m).padStart(2, '0')}</option>))}
        </select>

        <div className="meridiem" role="group" aria-label="AM or PM">
          {(['AM', 'PM'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`mer-btn ${mer === opt ? 'on' : ''}`}
              onClick={() => sync(h12 || 12, mm < 0 ? 0 : mm, opt)}
              aria-pressed={mer === opt}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .ed-time { display: grid; grid-template-columns: 1fr auto 1fr 96px; gap: 8px; align-items: center; }
        .ed-time select {
          appearance: none; -webkit-appearance: none;
          background: var(--parchment-soft);
          border: 1px solid var(--ink-faint);
          color: var(--ink);
          font-family: var(--font-body);
          font-size: 16px;
          padding: 12px 12px 12px 14px;
          min-height: 48px; border-radius: 2px;
          outline: none; cursor: pointer; text-align: center;
          transition: border-color 0.25s ease, background 0.25s ease;
        }
        .ed-time select:focus { border-color: var(--gold); background: var(--parchment); }
        .ed-time select:invalid { color: var(--ink-fade); }
        .ed-time .colon { font-family: var(--font-display); font-size: 24px; color: var(--gold); line-height: 1; }
        .meridiem { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--ink-faint); border-radius: 2px; overflow: hidden; min-height: 48px; }
        .mer-btn { background: var(--parchment-soft); color: var(--ink-soft); font-family: var(--font-ui); font-size: 12px; letter-spacing: 0.18em; font-weight: 600; cursor: pointer; transition: background 0.25s ease, color 0.25s ease; border: none; padding: 0; }
        .mer-btn + .mer-btn { border-left: 1px solid var(--ink-faint); }
        .mer-btn.on { background: var(--ink); color: var(--parchment); }
        .mer-btn:not(.on):hover { background: var(--parchment-warm); color: var(--ink); }
      `}</style>
    </div>
  );
}
