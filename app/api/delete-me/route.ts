import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === 'string' ? body.phone : '';
  if (!/^\+91\d{10}$/.test(phone)) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }
  // TODO Day-7: OTP confirm + soft-delete row.
  // v1 stub: queue manually via email.
  return NextResponse.json({
    status: 'queued',
    message: 'Your deletion request has been received. We will process it within 30 days. For immediate help, email privacy@rashify.in.',
  });
}

export async function GET() {
  return new Response(
    'POST {"phone":"+91XXXXXXXXXX"} to request deletion. Or email privacy@rashify.in.',
    { headers: { 'Content-Type': 'text/plain' } },
  );
}
