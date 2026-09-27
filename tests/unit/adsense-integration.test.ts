import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const read = (path: string) =>
  readFileSync(resolve(root, path), 'utf8');

describe('AdSense production integration', () => {
  it('loads the AdSense script from the root layout without rewarding ad clicks', () => {
    const layout = read('app/layout.tsx');
    const adsense = read('lib/adsense.ts');

    // Root layout must use the centralized AdSense helper.
    expect(layout).toContain('getAdSenseScriptUrl');
    expect(layout).toContain('isAdSenseEnabled');
    expect(layout).toContain('crossOrigin="anonymous"');

    // AdSense URL and publisher ID belong in the centralized helper,
    // not hardcoded directly inside the root layout.
    expect(adsense).toContain('pagead2.googlesyndication.com');
    expect(adsense).toContain('ca-pub-3192016222321677');

    // Regular AdSense must never directly grant redeemable points.
    expect(layout).not.toContain('point_transactions');
    expect(adsense).not.toContain('point_transactions');
  });

  it('publishes a valid Google ads.txt declaration', () => {
    const adsTxtPath = resolve(root, 'public/ads.txt');

    expect(existsSync(adsTxtPath)).toBe(true);
    expect(read('public/ads.txt').trim()).toBe(
      'google.com, pub-3192016222321677, DIRECT, f08c47fec0942fa0',
    );
  });

  it('provides public content, privacy and terms pages for review', () => {
    const publicPages = [
      'app/page.tsx',
      'app/how-it-works/page.tsx',
      'app/faq/page.tsx',
      'app/about/page.tsx',
      'app/privacy/page.tsx',
      'app/terms/page.tsx',
    ];

    for (const page of publicPages) {
      expect(existsSync(resolve(root, page))).toBe(true);
    }

    // Root page must remain publicly accessible for AdSense review.
    expect(read('app/page.tsx')).not.toContain("redirect('/login')");

    // Privacy disclosure must mention the advertising provider.
    expect(read('app/privacy/page.tsx')).toContain('Google AdSense');
  });
});