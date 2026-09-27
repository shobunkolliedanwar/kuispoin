import {describe,expect,it} from 'vitest';
import {isUuid,isValidEwalletMethod,isValidPayoutAccount,normalizePayoutAccount} from '../../lib/validation';

describe('security validation',()=>{
  it('normalizes payout account without changing digits',()=>expect(normalizePayoutAccount('0812-3456 7890')).toBe('081234567890'));
  it.each(['DANA','GOPAY','OVO','SHOPEEPAY'])('accepts supported wallet %s',m=>expect(isValidEwalletMethod(m)).toBe(true));
  it.each(['BANK','PAYPAL','','dana'])('rejects unsupported/non-normalized wallet %s',m=>expect(isValidEwalletMethod(m)).toBe(false));
  it.each(['081234567890','+6281234567890'])('accepts valid payout %s',n=>expect(isValidPayoutAccount(n)).toBe(true));
  it.each(['123','0812abc5678','0812 3456 7890',''])('rejects invalid payout %s',n=>expect(isValidPayoutAccount(n)).toBe(false));
  it('accepts UUID and rejects malformed identifiers',()=>{
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('../admin')).toBe(false); expect(isUuid(null)).toBe(false);
  });
});
