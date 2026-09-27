import { NextResponse } from 'next/server';
import { allowAction } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireActiveUser } from '@/lib/access';
import { parseWithdrawalInput } from '@/lib/withdrawal-input';
import { logEvent, requestId } from '@/lib/observability';

export async function POST(req:Request){
 const started=Date.now(),rid=requestId(req),route='/api/withdrawals';
 const access=await requireActiveUser(); if(!access.ok){await logEvent({event:'WITHDRAWAL_ACCESS_DENIED',level:'WARN',requestId:rid,route,statusCode:access.status,durationMs:Date.now()-started});return NextResponse.json({error:access.error},{status:access.status,headers:{'x-request-id':rid}})}
 const userId=access.user.id;
 if(!await allowAction(`withdraw:${userId}`,3,3600)){await logEvent({event:'WITHDRAWAL_RATE_LIMITED',level:'WARN',requestId:rid,route,userId,statusCode:429,durationMs:Date.now()-started});return NextResponse.json({error:'Batas permintaan withdrawal tercapai. Coba lagi nanti.'},{status:429,headers:{'x-request-id':rid}})}
 const parsed=parseWithdrawalInput(await req.json().catch(()=>null));
 if(!parsed){await logEvent({event:'WITHDRAWAL_INVALID_INPUT',level:'WARN',requestId:rid,route,userId,statusCode:400,durationMs:Date.now()-started});return NextResponse.json({error:'Data withdrawal tidak valid'},{status:400,headers:{'x-request-id':rid}})}
 const {points,method,account,name}=parsed;
 const {data:risk}=await supabaseAdmin.rpc('withdrawal_risk_snapshot',{p_user:userId,p_points:points,p_method:method,p_account:account});
 const score=Number(risk?.score??0);
 if(score>=7){await supabaseAdmin.from('fraud_flags').insert({user_id:userId,code:'WITHDRAWAL_RISK',risk_score:Math.min(score,10),severity:'HIGH',detail:'High-risk withdrawal blocked before payout',evidence:risk});await logEvent({event:'WITHDRAWAL_BLOCKED_RISK',level:'WARN',requestId:rid,route,userId,statusCode:400,durationMs:Date.now()-started,metadata:{points,method,riskScore:score,signals:risk?.signals}});return NextResponse.json({error:'Withdrawal ditahan karena akun perlu review admin'},{status:400,headers:{'x-request-id':rid}})}
 const {data,error}=await supabaseAdmin.rpc('create_withdrawal_atomic',{p_user:userId,p_points:points,p_method:method,p_account:account,p_name:name||null});
 if(error){const m=error.message;const msg=m.includes('INSUFFICIENT')?'Poin tidak cukup':m.includes('MIN_WITHDRAWAL')?'Belum mencapai minimum withdrawal':m.includes('MIN_CORRECT')?'Selesaikan lebih banyak jawaban benar sebelum withdrawal':m.includes('FRAUD_REVIEW')?'Withdrawal ditahan karena akun perlu review admin':m.includes('ACCOUNT_INACTIVE')?'Akun tidak aktif':'Withdrawal gagal';await logEvent({event:'WITHDRAWAL_FAILED',level:'WARN',requestId:rid,route,userId,statusCode:400,durationMs:Date.now()-started,metadata:{points,method,reason:m.split(':')[0]}});return NextResponse.json({error:msg},{status:400,headers:{'x-request-id':rid}})}
 await logEvent({event:'WITHDRAWAL_CREATED',requestId:rid,route,userId,entityType:'WITHDRAWAL',entityId:String(data),statusCode:200,durationMs:Date.now()-started,metadata:{points,method,riskScore:score}});
 return NextResponse.json({ok:true,id:data},{headers:{'x-request-id':rid}});
}
