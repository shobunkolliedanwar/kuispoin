import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import Nav from '@/components/Nav';
import UserBar from '@/components/UserBar';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensureReferralCode, getReferralConfig, tryQualifyReferral } from '@/lib/referrals';
import ReferralClaim from './ReferralClaim';

export default async function ReferralPage(){
 const session=await getServerSession(authOptions); if(!session?.user?.id){const store=await cookies();redirect(store.get('kp_referral')?'/login?callbackUrl=/referral':'/login');}
 const userId=session.user.id; await tryQualifyReferral(userId).catch(()=>null);
 const [code,config,{data:invites},{data:mine}]=await Promise.all([
  ensureReferralCode(userId), getReferralConfig(),
  supabaseAdmin.from('referrals').select('id,status,attributed_at,qualified_at').eq('referrer_user_id',userId).order('attributed_at',{ascending:false}),
  supabaseAdmin.from('referrals').select('status').eq('referred_user_id',userId).maybeSingle(),
 ]);
 const h=await headers(); const host=h.get('x-forwarded-host')??h.get('host')??'kuispoin.vercel.app'; const proto=h.get('x-forwarded-proto')??(host.includes('localhost')?'http':'https'); const link=`${proto}://${host}/r/${code}`;
 const qualified=(invites??[]).filter(x=>x.status==='QUALIFIED').length;
 return <main className="wrap"><header className="top"><div><p>Undang teman</p><h1>Referral</h1></div></header><section className="content"><UserBar/><ReferralClaim alreadyAttributed={Boolean(mine)}/><div className="card hero"><p className="muted">Kode referral kamu</p><div className="big referralCode">{code}</div><p className="muted referralLink">{link}</p><p>Teman yang memenuhi syarat memberi kamu <b>{config.referrer_reward_points.toLocaleString('id-ID')} poin</b>, dan teman mendapat <b>{config.referred_reward_points.toLocaleString('id-ID')} poin</b>.</p></div><div className="grid"><div className="card"><b className="big">{invites?.length??0}</b><p className="muted">Terdaftar</p></div><div className="card"><b className="big">{qualified}</b><p className="muted">Qualified</p></div></div><div className="card"><h3>Syarat qualification</h3><p className="muted">Akun teman minimal {config.min_account_age_hours} jam dan menyelesaikan minimal {config.min_completed_quizzes} kuis. Reward hanya diberikan sekali setelah verifikasi syarat.</p>{mine&&<p className="badge">Referral saya: {mine.status}</p>}</div><div className="card"><h3>Bagikan link</h3><p className="muted">Salin link di atas dan kirim ke teman. Self-referral dan referral berulang tidak diperbolehkan.</p><Link className="btn secondary" href="/dashboard">Kembali ke Dashboard</Link></div></section><Nav/></main>;
}
