import { NextResponse } from 'next/server';

import { requireActiveUser } from '@/lib/access';
import { getAdsConfig, rewardedProvider } from '@/lib/ads';
import { logEvent, requestId } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ROUTE = '/api/ads/rewarded/session';

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

  const config = await getAdsConfig();
  const provider = rewardedProvider();

  if (!config.rewarded_enabled || provider === 'DISABLED') {
    return NextResponse.json(
      { error: 'Rewarded ads belum tersedia' },
      {
        status: 503,
        headers: { 'x-request-id': reqId },
      },
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    'create_ad_reward_session',
    {
      p_user: access.user.id,
      p_provider: provider,
      p_reward_kind: config.reward_kind,
      p_reward_amount: config.reward_amount,
      p_daily_cap: config.daily_rewarded_cap,
    },
  );

  if (error) {
    const isDailyCapReached = error.message.includes('DAILY_AD_CAP');
    const statusCode = isDailyCapReached ? 429 : 400;

    await logEvent({
      requestId: reqId,
      level: 'WARN',
      event: 'AD_SESSION_REJECTED',
      route: ROUTE,
      userId: access.user.id,
      statusCode,
      metadata: {
        reason: isDailyCapReached
          ? 'DAILY_AD_CAP'
          : 'CREATE_FAILED',
      },
    });

    return NextResponse.json(
      {
        error: isDailyCapReached
          ? 'Batas rewarded ad hari ini sudah tercapai'
          : 'Gagal membuat sesi iklan',
      },
      {
        status: statusCode,
        headers: { 'x-request-id': reqId },
      },
    );
  }

  await logEvent({
    requestId: reqId,
    level: 'INFO',
    event: 'AD_SESSION_CREATED',
    route: ROUTE,
    userId: access.user.id,
    entityType: 'AD_REWARD_SESSION',
    entityId: String(data),
    statusCode: 200,
    metadata: {
      provider,
      rewardKind: config.reward_kind,
      rewardAmount: config.reward_amount,
    },
  });

  return NextResponse.json(
    {
      sessionId: data,
      provider,
      rewardKind: config.reward_kind,
      rewardAmount: config.reward_amount,
      demo: provider === 'DEMO',
    },
    {
      headers: { 'x-request-id': reqId },
    },
  );
}