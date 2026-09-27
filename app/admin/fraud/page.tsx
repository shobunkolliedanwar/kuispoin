import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import AdminNav from '../AdminNav';
import FraudList from './FraudList';
export default async function Page(){
  if(!await requireAdmin()) redirect('/dashboard');
  const {data}=await supabaseAdmin.from('fraud_flags').select('*,users(email,name)').order('risk_score',{ascending:false}).order('created_at',{ascending:false}).limit(200);
  const rows=data??[]; const open=rows.filter(x=>x.status==='OPEN'); const high=open.filter(x=>x.risk_score>=7).length; const medium=open.filter(x=>x.risk_score>=4&&x.risk_score<7).length;
  return <main className="adminShell"><AdminNav/><section className="adminMain"><div className="adminHeader"><div><p className="eyebrow">RISK ENGINE V2</p><h1>Fraud Review</h1><p className="muted">Prioritaskan payout berisiko tinggi untuk review manual.</p></div></div><div className="metricGrid"><div className="metricCard"><span>Open flags</span><b>{open.length}</b></div><div className="metricCard"><span>High risk</span><b>{high}</b></div><div className="metricCard"><span>Medium risk</span><b>{medium}</b></div><div className="metricCard"><span>Total snapshot</span><b>{rows.length}</b></div></div><FraudList rows={rows}/></section></main>;
}
