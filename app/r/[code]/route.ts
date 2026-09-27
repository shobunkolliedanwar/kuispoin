import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const target = new URL('/referral', req.url);
  const response = NextResponse.redirect(target);
  if (/^[A-Z0-9]{8,16}$/.test(normalized)) {
    response.cookies.set('kp_referral', normalized, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60, path: '/' });
  }
  return response;
}
