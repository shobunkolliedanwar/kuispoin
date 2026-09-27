import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { supabaseAdmin } from './supabase-admin';

export async function requireActiveUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401, error: 'Unauthorized' };
  const { data: user, error } = await supabaseAdmin.from('users').select('id,role,status').eq('id', session.user.id).maybeSingle();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  if (user.status !== 'ACTIVE') return { ok: false as const, status: 403, error: 'Akun tidak aktif' };
  return { ok: true as const, session, user };
}
