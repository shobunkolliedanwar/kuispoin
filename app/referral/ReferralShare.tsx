'use client';

import { useState } from 'react';

export default function ReferralShare({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  async function copy(value: string, kind: 'code' | 'link') {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return <div className="referralShareActions">
    <button className="btn" type="button" onClick={() => copy(code, 'code')}>{copied === 'code' ? '✓ Kode disalin' : 'Salin Kode'}</button>
    <button className="btn secondary" type="button" onClick={() => copy(link, 'link')}>{copied === 'link' ? '✓ Link disalin' : 'Salin Link'}</button>
  </div>;
}
