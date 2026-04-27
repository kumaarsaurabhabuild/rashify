'use client';
import { useState } from 'react';
import { ConsentCheckbox } from './ConsentCheckbox';

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
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-md mx-auto">
      <label className="flex flex-col">
        <span className="text-sm">Name</span>
        <input className="border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Date of birth</span>
        <input type="date" className="border rounded px-3 py-2" value={dob} onChange={(e) => setDob(e.target.value)} required />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Time of birth</span>
        <input type="time" className="border rounded px-3 py-2" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Place of birth</span>
        <input className="border rounded px-3 py-2" value={place} onChange={(e) => setPlace(e.target.value)} required placeholder="Mumbai" />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Phone (WhatsApp)</span>
        <input className="border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="9999999999" inputMode="numeric" />
      </label>
      <ConsentCheckbox checked={consent} onChange={setConsent} error={err === 'Consent required'} />
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <button type="submit" className="bg-[#3a0a14] text-[#f1e7d4] py-3 rounded">{submitLabel}</button>
    </form>
  );
}
