export function normalizePointsPerRupiah(value: unknown): number {
  const n = Number(value ?? 1);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function pointsToRupiah(points: number, pointsPerRupiah = 1): number {
  const ratio = normalizePointsPerRupiah(pointsPerRupiah);
  return Number(points || 0) / ratio;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
