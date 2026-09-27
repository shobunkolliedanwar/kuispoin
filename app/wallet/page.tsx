import Nav from '@/components/Nav';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatRupiah, normalizePointsPerRupiah, pointsToRupiah } from '@/lib/point-value';
import WithdrawForm from './WithdrawForm';

export default async function Wallet() {
  const s = await getServerSession(authOptions);
  const uid = s?.user?.id;
  const [{ data: allTx }, { data: tx }, { data: wds }, { data: settings }] = uid ? await Promise.all([
    supabaseAdmin.from('point_transactions').select('amount').eq('user_id', uid),
    supabaseAdmin.from('point_transactions').select('id,amount,type,description,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('withdrawals').select('id,points,method,status,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('app_settings').select('value').eq('key', 'reward_config').maybeSingle(),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: null }];
  const config = (settings?.value ?? {}) as { min_withdraw_points?: number; points_per_rupiah?: number };
  const minPoints = Number(config.min_withdraw_points ?? 1000);
  const pointsPerRupiah = normalizePointsPerRupiah(config.points_per_rupiah);
  const balance = (allTx ?? []).reduce((a, x) => a + x.amount, 0);
  return <main className="wrap">
    <header className="top">
      <p>Saldo Poin</p><div className="big">{balance.toLocaleString('id-ID')} Poin</div>
      <p><b>≈ {formatRupiah(pointsToRupiah(balance, pointsPerRupiah))}</b></p>
      <p>{pointsPerRupiah === 1 ? '1 Poin = Rp1' : `${pointsPerRupiah.toLocaleString('id-ID')} Poin = Rp1`}. Poin yang sedang ditahan withdrawal sudah dikurangi dari saldo.</p>
    </header>
    <section className="content">
      <WithdrawForm balance={balance} minPoints={minPoints} pointsPerRupiah={pointsPerRupiah}/>
      <div className="card"><h3>Withdrawal</h3>{(wds ?? []).length ? (wds ?? []).map(x => <p key={x.id}><b>{x.method} • {x.points.toLocaleString('id-ID')} Poin</b> <span className="muted">(≈ {formatRupiah(pointsToRupiah(x.points, pointsPerRupiah))})</span><br/><span className="muted">{x.status}</span></p>) : <p className="muted">Belum ada withdrawal.</p>}</div>
      <div className="card"><h3>Riwayat Poin</h3>{(tx ?? []).map(x => <p key={x.id}><b className={x.amount > 0 ? 'success' : 'warn'}>{x.amount > 0 ? '+' : ''}{x.amount}</b> • {x.description || x.type}</p>)}</div>
    </section><Nav />
  </main>;
}
