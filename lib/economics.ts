import { normalizePointsPerRupiah, pointsToRupiah } from './point-value';

export type EconomySnapshot = {
  issuedPoints: number;
  spentPoints: number;
  outstandingPoints: number;
  paidWithdrawalPoints: number;
  pointsPerRupiah: number;
};

export function buildEconomySnapshot(amounts: number[], paidWithdrawalPoints: number, pointsPerRupiah: unknown): EconomySnapshot & { outstandingRupiah: number; paidWithdrawalRupiah: number } {
  const ratio = normalizePointsPerRupiah(pointsPerRupiah);
  const issuedPoints = amounts.filter(x => x > 0).reduce((a, x) => a + x, 0);
  const spentPoints = Math.abs(amounts.filter(x => x < 0).reduce((a, x) => a + x, 0));
  const outstandingPoints = amounts.reduce((a, x) => a + x, 0);
  return {
    issuedPoints,
    spentPoints,
    outstandingPoints,
    paidWithdrawalPoints,
    pointsPerRupiah: ratio,
    outstandingRupiah: pointsToRupiah(outstandingPoints, ratio),
    paidWithdrawalRupiah: pointsToRupiah(paidWithdrawalPoints, ratio),
  };
}
