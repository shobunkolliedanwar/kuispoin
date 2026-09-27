import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(process.cwd()); const read=(p:string)=>readFileSync(resolve(root,p),'utf8');
describe('ads foundation',()=>{
 it('keeps rewarded ads outside redeemable point ledger',()=>{const sql=read('database/010_ads_foundation.sql');expect(sql).toContain('noncash_wallets');expect(sql).not.toMatch(/INSERT INTO point_transactions/i)});
 it('requires provider verification function before granting non-cash reward',()=>{const sql=read('database/010_ads_foundation.sql');expect(sql).toContain('verify_ad_reward_atomic');expect(sql).toContain("status='VERIFIED'");expect(sql).toContain('provider_event_id')});
 it('keeps demo completion behind the DEMO provider',()=>{expect(read('app/api/ads/rewarded/demo-complete/route.ts')).toContain('isDemoRewardedProvider()')});
});
