import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/access';
import { getAdsConfig, getAdRewardUsage, isDemoRewardedProvider } from '@/lib/ads';
import { logEvent, requestId } from '@/lib/observability';
import { allowAction } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ROUTE = '/api/ads/rewarded/demo-complete';
export async function POST(req: Request) {
  const started=Date.now(); const reqId=requestId(req); const access=await requireActiveUser();
  if(!access.ok) return NextResponse.json({error:access.error},{status:access.status,headers:{'x-request-id':reqId}});
  if(!isDemoRewardedProvider()) return NextResponse.json({error:'Demo provider tidak aktif'},{status:404,headers:{'x-request-id':reqId}});
  if(!await allowAction(`ads:complete:${access.user.id}`,10,60)) return NextResponse.json({error:'Terlalu banyak percobaan. Coba lagi sebentar.'},{status:429,headers:{'x-request-id':reqId}});

  const body=await req.json().catch(()=>null); const sessionId=String(body?.sessionId??'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return NextResponse.json({error:'Session tidak valid'},{status:400,headers:{'x-request-id':reqId}});

  const providerEventId=`demo_${randomUUID()}`;
  const {data,error}=await supabaseAdmin.rpc('verify_ad_reward_atomic_v2',{p_user:access.user.id,p_session:sessionId,p_provider:'DEMO',p_provider_event_id:providerEventId});
  if(error){await logEvent({requestId:reqId,level:'WARN',event:'AD_REWARD_FAILED',route:ROUTE,userId:access.user.id,entityType:'AD_REWARD_SESSION',entityId:sessionId,statusCode:400,durationMs:Date.now()-started,metadata:{reason:'VERIFY_FAILED'}});return NextResponse.json({error:'Reward tidak dapat diverifikasi'},{status:400,headers:{'x-request-id':reqId}})}
  const config=await getAdsConfig(); const usage=await getAdRewardUsage(access.user.id,config.daily_rewarded_cap);
  await logEvent({requestId:reqId,level:'INFO',event:'AD_REWARD_VERIFIED',route:ROUTE,userId:access.user.id,entityType:'AD_REWARD_SESSION',entityId:sessionId,statusCode:200,durationMs:Date.now()-started,metadata:{provider:'DEMO',rewardKind:data?.reward_kind,rewardAmount:data?.reward_amount,alreadyVerified:data?.already_verified===true}});
  return NextResponse.json({ok:true,wallet:data,usage},{headers:{'x-request-id':reqId,'cache-control':'no-store'}});
}
