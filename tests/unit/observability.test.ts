import { describe, expect, it } from 'vitest';
import { sanitizeMetadata } from '../../lib/observability-core';

describe('observability metadata safety',()=>{
  it('redacts common secrets and payout identifiers',()=>{
    const out=sanitizeMetadata({token:'abc',authorization:'Bearer x',accountNumber:'0812345678',email:'a@b.com',safe:'ok'}) as Record<string,unknown>;
    expect(out.token).toBe('[REDACTED]'); expect(out.authorization).toBe('[REDACTED]'); expect(out.accountNumber).toBe('[REDACTED]'); expect(out.email).toBe('[REDACTED]'); expect(out.safe).toBe('ok');
  });
  it('redacts nested sensitive fields',()=>{const out=sanitizeMetadata({nested:{serviceRoleKey:'x',reason:'safe'}}) as any;expect(out.nested.serviceRoleKey).toBe('[REDACTED]');expect(out.nested.reason).toBe('safe')});
  it('bounds large strings and arrays',()=>{const out=sanitizeMetadata({text:'x'.repeat(700),items:Array.from({length:30},(_,i)=>i)}) as any;expect(out.text.length).toBeLessThan(510);expect(out.items).toHaveLength(20)});
});
