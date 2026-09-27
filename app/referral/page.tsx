import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import Nav from '@/components/Nav';
import UserBar from '@/components/UserBar';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensureReferralCode, getReferralConfig, tryQualifyReferral } from '@/lib/referrals';
import ReferralClaim from './ReferralClaim';
import ReferralShare from './ReferralShare';

export default async function ReferralPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const store = await cookies();
    redirect(store.get('kp_referral') ? '/login?callbackUrl=/referral' : '/login');
  }

  const userId = session.user.id;
  await tryQualifyReferral(userId).catch(() => null);
  const [code, config, { data: invites }, { data: mine }] = await Promise.all([
    ensureReferralCode(userId),
    getReferralConfig(),
    supabaseAdmin.from('referrals').select('id,status,attributed_at,qualified_at').eq('referrer_user_id', userId).order('attributed_at', { ascending: false }),
    supabaseAdmin.from('referrals').select('status').eq('referred_user_id', userId).maybeSingle(),
  ]);

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'kuispoin.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const link = `${proto}://${host}/r/${code}`;
  const qualified = (invites ?? []).filter(x => x.status === 'QUALIFIED').length;

  return <main className="wrap referralPage">
    <header className="top referralTop">
      <div className="referralHeaderInner"><p className="referralEyebrow">UNDANG TEMAN</p><h1>Referral</h1><p>Ajak teman bergabung dan dapatkan reward setelah syarat terpenuhi.</p></div>
    </header>

    <section className="content referralContent">
      <UserBar />

      <div className="referralMainGrid">
        <section className="card hero referralIdentityCard">
          <p className="muted referralLabel">Kode referral kamu</p>
          <div className="big referralCode">{code}</div>
          <p className="muted referralLink">{link}</p>
          <ReferralShare code={code} link={link} />
          <p className="referralRewardText">Teman memenuhi syarat: kamu mendapat <b>{config.referrer_reward_points.toLocaleString('id-ID')} poin</b> dan teman mendapat <b>{config.referred_reward_points.toLocaleString('id-ID')} poin</b>.</p>
        </section>

        <ReferralClaim alreadyAttributed={Boolean(mine)} />
      </div>

      <div className="referralStats">
        <div className="card referralStat"><b className="big">{invites?.length ?? 0}</b><p className="muted">Teman terdaftar</p></div>
        <div className="card referralStat"><b className="big">{qualified}</b><p className="muted">Qualified</p></div>
      </div>

      <section className="card referralQualification">
        <div><p className="referralEyebrow">SYARAT REWARD</p><h3>Qualification</h3></div>
        <div className="qualificationList">
          <p><span>✓</span>Akun teman minimal <b>{config.min_account_age_hours} jam</b></p>
          <p><span>✓</span>Menyelesaikan minimal <b>{config.min_completed_quizzes} kuis</b></p>
          <p><span>✓</span>Lolos pemeriksaan referral dan reward hanya diberikan sekali</p>
        </div>
        {mine && <p className="badge">Referral saya: {mine.status}</p>}
      </section>
    </section>
    <Nav />
  </main>;
}
