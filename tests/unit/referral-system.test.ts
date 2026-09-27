import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=process.cwd(); const read=(p:string)=>readFileSync(resolve(root,p),'utf8');
describe('Referral System v0.14/v0.15',()=>{
 it('ships the referral migration with anti-self-referral and idempotent rewards',()=>{const sql=read('database/012_referral_system.sql');expect(sql).toContain('referral_not_self');expect(sql).toContain('referred_user_id UUID NOT NULL UNIQUE');expect(sql).toContain('referral_reward_once_per_user');expect(sql).toContain("type='REFERRAL_REWARD'");expect(sql).toContain('REVOKE ALL ON FUNCTION attribute_referral_atomic');});
 it('qualifies only after account age and completed quiz requirements',()=>{const sql=read('database/012_referral_system.sql');expect(sql).toContain('min_account_age_hours');expect(sql).toContain('min_completed_quizzes');expect(sql).toContain("status='COMPLETED'");expect(sql).toContain('max_qualified_per_referrer_30d');});
 it('uses a server-only httpOnly referral cookie',()=>{const route=read('app/r/[code]/route.ts');expect(route).toContain("httpOnly: true");expect(route).toContain("sameSite: 'lax'");});
 it('provides user and admin referral surfaces',()=>{for(const p of ['app/referral/page.tsx','app/api/referrals/attribution/route.ts','app/admin/referrals/page.tsx','app/api/admin/referral-settings/route.ts'])expect(existsSync(resolve(root,p))).toBe(true);});
 it('reconciles qualification after quiz completion',()=>{expect(read('app/api/quiz/finish/route.ts')).toContain('tryQualifyReferral(userId)');});
 it('supports manual referral code through the same server attribution endpoint',()=>{const ui=read('app/referral/ReferralClaim.tsx');const api=read('app/api/referrals/attribution/route.ts');expect(ui).toContain('Gunakan Kode');expect(api).toContain("source = manualCode ? 'MANUAL' : 'LINK'");expect(api).toContain('attribute_referral_atomic');expect(read('database/013_referral_manual_code.sql')).toContain('attribution_window_days');});
});
