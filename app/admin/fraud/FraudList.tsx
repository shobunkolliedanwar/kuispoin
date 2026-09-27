'use client';
import { useMemo, useState } from 'react';

type FraudRow = { id:string; code:string; risk_score:number; severity?:string; detail?:string|null; status:string; created_at:string; evidence?:Record<string,unknown>; users?:{email?:string;name?:string}|null };
export default function FraudList({ rows }: { rows: FraudRow[] }) {
  const [filter,setFilter]=useState('OPEN'); const [msg,setMsg]=useState('');
  const visible=useMemo(()=>rows.filter(r=>filter==='ALL'||r.status===filter),[rows,filter]);
  async function act(id:string,status:'REVIEWED'|'DISMISSED'){
    const r=await fetch(`/api/admin/fraud/${id}/status`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status})});
    setMsg(r.ok?'Status diperbarui. Refresh untuk mengambil snapshot terbaru.':'Gagal memperbarui flag.');
  }
  return <div className="card"><div className="row"><div><h2>Fraud Review V2</h2><p className="muted">Risk score adalah sinyal review, bukan keputusan otomatis untuk ban akun.</p></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>OPEN</option><option>REVIEWED</option><option>DISMISSED</option><option>ALL</option></select></div>{msg&&<p>{msg}</p>}{visible.length===0?<p className="muted">Tidak ada flag pada filter ini.</p>:visible.map(r=><div className="row" key={r.id}><span><b>{r.code}</b> · {r.severity??'LOW'} · risk {r.risk_score}/10<br/><small>{r.users?.email??'-'} · {r.detail||'-'} · {new Date(r.created_at).toLocaleString('id-ID')}</small>{r.evidence&&Object.keys(r.evidence).length>0&&<><br/><small className="muted">Signals: {Array.isArray(r.evidence.signals)?r.evidence.signals.join(', '):'-'}</small></>}</span><span>{r.status==='OPEN'?<><button onClick={()=>act(r.id,'REVIEWED')}>Reviewed</button> <button onClick={()=>act(r.id,'DISMISSED')}>Dismiss</button></>:<small>{r.status}</small>}</span></div>)}</div>;
}
