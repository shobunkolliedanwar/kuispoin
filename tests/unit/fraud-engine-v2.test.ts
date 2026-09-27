import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');
describe('Fraud Engine V2 source safety',()=>{
 it('keeps risk scoring server-side and service-role only',()=>{const sql=read('database/008_fraud_engine_v2.sql');expect(sql).toContain('withdrawal_risk_snapshot');expect(sql).toContain('GRANT EXECUTE ON FUNCTION withdrawal_risk_snapshot');expect(sql).toContain('TO service_role');});
 it('blocks high-risk withdrawal without auto-banning the user',()=>{const api=read('app/api/withdrawals/route.ts');expect(api).toContain('score>=7');expect(api).toContain("code:'WITHDRAWAL_RISK'");expect(api).not.toContain("status:'BANNED'");});
 it('keeps admin review auditable',()=>{const api=read('app/api/admin/fraud/[id]/status/route.ts');expect(api).toContain('resolved_by');expect(api).toContain("'FRAUD_STATUS'");});
});
