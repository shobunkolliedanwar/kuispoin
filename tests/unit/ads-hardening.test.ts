import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');
describe('ads hardening',()=>{
  it('counts verified rewards rather than abandoned starts toward the daily cap',()=>{const sql=read('database/011_ads_hardening.sql');expect(sql).toContain("status='VERIFIED'");expect(sql).toContain('verified_at >=');expect(sql).toContain("status='EXPIRED'")});
  it('binds reward verification to the provider',()=>{const sql=read('database/011_ads_hardening.sql');expect(sql).toContain('verify_ad_reward_atomic_v2');expect(sql).toContain('PROVIDER_MISMATCH');expect(read('app/api/ads/rewarded/demo-complete/route.ts')).toContain("p_provider:'DEMO'")});
  it('rate limits rewarded ad mutation endpoints',()=>{expect(read('app/api/ads/rewarded/session/route.ts')).toContain('allowAction');expect(read('app/api/ads/rewarded/demo-complete/route.ts')).toContain('allowAction')});
  it('shows daily usage to the user',()=>{const card=read('components/RewardedAdCard.tsx');expect(card).toContain('usage.used');expect(card).toContain('usage.remaining');expect(card).toContain('Batas hari ini tercapai')});
  it('keeps ads configuration admin-only and separate from reward economy',()=>{const api=read('app/api/admin/ads-settings/route.ts');expect(api).toContain('requireAdmin');expect(api).toContain("'ads_config'");expect(read('app/admin/settings/SettingsForm.tsx')).toContain('Rewarded Ads')});
  it('keeps the hardening migration away from redeemable points',()=>{expect(read('database/011_ads_hardening.sql')).not.toMatch(/INSERT INTO point_transactions/i)});
});
