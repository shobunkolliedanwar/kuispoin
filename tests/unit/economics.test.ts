import { describe, expect, it } from 'vitest';
import { buildEconomySnapshot } from '../../lib/economics';

describe('Unit economics foundation v0.15', () => {
  it('separates issued, spent, outstanding and paid withdrawal exposure', () => {
    const s = buildEconomySnapshot([100, 50, -80, 25], 80, 1);
    expect(s.issuedPoints).toBe(175);
    expect(s.spentPoints).toBe(80);
    expect(s.outstandingPoints).toBe(95);
    expect(s.outstandingRupiah).toBe(95);
    expect(s.paidWithdrawalRupiah).toBe(80);
  });
  it('respects points-per-rupiah configuration', () => {
    const s = buildEconomySnapshot([1000, -200], 200, 10);
    expect(s.outstandingRupiah).toBe(80);
    expect(s.paidWithdrawalRupiah).toBe(20);
  });
});
