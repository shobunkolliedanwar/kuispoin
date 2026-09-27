import { afterAll, describe, expect, it } from 'vitest';
import {adminClient,cleanupUser,createAttempt,createQuizFixture,createTestUser,deleteQuizFixture,integrationEnabled} from './helpers';
const describeMoney=integrationEnabled()?describe:describe.skip;
describeMoney('Supabase money-safety integration',()=>{
 const db=integrationEnabled()?adminClient():null;const users:string[]=[],quizzes:string[]=[];
 afterAll(async()=>{for(const u of users)await cleanupUser(db!,u);for(const q of quizzes)await deleteQuizFixture(db!,q)});
 it('100 concurrent finishes grant exactly one quiz reward',async()=>{
  const userId=await createTestUser(db!,'quiz-race');users.push(userId);const f=await createQuizFixture(db!,5);quizzes.push(f.quizId);const attemptId=await createAttempt(db!,userId,f.quizId,f.answers);
  const calls=await Promise.all(Array.from({length:100},()=>db!.rpc('finish_quiz_atomic',{p_user:userId,p_attempt:attemptId,p_answers:f.answers})));
  expect(calls.filter(x=>!x.error)).toHaveLength(1);
  const {data:txs,error:te}=await db!.from('point_transactions').select('id,amount,type,reference_id').eq('user_id',userId).eq('type','QUIZ_REWARD').eq('reference_id',attemptId);if(te)throw te;
  expect(txs).toHaveLength(1);expect(txs?.[0]?.amount).toBe(5);
  const {data:a,error:ae}=await db!.from('quiz_attempts').select('status,score,reward_points').eq('id',attemptId).single();if(ae)throw ae;
  expect(a.status).toBe('COMPLETED');expect(a.score).toBe(5);expect(a.reward_points).toBe(5);
 },60000);
 it('100 concurrent withdrawals cannot overspend a 1000 point balance',async()=>{
  const userId=await createTestUser(db!,'withdraw-race');users.push(userId);const f=await createQuizFixture(db!,5);quizzes.push(f.quizId);const attemptId=await createAttempt(db!,userId,f.quizId,f.answers);
  const {error:ae}=await db!.from('quiz_answers').insert(f.answers.map(x=>({attempt_id:attemptId,question_id:x.questionId,selected_option_id:x.optionId,is_correct:true})));if(ae)throw ae;
  const {error:se}=await db!.from('point_transactions').insert({user_id:userId,amount:1000,type:'ADJUSTMENT',description:'integration opening balance'});if(se)throw se;
  const calls=await Promise.all(Array.from({length:100},(_,i)=>db!.rpc('create_withdrawal_atomic',{p_user:userId,p_points:1000,p_method:'DANA',p_account:`08123456${String(i).padStart(4,'0')}`,p_name:'Integration Test'})));
  expect(calls.filter(x=>!x.error)).toHaveLength(1);
  const {data:w,error:we}=await db!.from('withdrawals').select('id,points,status').eq('user_id',userId);if(we)throw we;expect(w).toHaveLength(1);expect(w?.[0]?.points).toBe(1000);
  const {data:l,error:le}=await db!.from('point_transactions').select('amount,type').eq('user_id',userId);if(le)throw le;
  const balance=(l??[]).reduce((s,r)=>s+Number(r.amount),0),held=Math.abs((l??[]).filter(r=>r.type==='WITHDRAWAL').reduce((s,r)=>s+Number(r.amount),0));
  expect(balance).toBe(0);expect(balance).toBeGreaterThanOrEqual(0);expect(held).toBe(1000);
 },60000);
});
