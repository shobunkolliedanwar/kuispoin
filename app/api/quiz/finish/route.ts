import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireActiveUser } from '@/lib/access';
import { isUuid } from '@/lib/validation';
import { allowAction } from '@/lib/rate-limit';
import { logEvent, requestId } from '@/lib/observability';
import { tryQualifyReferral } from '@/lib/referrals';
type Answer={questionId:string;optionId:string};
export async function POST(req:Request){
 const started=Date.now(),rid=requestId(req),route='/api/quiz/finish';
 const access=await requireActiveUser();if(!access.ok){await logEvent({event:'QUIZ_FINISH_ACCESS_DENIED',level:'WARN',requestId:rid,route,statusCode:access.status,durationMs:Date.now()-started});return NextResponse.json({error:access.error},{status:access.status,headers:{'x-request-id':rid}})}
 const userId=access.user.id;
 if(!await allowAction(`quiz:finish:${userId}`,8,60)){await logEvent({event:'QUIZ_FINISH_RATE_LIMITED',level:'WARN',requestId:rid,route,userId,statusCode:429,durationMs:Date.now()-started});return NextResponse.json({error:'Terlalu banyak request. Coba lagi sebentar.'},{status:429,headers:{'x-request-id':rid}})}
 const b=await req.json().catch(()=>null) as {attemptId?:string;answers?:Answer[]}|null;
 if(!b || !isUuid(b.attemptId) || !Array.isArray(b.answers) || b.answers.length>100){await logEvent({event:'QUIZ_FINISH_INVALID_INPUT',level:'WARN',requestId:rid,route,userId,statusCode:400,durationMs:Date.now()-started});return NextResponse.json({error:'Payload tidak valid'},{status:400,headers:{'x-request-id':rid}})}
 const clean=b.answers.filter(x=>isUuid(x?.questionId)&&isUuid(x?.optionId)).slice(0,100);
 const {data,error}=await supabaseAdmin.rpc('finish_quiz_atomic',{p_user:userId,p_attempt:b.attemptId,p_answers:clean});
 if(error){const m=error.message;const status=m.includes('ALREADY')?409:m.includes('NOT_FOUND')?404:400;await logEvent({event:'QUIZ_FINISH_FAILED',level:status===409?'WARN':'ERROR',requestId:rid,route,userId,entityType:'QUIZ_ATTEMPT',entityId:b.attemptId,statusCode:status,durationMs:Date.now()-started,metadata:{reason:m.split(':')[0],answerCount:clean.length}});return NextResponse.json({error:m.includes('ALREADY')?'Attempt sudah selesai':'Gagal menyelesaikan kuis'},{status,headers:{'x-request-id':rid}})}
 await tryQualifyReferral(userId).catch(()=>null);
 await logEvent({event:'QUIZ_FINISHED',requestId:rid,route,userId,entityType:'QUIZ_ATTEMPT',entityId:b.attemptId,statusCode:200,durationMs:Date.now()-started,metadata:{answerCount:clean.length}});
 return NextResponse.json(data,{headers:{'x-request-id':rid}});
}
