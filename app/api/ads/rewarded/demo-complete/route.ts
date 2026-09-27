import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import { requireActiveUser } from '@/lib/access';
import { isDemoRewardedProvider } from '@/lib/ads';
import { logEvent, requestId } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ROUTE = '/api/ads/rewarded/demo-complete';

export async function POST(req: Request) {
  const reqId = requestId(req);
  const access = await requireActiveUser();

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      {
        status: access.status,
        headers: { 'x-request-id': reqId },
      },
    );
  }

  if (!isDemoRewardedProvider()) {
    return NextResponse.json(
      { error: 'Demo provider tidak aktif' },
      {
        status: 404,
        headers: { 'x-request-id': reqId },
      },
    );
  }

  const body = await req.json().catch(() => null);
  const sessionId = String(body?.sessionId ?? '');

  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json(
      { error: 'Session tidak valid' },
      {
        status: 400,
        headers: { 'x-request-id': reqId },
      },
    );
  }

  const providerEventId = `demo_${randomUUID()}`;

  const { data, error } = await supabaseAdmin.rpc(
    'verify_ad_reward_atomic',
    {
      p_user: access.user.id,
      p_session: sessionId,
      p_provider_event_id: providerEventId,
    },
  );

  if (error) {
    await logEvent({
      requestId: reqId,
      level: 'WARN',
      event: 'AD_REWARD_FAILED',
      route: ROUTE,
      userId: access.user.id,
      entityType: 'AD_REWARD_SESSION',
      entityId: sessionId,
      statusCode: 400,
      metadata: {
        reason: 'VERIFY_FAILED',
      },
    });

    return NextResponse.json(
      { error: 'Reward tidak dapat diverifikasi' },
      {
        status: 400,
        headers: { 'x-request-id': reqId },
      },
    );
  }

  await logEvent({
    requestId: reqId,
    level: 'INFO',
    event: 'AD_REWARD_VERIFIED',
    route: ROUTE,
    userId: access.user.id,
    entityType: 'AD_REWARD_SESSION',
    entityId: sessionId,
    statusCode: 200,
    metadata: {
      provider: 'DEMO',
      rewardKind: data?.reward_kind,
      rewardAmount: data?.reward_amount,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      wallet: data,
    },
    {
      headers: { 'x-request-id': reqId },
    },
  );
}