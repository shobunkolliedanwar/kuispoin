'use client';

import { signIn } from 'next-auth/react';

export default function LoginButton({ callbackUrl = '/dashboard' }: { callbackUrl?: string }) {
  const safeCallback = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/dashboard';
  return (
    <button className="googleBtn" type="button" onClick={() => signIn('google', { callbackUrl: safeCallback })}>
      <span className="googleMark">G</span><span>Lanjutkan dengan Google</span>
    </button>
  );
}
