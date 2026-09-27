import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Next.js route source integrity', () => {
  it('keeps root as a login redirect and dashboard in its own route', () => {
    const rootPage = read('app/page.tsx');
    const dashboard = read('app/dashboard/page.tsx');
    expect(rootPage).toContain("redirect('/login')");
    expect(dashboard).toContain('export default async function DashboardPage');
    expect(dashboard).toContain('@/components/UserBar');
    expect(dashboard).toContain("redirect('/login')");
  });

  it('uses dashboard as the Google login callback', () => {
    expect(read('components/LoginButton.tsx')).toContain("callbackUrl: '/dashboard'");
    const login = read('app/login/page.tsx');
    expect(login).toContain("'/dashboard'");
    expect(login).toContain("'/admin'");
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
