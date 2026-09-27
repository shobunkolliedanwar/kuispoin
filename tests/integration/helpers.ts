import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export function integrationEnabled() { return process.env.ALLOW_MONEY_SAFETY_TESTS === 'true'; }
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase integration env belum lengkap');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function createTestUser(db: SupabaseClient, label: string) {
  const id = randomUUID(), token = `${label}-${id}`;
  const { error } = await db.from('users').insert({id,google_account_id:token,email:`${token}@example.invalid`,name:`Integration ${label}`,role:'USER',status:'ACTIVE'});
  if (error) throw error; return id;
}
export async function cleanupUser(db: SupabaseClient, userId: string) {
  await db.from('notifications').delete().eq('user_id',userId);
  await db.from('fraud_flags').delete().eq('user_id',userId);
  await db.from('mission_claims').delete().eq('user_id',userId);
  await db.from('point_transactions').delete().eq('user_id',userId);
  await db.from('withdrawals').delete().eq('user_id',userId);
  await db.from('quiz_attempts').delete().eq('user_id',userId);
  await db.from('users').delete().eq('id',userId);
}
export async function createQuizFixture(db: SupabaseClient, count=5) {
  const slug=`integration-${randomUUID()}`;
  const {data:quiz,error:qe}=await db.from('quizzes').insert({title:'Integration Test Quiz',slug,description:'temporary automated fixture',reward_per_correct:1,is_active:false}).select('id').single();
  if(qe||!quiz) throw qe??new Error('quiz fixture failed');
  const answers:Array<{questionId:string;optionId:string}>=[];
  for(let i=0;i<count;i++){
    const {data:q,error:qerr}=await db.from('questions').insert({quiz_id:quiz.id,question_text:`Integration question ${i+1}`,position:i+1}).select('id').single();
    if(qerr||!q) throw qerr??new Error('question fixture failed');
    const {data:o,error:oerr}=await db.from('question_options').insert({question_id:q.id,option_text:'Correct',is_correct:true,position:1}).select('id').single();
    if(oerr||!o) throw oerr??new Error('option fixture failed');
    answers.push({questionId:q.id,optionId:o.id});
  }
  return {quizId:quiz.id as string,answers};
}
export async function deleteQuizFixture(db:SupabaseClient,quizId:string){await db.from('quizzes').delete().eq('id',quizId)}
export async function createAttempt(db:SupabaseClient,userId:string,quizId:string,answers:Array<{questionId:string;optionId:string}>){
  const {data:a,error}=await db.from('quiz_attempts').insert({user_id:userId,quiz_id:quizId,total_questions:answers.length}).select('id').single();
  if(error||!a) throw error??new Error('attempt fixture failed');
  const {error:se}=await db.from('quiz_attempt_questions').insert(answers.map((x,i)=>({attempt_id:a.id,question_id:x.questionId,position:i+1})));
  if(se) throw se; return a.id as string;
}
