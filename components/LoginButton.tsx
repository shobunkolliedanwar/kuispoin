'use client';

import { signIn } from 'next-auth/react';

export default function LoginButton() {
  return (
    <button
      className="googleBtn"
      type="button"
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
    >
      <span className="googleMark">G</span>
      <span>Lanjutkan dengan Google</span>
    </button>
  );
}
