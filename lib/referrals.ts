import { supabaseAdmin } from '@/lib/supabase-admin';

export type ReferralConfig = {
  enabled: boolean;
  referrer_reward_points: number;
  referred_reward_points: number;
  min_account_age_hours: number;
  min_completed_quizzes: number;
  max_qualified_per_referrer_30d: number;
  attribution_window_days: number;
};

export const defaultReferralConfig: ReferralConfig = {
  enabled: true,
  referrer_reward_points: 100,
  referred_reward_points: 50,
  min_account_age_hours: 24,
  min_completed_quizzes: 3,
  max_qualified_per_referrer_30d: 20,
  attribution_window_days: 7,
};

export async function getReferralConfig(): Promise<ReferralConfig> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'referral_config').maybeSingle();
  return { ...defaultReferralConfig, ...((data?.value ?? {}) as Partial<ReferralConfig>) };
}

export async function ensureReferralCode(userId: string) {
  const { data, error } = await supabaseAdmin.rpc('ensure_referral_code', { p_user: userId });
  if (error) throw error;
  return String(data);
}

export async function tryQualifyReferral(userId: string) {
  const { data, error } = await supabaseAdmin.rpc('qualify_referral_atomic', { p_referred: userId });
  if (error) throw error;
  return data;
}
