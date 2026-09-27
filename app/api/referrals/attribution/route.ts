import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireActiveUser } from '@/lib/access';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { allowAction } from '@/lib/rate-limit';
import { tryQualifyReferral } from '@/lib/referrals';
import { logEvent, requestId } from '@/lib/observability';

const CODE_RE = /^[A-Z0-9]{8,16}$/;

export async function POST(req: Request) {
  const rid = requestId(req);
  const access = await requireActiveUser();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!await allowAction(`referral:attribute:${access.user.id}`, 5, 3600)) return NextResponse.json({ error: 'Terlalu banyak percobaan.' }, { status: 429 });

  const store = await cookies();
  const contentType = req.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await req.json().catch(() => null) as { code?: unknown } | null : null;
  const manualCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const cookieCode = store.get('kp_referral')?.value?.trim().toUpperCase() ?? '';
  const code = manualCode || cookieCode;
  const source = manualCode ? 'MANUAL' : 'LINK';

  if (!code) return NextResponse.json({ status: 'NO_CODE' });
  if (!CODE_RE.test(code)) return NextResponse.json({ error: 'Format kode referral tidak valid.' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('attribute_referral_atomic', { p_referred: access.user.id, p_code: code });
  if (error) {
    const known = ['SELF_REFERRAL', 'INVALID_REFERRAL_CODE', 'ATTRIBUTION_WINDOW_CLOSED', 'REFERRAL_DISABLED', 'REFERRER_NOT_ACTIVE'].some(x => error.message.includes(x));
    await logEvent({ event: 'REFERRAL_ATTRIBUTION_FAILED', level: known ? 'WARN' : 'ERROR', requestId: rid, route: '/api/referrals/attribution', userId: access.user.id, statusCode: known ? 400 : 500, metadata: { source, reason: error.message.split(':')[0] } });
    const response = NextResponse.json({ error: known ? 'Kode referral tidak dapat digunakan.' : 'Gagal memproses referral.' }, { status: known ? 400 : 500 });
    if (cookieCode) response.cookies.delete('kp_referral');
    return response;
  }

  await tryQualifyReferral(access.user.id).catch(() => null);
  await logEvent({ event: 'REFERRAL_ATTRIBUTED', requestId: rid, route: '/api/referrals/attribution', userId: access.user.id, statusCode: 200, metadata: { source, status: data?.status ?? 'UNKNOWN' } });
  const response = NextResponse.json(data);
  if (cookieCode) response.cookies.delete('kp_referral');
  return response;
}
