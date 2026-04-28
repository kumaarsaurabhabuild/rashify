'use client';
import { useEffect, useMemo, useState } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

export function EditorialDateField({
  value,
  onChange,
  label = 'Date of birth',
  yearMin = 1925,
  yearMax,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  yearMin?: number;
  yearMax?: number;
}) {
  const max = yearMax ?? new Date().getFullYear();

  const initial = useMemo(() => {
    const [yStr = '', mStr = '', dStr = ''] = (value || '').split('-');
    return {
      d: parseInt(dStr, 10) || 0,
      m: parseInt(mStr, 10) || 0,
      y: parseInt(yStr, 10) || 0,
    };
  }, [value]);

  const [d, setD] = useState<number>(initial.d);
  const [m, setM] = useState<number>(initial.m);
  const [y, setY] = useState<number>(initial.y);

  // Re-sync on outside reset (form clear)
  useEffect(() => {
    if (!value) { setD(0); setM(0); setY(0); }
  }, [value]);

  const years = useMemo(() => {
    const out: number[] = [];
    for (let yr = max; yr >= yearMin; yr--) out.push(yr);
    return out;
  }, [yearMin, max]);

  const days = useMemo(() => {
    const n = daysInMonth(m, y || max);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [m, y, max]);

  const sync = (nd: number, nm: number, ny: number) => {
    setD(nd); setM(nm); setY(ny);
    if (!nd || !nm || !ny) {
      onChange('');
      return;
    }
    const safeD = Math.min(nd, daysInMonth(nm, ny));
    if (safeD !== nd) setD(safeD);
    onChange(
      `${ny.toString().padStart(4, '0')}-${nm.toString().padStart(2, '0')}-${safeD
        .toString()
        .padStart(2, '0')}`,
    );
  };

  return (
    <div className="flex flex-col">
      <span className="label">{label}</span>
      <div className="ed-trio">
        <SelectChip value={d || ''} onChange={(v) => sync(parseInt(v || '0', 10), m, y)} placeholder="Day" ariaLabel="Day">
          {days.map((dd) => (<option key={dd} value={dd}>{dd}</option>))}
        </SelectChip>
        <SelectChip value={m || ''} onChange={(v) => sync(d, parseInt(v || '0', 10), y)} placeholder="Month" ariaLabel="Month">
          {MONTHS.map((mn, i) => (<option key={mn} value={i + 1}>{mn}</option>))}
        </SelectChip>
        <SelectChip value={y || ''} onChange={(v) => sync(d, m, parseInt(v || '0', 10))} placeholder="Year" ariaLabel="Year">
          {years.map((yr) => (<option key={yr} value={yr}>{yr}</option>))}
        </SelectChip>
      </div>
      <style>{`
        .ed-trio { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 12px; }
        @media (max-width: 380px) { .ed-trio { gap: 8px; } }
      `}</style>
    </div>
  );
}

interface SelectChipProps {
  value: string | number;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  children: React.ReactNode;
}

function SelectChip({ value, onChange, placeholder, ariaLabel, children }: SelectChipProps) {
  return (
    <div className="select-chip">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="" disabled>{placeholder}</option>
        {children}
      </select>
      <span aria-hidden className="chev">▾</span>
      <style>{`
        .select-chip { position: relative; display: flex; align-items: center; }
        .select-chip select {
          width: 100%;
          appearance: none;
          -webkit-appearance: none;
          background: var(--parchment-soft);
          border: 1px solid var(--ink-faint);
          color: var(--ink);
          font-family: var(--font-body);
          font-size: 16px;
          padding: 12px 32px 12px 14px;
          min-height: 48px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          transition: border-color 0.25s ease, background 0.25s ease;
        }
        .select-chip select:focus { border-color: var(--gold); background: var(--parchment); }
        .select-chip select:invalid { color: var(--ink-fade); }
        .select-chip .chev { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--gold); pointer-events: none; font-size: 13px; }
      `}</style>
    </div>
  );
}
