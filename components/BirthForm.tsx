'use client';
import { useState } from 'react';
import { ConsentCheckbox } from './ConsentCheckbox';
import { EditorialDateField } from './EditorialDateField';
import { EditorialTimeField } from './EditorialTimeField';

export interface BirthFormValue {
  name: string;
  dobDate: string;
  dobTime: string;
  birthPlace: string;
  phoneE164: string;
  consent: true;
}

export function BirthForm({
  onSubmit, mode,
}: {
  onSubmit: (v: BirthFormValue) => void | Promise<void>;
  mode: 'self' | 'friend';
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submitLabel = mode === 'self' ? 'Reveal my archetype' : 'See our match';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) { setErr('Consent required'); return; }
    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length !== 10) { setErr('Enter 10-digit Indian mobile'); return; }
    setErr(null);
    await onSubmit({
      name: name.trim(),
      dobDate: dob,
      dobTime: time,
      birthPlace: place.trim(),
      phoneE164: `+91${phoneClean}`,
      consent: true,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-7 column-narrow w-full">
      <label className="flex flex-col">
        <span className="label">Name</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="As written on official records"
        />
      </label>

      <EditorialDateField value={dob} onChange={setDob} />
      <EditorialTimeField value={time} onChange={setTime} />

      <label className="flex flex-col">
        <span className="label">Place of birth</span>
        <input
          className="field"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          required
          placeholder="City, town, or village"
        />
      </label>

      <label className="flex flex-col">
        <span className="label">WhatsApp number</span>
        <div
          className="flex items-baseline gap-3 transition-colors"
          style={{
            borderBottom: '1px solid var(--ink-faint)',
            minHeight: 48,
          }}
        >
          <span style={{ color: 'var(--ink-fade)', fontSize: 18 }}>+91</span>
          <input
            className="field"
            style={{ borderBottom: 'none' }}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="9999999999"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
      </label>

      <ConsentCheckbox checked={consent} onChange={setConsent} error={err === 'Consent required'} />

      {err && (
        <div
          role="alert"
          style={{
            color: '#a35a23',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            letterSpacing: '0.04em',
          }}
        >
          {err}
        </div>
      )}

      <button type="submit" className="btn-primary shimmer">
        <span>{submitLabel}</span>
        <span aria-hidden style={{ fontSize: 18 }}>→</span>
      </button>
    </form>
  );
}
