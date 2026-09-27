import { supabaseAdmin } from './supabase-admin';

export type RewardKind = 'HINT' | 'TICKET' | 'XP';
export type AdsConfig = { rewarded_enabled: boolean; reward_kind: RewardKind; reward_amount: number; daily_rewarded_cap: number };
export type AdRewardUsage = { used: number; remaining: number; daily_cap: number; active_sessions: number };

export const defaultAdsConfig: AdsConfig = { rewarded_enabled: true, reward_kind: 'TICKET', reward_amount: 1, daily_rewarded_cap: 5 };

export async function getAdsConfig(): Promise<AdsConfig> {
  const { data, error } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'ads_config').maybeSingle();
  if (error) return defaultAdsConfig;
  const v = (data?.value ?? {}) as Partial<AdsConfig>;
  return {
    rewarded_enabled: v.rewarded_enabled !== false,
    reward_kind: ['HINT', 'TICKET', 'XP'].includes(String(v.reward_kind)) ? v.reward_kind as RewardKind : 'TICKET',
    reward_amount: Number.isInteger(v.reward_amount) && Number(v.reward_amount) > 0 ? Number(v.reward_amount) : 1,
    daily_rewarded_cap: Number.isInteger(v.daily_rewarded_cap) && Number(v.daily_rewarded_cap) > 0 ? Number(v.daily_rewarded_cap) : 5,
  };
}

export async function getAdRewardUsage(userId: string, dailyCap: number): Promise<AdRewardUsage> {
  const fallback = { used: 0, remaining: dailyCap, daily_cap: dailyCap, active_sessions: 0 };
  const { data, error } = await supabaseAdmin.rpc('get_ad_reward_usage', { p_user: userId, p_daily_cap: dailyCap });
  if (error || !data) return fallback;
  return {
    used: Math.max(0, Number(data.used ?? 0)),
    remaining: Math.max(0, Number(data.remaining ?? dailyCap)),
    daily_cap: Math.max(1, Number(data.daily_cap ?? dailyCap)),
    active_sessions: Math.max(0, Number(data.active_sessions ?? 0)),
  };
}

export function rewardedProvider() { return (process.env.REWARDED_AD_PROVIDER || 'DISABLED').trim().toUpperCase(); }
export function isDemoRewardedProvider() { return rewardedProvider() === 'DEMO'; }
