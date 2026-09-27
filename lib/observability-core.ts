export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
type Meta = Record<string, unknown>;
const SENSITIVE = /password|secret|token|authorization|cookie|service.?role|account.?number|payout|phone|email/i;
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[MAX_DEPTH]';
  if (Array.isArray(value)) return value.slice(0, 20).map(v => sanitizeMetadata(v, depth + 1));
  if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  const out: Meta = {};
  for (const [key, val] of Object.entries(value as Meta).slice(0, 50)) out[key] = SENSITIVE.test(key) ? '[REDACTED]' : sanitizeMetadata(val, depth + 1);
  return out;
}
