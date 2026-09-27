import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { allowAction } from '@/lib/rate-limit';
import { requireActiveUser } from '@/lib/access';

export async function POST() {
  const access = await requireActiveUser();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const userId = access.user.id;
  if (!await allowAction(`quiz:start:${userId}`, 8, 60)) return NextResponse.json({ error: 'Terlalu banyak memulai kuis. Coba lagi sebentar.' }, { status: 429 });

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from('quizzes').select('id,title,reward_per_correct').eq('is_active', true).order('created_at').limit(1).single();
  if (quizError || !quiz) return NextResponse.json({ error: 'Belum ada kuis aktif. Jalankan database/seed.sql.' }, { status: 404 });

  const { data: allQuestions, error: qError } = await supabaseAdmin
    .from('questions').select('id,question_text,position,question_options(id,option_text,position)')
    .eq('quiz_id', quiz.id);
  const questions = [...(allQuestions ?? [])].sort(() => Math.random() - 0.5).slice(0, 10);
  if (qError || !questions?.length) return NextResponse.json({ error: 'Soal belum tersedia.' }, { status: 404 });

  const { data: attempt, error: attemptError } = await supabaseAdmin.from('quiz_attempts').insert({
    user_id: userId, quiz_id: quiz.id, total_questions: questions.length,
  }).select('id').single();
  if (attemptError || !attempt) return NextResponse.json({ error: attemptError?.message ?? 'Gagal membuat attempt' }, { status: 500 });

  const snapshots = questions.map((q, index) => ({ attempt_id: attempt.id, question_id: q.id, position: index + 1 }));
  const { error: snapshotError } = await supabaseAdmin.from('quiz_attempt_questions').insert(snapshots);
  if (snapshotError) return NextResponse.json({ error: snapshotError.message }, { status: 500 });

  return NextResponse.json({
    attemptId: attempt.id,
    quiz: { id: quiz.id, title: quiz.title },
    questions: questions.map(q => ({
      id: q.id, text: q.question_text,
      options: [...(q.question_options ?? [])].sort(() => Math.random() - 0.5).map((o:any)=>({ id:o.id, text:o.option_text })),
    })),
  });
}
