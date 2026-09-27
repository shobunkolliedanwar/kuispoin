import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Next.js route source integrity', () => {
  it('keeps a public root and dashboard in its own protected route', () => {
    const rootPage = read('app/page.tsx');
    const dashboard = read('app/dashboard/page.tsx');
    expect(rootPage).toContain('PublicHeader');
    expect(rootPage).toContain('href="/login"');
    expect(dashboard).toContain('export default async function DashboardPage');
    expect(dashboard).toContain('@/components/UserBar');
    expect(dashboard).toContain("redirect('/login')");
  });

  it('uses dashboard as the safe default Google login callback', () => {
    const loginButton = read('components/LoginButton.tsx');
    const login = read('app/login/page.tsx');

    // LoginButton may accept a referral-aware callback,
    // but /dashboard must remain the safe default.
    expect(loginButton).toContain("callbackUrl = '/dashboard'");
    expect(loginButton).toContain(
      "callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')",
    );
    expect(loginButton).toContain(
      "signIn('google', { callbackUrl: safeCallback })",
    );

    // Normal login still defaults to the dashboard.
    expect(login).toContain("'/dashboard'");
  });

  it('keeps user navigation away from the root login redirect', () => {
    expect(read('components/Nav.tsx')).toContain('href="/dashboard"');
    expect(read('app/admin/AdminNav.tsx')).toContain('href="/dashboard"');
  });

  it('keeps the admin overview at app/admin/page.tsx', () => {
    const src = read('app/admin/page.tsx');
    expect(src).toContain('./AdminWithdrawals');
    expect(src).toContain('./AdminNav');
    expect(src).toContain('export default async function Admin');
    expect(src).not.toContain('./SettingsForm');
  });

  it('keeps observability operations in the admin console', () => {
    expect(existsSync(resolve(root, 'app/admin/operations/page.tsx'))).toBe(true);
    expect(read('app/admin/AdminNav.tsx')).toContain('href="/admin/operations"');
    expect(existsSync(resolve(root, 'database/009_observability.sql'))).toBe(true);
  });

  it('keeps rewarded ads isolated from redeemable points', () => {
    expect(existsSync(resolve(root, 'database/010_ads_foundation.sql'))).toBe(true);
    expect(existsSync(resolve(root, 'database/011_ads_hardening.sql'))).toBe(true);
    expect(existsSync(resolve(root, 'components/RewardedAdCard.tsx'))).toBe(true);
    expect(existsSync(resolve(root, 'app/api/ads/rewarded/session/route.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'app/api/ads/rewarded/demo-complete/route.ts'))).toBe(true);
  });

  it('keeps settings and wallet components in their own route folders', () => {
    expect(existsSync(resolve(root, 'app/admin/settings/SettingsForm.tsx'))).toBe(true);
    expect(read('app/admin/settings/page.tsx')).toContain('./SettingsForm');
    expect(existsSync(resolve(root, 'app/wallet/WithdrawForm.tsx'))).toBe(true);
    expect(read('app/wallet/page.tsx')).toContain('./WithdrawForm');
  });
});
