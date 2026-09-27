import { NextResponse } from 'next/server';
import { requireAdmin, audit } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !['REVIEWED', 'DISMISSED'].includes(body.status)) {
    return NextResponse.json({ error: 'Status invalid' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('fraud_flags')
    .update({ status: body.status, resolved_at: new Date().toISOString(), resolved_by: session.user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'OPEN')
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Flag sudah diproses atau tidak ditemukan' }, { status: 409 });
  await audit(session.user.id, 'FRAUD_STATUS', 'FRAUD_FLAG', id, { status: body.status });
  return NextResponse.json({ ok: true });
}
