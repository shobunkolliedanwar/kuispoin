import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { defaultAdsConfig } from '@/lib/ads';
import AdminNav from '../AdminNav';
import SettingsForm from './SettingsForm';

export default async function Page(){
  if(!await requireAdmin()) redirect('/dashboard');
  const [{data:rewardData},{data:adsData}]=await Promise.all([
    supabaseAdmin.from('app_settings').select('value').eq('key','reward_config').single(),
    supabaseAdmin.from('app_settings').select('value').eq('key','ads_config').maybeSingle(),
  ]);
  const rewardConfig=rewardData?.value??{min_withdraw_points:1000,points_per_rupiah:1,min_correct_for_withdraw:5,daily_quiz_reward_cap:500};
  const adsConfig=adsData?.value??defaultAdsConfig;
  return <main className="adminShell"><AdminNav/><section className="adminMain"><div className="adminHeader"><div><p className="eyebrow">ECONOMY</p><h1>Reward Settings</h1><p className="muted">Atur ekonomi redeemable dan reward iklan non-tunai secara terpisah.</p></div></div><SettingsForm config={rewardConfig} adsConfig={adsConfig}/></section></main>
}
