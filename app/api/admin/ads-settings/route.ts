import { NextResponse } from 'next/server';
import { requireAdmin, audit } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const config = {
    rewarded_enabled: body?.rewarded_enabled === true,
    reward_kind: String(body?.reward_kind ?? '').toUpperCase(),
    reward_amount: Number(body?.reward_amount),
    daily_rewarded_cap: Number(body?.daily_rewarded_cap),
  };
  if (!['HINT','TICKET','XP'].includes(config.reward_kind) || !Number.isInteger(config.reward_amount) || config.reward_amount < 1 || config.reward_amount > 100 || !Number.isInteger(config.daily_rewarded_cap) || config.daily_rewarded_cap < 1 || config.daily_rewarded_cap > 100) {
    return NextResponse.json({ error: 'Nilai ads setting tidak valid' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('app_settings').upsert({ key:'ads_config', value:config, updated_by:admin.user.id, updated_at:new Date().toISOString() });
  if (error) return NextResponse.json({ error:'Gagal menyimpan ads setting' }, { status:500 });
  await audit(admin.user.id,'UPDATE_SETTINGS','SETTING','ads_config',config);
  return NextResponse.json({ ok:true });
}
