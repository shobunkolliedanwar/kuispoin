import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Nav from '@/components/Nav';
import UserBar from '@/components/UserBar';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getMissionState, getStreak } from '@/lib/rewards';
import { formatRupiah, normalizePointsPerRupiah, pointsToRupiah } from '@/lib/point-value';
import RewardedAdCard from '@/components/RewardedAdCard';
import { getAdsConfig, rewardedProvider } from '@/lib/ads';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const [{ data: transactions }, { data: attempts }, { data: settings }, { data: noncash }, adsConfig, missions, streak] = await Promise.all([
    supabaseAdmin.from('point_transactions').select('amount').eq('user_id', userId),
    supabaseAdmin.from('quiz_attempts').select('id').eq('user_id', userId).eq('status', 'COMPLETED'),
    supabaseAdmin.from('app_settings').select('value').eq('key', 'reward_config').maybeSingle(),
    supabaseAdmin.from('noncash_wallets').select('tickets,hints,xp').eq('user_id', userId).maybeSingle(),
    getAdsConfig(),
    getMissionState(userId),
    getStreak(userId),
  ]);

  const balance = (transactions ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const config = (settings?.value ?? {}) as { points_per_rupiah?: number };
  const pointsPerRupiah = normalizePointsPerRupiah(config.points_per_rupiah);
  const completedMissions = missions.filter((mission) => mission.completed).length;

  return (
    <main className="wrap">
      <header className="top">
        <div className="row"><div><p>Selamat datang</p><h1>KuisPoin</h1></div><span className="pill">🔥 {streak} hari</span></div>
      </header>
      <section className="content">
        <UserBar />
        <div className="card hero">
          <p className="muted">Saldo poin</p>
          <div className="big">{balance.toLocaleString('id-ID')} Poin</div>
          <p><b>≈ {formatRupiah(pointsToRupiah(balance, pointsPerRupiah))}</b></p>
          <p className="muted">{pointsPerRupiah === 1 ? '1 Poin = Rp1' : `${pointsPerRupiah.toLocaleString('id-ID')} Poin = Rp1`} • Jawab kuis dan selesaikan misi untuk mengumpulkan poin.</p>
          <Link className="btn" href="/quiz">Mulai Kuis</Link>
        </div>
        <div className="grid">
          <div className="card"><b className="big">{attempts?.length ?? 0}</b><p className="muted">Kuis selesai</p></div>
          <div className="card"><b className="big">{completedMissions}/{missions.length}</b><p className="muted">Misi hari ini</p></div>
        </div>
        <div className="card"><div className="row"><div><h3>Misi Harian</h3><p className="muted">Selesaikan target harian dan klaim reward.</p></div><Link className="miniBtn" href="/missions">Lihat</Link></div></div>
        <RewardedAdCard enabled={adsConfig.rewarded_enabled && rewardedProvider() !== 'DISABLED'} provider={rewardedProvider()} tickets={Number(noncash?.tickets ?? 0)} dailyCap={adsConfig.daily_rewarded_cap} />
        <div className="ad"><b>DISPLAY AD SLOT</b><br/>Slot iklan biasa. Tidak memberikan poin atau reward karena klik.</div>
      </section><Nav />
    </main>
  );
}
