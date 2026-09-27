import { describe, expect, it } from 'vitest';
import { normalizePointsPerRupiah, pointsToRupiah } from '../../lib/point-value';

describe('point value', () => {
  it('uses the current 1 point = Rp1 economy', () => expect(pointsToRupiah(1000, 1)).toBe(1000));
  it('supports a configurable points-per-rupiah ratio', () => expect(pointsToRupiah(10000, 10)).toBe(1000));
  it('falls back safely to ratio 1', () => expect(normalizePointsPerRupiah(0)).toBe(1));
});
