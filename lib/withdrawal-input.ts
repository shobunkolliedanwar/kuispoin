import {isValidEwalletMethod,isValidPayoutAccount,normalizePayoutAccount} from './validation';

export type WithdrawalInput = {points:number;method:string;account:string;name:string};
export function parseWithdrawalInput(body: unknown): WithdrawalInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const points = Number(b.points);
  const method = String(b.method ?? '').toUpperCase();
  const account = normalizePayoutAccount(b.accountNumber);
  const name = String(b.accountName ?? '').trim();
  if (!Number.isInteger(points) || points <= 0 || !isValidEwalletMethod(method) || !isValidPayoutAccount(account) || name.length > 100) return null;
  return {points,method,account,name};
}
