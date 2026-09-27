import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireActiveUser } from '@/lib/access';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { allowAction } from '@/lib/rate-limit';
import { tryQualifyReferral } from '@/lib/referrals';

export async function POST() {
  const access = await requireActiveUser();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!await allowAction(`referral:attribute:${access.user.id}`, 5, 3600)) return NextResponse.json({ error: 'Terlalu banyak percobaan.' }, { status: 429 });
  const store = await cookies();
  const code = store.get('kp_referral')?.value;
  if (!code) return NextResponse.json({ status: 'NO_CODE' });
  const { data, error } = await supabaseAdmin.rpc('attribute_referral_atomic', { p_referred: access.user.id, p_code: code });
  if (error) {
    const known = error.message.includes('SELF_REFERRAL') || error.message.includes('INVALID_REFERRAL_CODE') || error.message.includes('ATTRIBUTION_WINDOW_CLOSED');
    const response = NextResponse.json({ error: known ? 'Kode referral tidak dapat digunakan.' : 'Gagal memproses referral.' }, { status: known ? 400 : 500 });
    if (known) response.cookies.delete('kp_referral');
    return response;
  }
  await tryQualifyReferral(access.user.id).catch(() => null);
  const response = NextResponse.json(data);
  response.cookies.delete('kp_referral');
  return response;
}
