import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildEconomySnapshot } from '@/lib/economics';
import { formatRupiah } from '@/lib/point-value';
import AdminNav from '../AdminNav';

export default async function Analytics() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard');
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const [attemptRes, tx7Res, economyRes, withdrawal7Res, referral7Res, rewardSettingRes] = await Promise.all([
    supabaseAdmin.from('quiz_attempts').select('user_id,score,total_questions,reward_points').eq('status', 'COMPLETED').gte('completed_at', since),
    supabaseAdmin.from('point_transactions').select('amount,type').gte('created_at', since),
    supabaseAdmin.rpc('economy_snapshot'),
    supabaseAdmin.from('withdrawals').select('points,status').gte('created_at', since),
    supabaseAdmin.from('referrals').select('status,attributed_at,qualified_at').gte('attributed_at', since),
    supabaseAdmin.from('app_settings').select('value').eq('key', 'reward_config').maybeSingle(),
  ]);

  const attempts = attemptRes.data ?? [];
  const tx7 = tx7Res.data ?? [];
  const withdrawals7 = withdrawal7Res.data ?? [];
  const referrals7 = referral7Res.data ?? [];
  const totalQuestions = attempts.reduce((a, x) => a + x.total_questions, 0);
  const correct = attempts.reduce((a, x) => a + x.score, 0);
  const activeUsers = new Set(attempts.map(x => x.user_id)).size;
  const issued7 = tx7.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const quizReward7 = tx7.filter(x => x.type === 'QUIZ_REWARD' && x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const missionReward7 = tx7.filter(x => x.type === 'MISSION_REWARD' && x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const referralReward7 = tx7.filter(x => x.type === 'REFERRAL_REWARD' && x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const paid7 = withdrawals7.filter(x => x.status === 'PAID').reduce((a, x) => a + x.points, 0);
  const pendingWithdrawal7 = withdrawals7.filter(x => x.status === 'PENDING' || x.status === 'APPROVED').reduce((a, x) => a + x.points, 0);
  const qualifiedReferrals = referrals7.filter(x => x.status === 'QUALIFIED').length;
  const pointsPerRupiah = Number((rewardSettingRes.data?.value as { points_per_rupiah?: number } | null)?.points_per_rupiah ?? 1);
  const rawEconomy = (economyRes.data ?? {}) as { issued_points?: number; spent_points?: number; outstanding_points?: number; paid_withdrawal_points?: number };
  const economy = buildEconomySnapshot([Number(rawEconomy.issued_points ?? 0), -Number(rawEconomy.spent_points ?? 0)], Number(rawEconomy.paid_withdrawal_points ?? 0), pointsPerRupiah);
  // PostgreSQL is authoritative for the net ledger balance; preserve it even if future ledger types are added.
  economy.outstandingPoints = Number(rawEconomy.outstanding_points ?? economy.outstandingPoints);
  economy.outstandingRupiah = economy.outstandingPoints / economy.pointsPerRupiah;

  const metric = (value: string | number, label: string) => <div className="metricCard"><span>{label}</span><b>{value}</b></div>;
  return <main className="adminShell"><AdminNav/><section className="adminMain">
    <div className="adminHeader"><div><p className="eyebrow">PRODUCT & ECONOMY</p><h1>Analytics</h1><p className="muted">Snapshot 7 hari + exposure ekonomi sepanjang waktu. Revenue iklan belum dihitung sampai data provider tersedia.</p></div></div>

    <div className="card"><h2>Product — 7 hari</h2><div className="metricGrid">
      {metric(attempts.length, 'Quiz selesai')}{metric(activeUsers, 'Quiz active users')}{metric(`${totalQuestions ? Math.round(correct / totalQuestions * 100) : 0}%`, 'Akurasi')}{metric(referrals7.length, 'Referral attributed')}{metric(qualifiedReferrals, 'Referral qualified')}{metric(`${referrals7.length ? Math.round(qualifiedReferrals / referrals7.length * 100) : 0}%`, 'Referral conversion')}
    </div></div>

    <div className="card"><h2>Reward issuance — 7 hari</h2><div className="metricGrid">
      {metric(issued7.toLocaleString('id-ID'), 'Total poin diterbitkan')}{metric(quizReward7.toLocaleString('id-ID'), 'Quiz reward')}{metric(missionReward7.toLocaleString('id-ID'), 'Mission reward')}{metric(referralReward7.toLocaleString('id-ID'), 'Referral reward')}{metric(paid7.toLocaleString('id-ID'), 'Withdrawal PAID')}{metric(pendingWithdrawal7.toLocaleString('id-ID'), 'Withdrawal pending/approved')}
    </div></div>

    <div className="card"><h2>Economy exposure — all time</h2><p className="muted">Dengan konfigurasi {economy.pointsPerRupiah.toLocaleString('id-ID')} poin = Rp1. Nilai di bawah adalah exposure poin, bukan laba/rugi perusahaan.</p><div className="metricGrid">
      {metric(economy.issuedPoints.toLocaleString('id-ID'), 'Poin pernah diterbitkan')}{metric(economy.spentPoints.toLocaleString('id-ID'), 'Poin terpakai/ditahan')}{metric(economy.outstandingPoints.toLocaleString('id-ID'), 'Net poin outstanding')}{metric(formatRupiah(economy.outstandingRupiah), 'Nilai nominal outstanding')}{metric(economy.paidWithdrawalPoints.toLocaleString('id-ID'), 'Poin payout PAID')}{metric(formatRupiah(economy.paidWithdrawalRupiah), 'Nominal payout PAID')}
    </div></div>

    <div className="card"><h3>Unit economics status</h3><p className="muted">KuisPoin belum memiliki data revenue iklan yang tervalidasi dari provider, jadi dashboard sengaja tidak menghitung profit, ARPU, atau break-even palsu. Setelah AdSense/provider menyediakan data revenue yang dapat dipercaya, revenue dapat dibandingkan dengan payout dan outstanding reward di milestone berikutnya.</p></div>
  </section></main>;
}
