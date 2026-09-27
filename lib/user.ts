import { supabaseAdmin } from '@/lib/supabase-admin';

export async function upsertGoogleUser(input: { googleId: string; email: string; name?: string | null; image?: string | null }) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({
      google_account_id: input.googleId,
      email: input.email,
      name: input.name ?? null,
      avatar_url: input.image ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'google_account_id' })
    .select('id, role, status')
    .single();
  if (error) throw error;
  return data;
}
