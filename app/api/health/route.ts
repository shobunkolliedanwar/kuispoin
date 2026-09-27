import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logEvent, requestId } from '@/lib/observability';

export async function GET(req: Request) {
  const started = Date.now(); const rid = requestId(req);
  const { error } = await supabaseAdmin.from('users').select('id', { head: true, count: 'exact' }).limit(1);
  const duration = Date.now() - started; const ok = !error;
  if (!ok) await logEvent({ event:'HEALTHCHECK_FAILED', level:'ERROR', requestId:rid, route:'/api/health', statusCode:503, durationMs:duration, metadata:{ database:'down', errorCode:error?.code } });
  return NextResponse.json({ ok, service:'kuispoin', version:process.env.npm_package_version ?? 'unknown', database:ok?'up':'down', latencyMs:duration, timestamp:new Date().toISOString(), requestId:rid }, { status:ok?200:503, headers:{'x-request-id':rid,'cache-control':'no-store'} });
}
