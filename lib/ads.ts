import { supabaseAdmin } from './supabase-admin';

export type AdsConfig = { rewarded_enabled: boolean; reward_kind: 'HINT'|'TICKET'|'XP'; reward_amount: number; daily_rewarded_cap: number };
export const defaultAdsConfig: AdsConfig = { rewarded_enabled: true, reward_kind: 'TICKET', reward_amount: 1, daily_rewarded_cap: 5 };

export async function getAdsConfig(): Promise<AdsConfig> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key','ads_config').maybeSingle();
  const v = (data?.value ?? {}) as Partial<AdsConfig>;
  return {
    rewarded_enabled: v.rewarded_enabled !== false,
    reward_kind: ['HINT','TICKET','XP'].includes(String(v.reward_kind)) ? v.reward_kind as AdsConfig['reward_kind'] : 'TICKET',
    reward_amount: Number.isInteger(v.reward_amount) && Number(v.reward_amount)>0 ? Number(v.reward_amount) : 1,
    daily_rewarded_cap: Number.isInteger(v.daily_rewarded_cap) && Number(v.daily_rewarded_cap)>0 ? Number(v.daily_rewarded_cap) : 5,
  };
}

export function rewardedProvider() { return (process.env.REWARDED_AD_PROVIDER || 'DISABLED').trim().toUpperCase(); }
export function isDemoRewardedProvider() { return rewardedProvider() === 'DEMO'; }
