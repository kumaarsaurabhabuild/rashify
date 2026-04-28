import { serverClient } from '@/lib/db/supabase';
import { BrandMark } from '@/components/BrandMark';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Database — Rashify' };

interface Row {
  slug: string;
  name: string;
  phone_e164: string;
  birth_place: string | null;
  status: string;
  created_at: string;
  referrer_slug: string | null;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${day}, ${time}`;
}

export default async function DatabasePage() {
  const sb = serverClient();
  const { data } = await sb
    .from('leads')
    .select('slug, name, phone_e164, birth_place, status, created_at, referrer_slug')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (data ?? []) as Row[];

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--parchment)' }}>
      <header
        className="flex items-center justify-between py-6 sm:py-8"
        style={{ paddingInline: 'clamp(20px, 5vw, 56px)' }}
      >
        <BrandMark size="md" />
        <a href="/" className="eyebrow" style={{ color: 'var(--ink-fade)', textDecoration: 'none' }}>
          ← Begin a reading
        </a>
      </header>

      <section
        className="flex-1"
        style={{ paddingInline: 'clamp(20px, 5vw, 56px)', paddingBottom: 64 }}
      >
        <div style={{ marginBottom: 24 }}>
          <span className="eyebrow">Acquired leads</span>
          <h1
            className="font-display"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 400, fontStyle: 'italic', margin: '8px 0', color: 'var(--ink)' }}
          >
            Database
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-fade)', margin: 0 }}>
            {rows.length} {rows.length === 1 ? 'reading' : 'readings'} · most recent first
          </p>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--gold-dim)', borderRadius: 2 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 14 }}>
            <thead style={{ background: 'var(--parchment-soft)', borderBottom: '1px solid var(--gold-dim)' }}>
              <tr style={{ color: 'var(--ink-fade)' }}>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Birth place</Th>
                <Th>Status</Th>
                <Th>When</Th>
                <Th>Origin</Th>
                <Th>Card</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-fade)' }}>
                    No leads yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.slug}
                  style={{ borderTop: '1px solid var(--gold-dim)' }}
                >
                  <Td>{r.name}</Td>
                  <Td mono>{r.phone_e164}</Td>
                  <Td soft>{r.birth_place ?? '—'}</Td>
                  <Td><StatusPill status={r.status} /></Td>
                  <Td soft nowrap>{fmtWhen(r.created_at)}</Td>
                  <Td soft>{r.referrer_slug ? <a href={`/u/${r.referrer_slug}`} style={{ color: 'var(--gold)' }}>{r.referrer_slug}</a> : 'direct'}</Td>
                  <Td>
                    <a
                      href={`/u/${r.slug}`}
                      style={{
                        fontFamily: 'var(--font-ui)', fontSize: 11,
                        letterSpacing: '0.16em', textTransform: 'uppercase',
                        color: 'var(--gold)', textDecoration: 'none',
                      }}
                    >
                      View →
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer
        className="flex flex-col sm:flex-row gap-3 sm:gap-0 items-center sm:justify-between py-6 sm:py-8"
        style={{
          paddingInline: 'clamp(20px, 5vw, 56px)',
          borderTop: '1px solid var(--gold-dim)',
          color: 'var(--ink-fade)',
        }}
      >
        <span className="eyebrow">◆ MMXXVI · Rashify</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Internal · read-only
        </span>
      </footer>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '12px 16px',
        textAlign: 'left',
        fontFamily: 'var(--font-ui)', fontWeight: 500,
        fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children, mono = false, soft = false, nowrap = false,
}: { children: React.ReactNode; mono?: boolean; soft?: boolean; nowrap?: boolean }) {
  return (
    <td
      style={{
        padding: '12px 16px',
        color: soft ? 'var(--ink-fade)' : 'var(--ink)',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'var(--font-body)',
        fontSize: mono ? 12 : 14,
        whiteSpace: nowrap ? 'nowrap' : 'normal',
      }}
    >
      {children}
    </td>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    ready:      { bg: '#e8f0e0', fg: '#3a5a2a' },
    pending:    { bg: '#fff4d8', fg: '#8a6a1a' },
    processing: { bg: '#fff4d8', fg: '#8a6a1a' },
    failed:     { bg: '#f4d8d4', fg: '#8a3a2a' },
  };
  const c = colors[status] ?? { bg: '#eee', fg: '#555' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        background: c.bg, color: c.fg,
        fontFamily: 'var(--font-ui)', fontSize: 10,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        borderRadius: 999,
      }}
    >
      {status}
    </span>
  );
}
