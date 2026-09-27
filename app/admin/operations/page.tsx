import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import AdminNav from '../AdminNav';

export default async function OperationsPage(){
  if(!await requireAdmin()) redirect('/dashboard');
  const since24=new Date(Date.now()-24*3600_000).toISOString(); const sinceHour=new Date(Date.now()-3600_000).toISOString();
  const [{data:events},{count:errors24},{count:warns24},{count:recentErrors},{error:dbError}]=await Promise.all([
    supabaseAdmin.from('operational_events').select('id,request_id,level,event,route,status_code,duration_ms,created_at').order('created_at',{ascending:false}).limit(100),
    supabaseAdmin.from('operational_events').select('id',{count:'exact',head:true}).eq('level','ERROR').gte('created_at',since24),
    supabaseAdmin.from('operational_events').select('id',{count:'exact',head:true}).eq('level','WARN').gte('created_at',since24),
    supabaseAdmin.from('operational_events').select('id',{count:'exact',head:true}).eq('level','ERROR').gte('created_at',sinceHour),
    supabaseAdmin.from('users').select('id',{head:true,count:'exact'}).limit(1),
  ]);
  const rows=events??[]; const durations=rows.map(x=>x.duration_ms).filter((x):x is number=>typeof x==='number').sort((a,b)=>a-b); const p95=durations.length?durations[Math.min(durations.length-1,Math.floor(durations.length*.95))]:0;
  return <main className="adminShell"><AdminNav/><section className="adminMain"><div className="adminHeader"><div><p className="eyebrow">OBSERVABILITY</p><h1>Operations</h1><p className="muted">Health dan event operasional terbaru. Metadata sensitif di-redact sebelum disimpan.</p></div></div><div className="metricGrid"><div className="metricCard"><span>Database</span><b className={dbError?'danger':'success'}>{dbError?'DOWN':'UP'}</b></div><div className="metricCard"><span>Errors · 24h</span><b>{errors24??0}</b></div><div className="metricCard"><span>Warnings · 24h</span><b>{warns24??0}</b></div><div className="metricCard"><span>Recent p95*</span><b>{p95} ms</b></div></div>{(recentErrors??0)>0&&<div className="card"><b className="danger">Perhatian: {recentErrors} error dalam 1 jam terakhir</b><p className="muted">Periksa event terbaru dan request ID untuk korelasi log.</p></div>}<div className="card adminTableCard"><div className="tableToolbar"><div><h3>Operational events</h3><p className="muted">100 event terakhir · *p95 dihitung dari snapshot ini.</p></div></div><div className="tableScroll"><table className="adminTable"><thead><tr><th>Time</th><th>Level</th><th>Event</th><th>Route</th><th>Status</th><th>Latency</th><th>Request ID</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString('id-ID')}</td><td><span className={`statusBadge obs-${String(r.level).toLowerCase()}`}>{r.level}</span></td><td><b>{r.event}</b></td><td>{r.route??'-'}</td><td>{r.status_code??'-'}</td><td>{r.duration_ms==null?'-':`${r.duration_ms} ms`}</td><td><code>{r.request_id?.slice(0,16)??'-'}</code></td></tr>)}</tbody></table>{!rows.length&&<div className="emptyState"><b>Belum ada event</b><p className="muted">Event akan muncul setelah API sensitif digunakan.</p></div>}</div></div></section></main>;
}
