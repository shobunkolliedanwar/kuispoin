export const EWALLET_METHODS = ['DANA','GOPAY','OVO','SHOPEEPAY'] as const;
export function normalizePayoutAccount(value: unknown) { return String(value ?? '').replace(/[\s-]/g, '').trim(); }
export function isValidPayoutAccount(value: string) { return /^[0-9+]{8,20}$/.test(value); }
export function isValidEwalletMethod(value: string) { return (EWALLET_METHODS as readonly string[]).includes(value); }
export function isUuid(value: unknown) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
