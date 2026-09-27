'use client';
import { useState } from 'react';

type Props={enabled:boolean;provider:string;tickets:number;dailyCap:number};
export default function RewardedAdCard({enabled,provider,tickets,dailyCap}:Props){
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[walletTickets,setWalletTickets]=useState(tickets);
 async function watch(){setBusy(true);setMsg('');try{const s=await fetch('/api/ads/rewarded/session',{method:'POST'});const sj=await s.json();if(!s.ok)throw new Error(sj.error||'Gagal memulai iklan');if(!sj.demo){setMsg('Sesi iklan siap. Adapter provider production belum diaktifkan.');return}setMsg('Demo rewarded video berjalan…');await new Promise(r=>setTimeout(r,1800));const v=await fetch('/api/ads/rewarded/demo-complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sj.sessionId})});const vj=await v.json();if(!v.ok)throw new Error(vj.error||'Reward gagal diverifikasi');setWalletTickets(Number(vj.wallet?.tickets??walletTickets));setMsg(`Berhasil! +${sj.rewardAmount} tiket non-tunai.`)}catch(e){setMsg(e instanceof Error?e.message:'Terjadi kesalahan')}finally{setBusy(false)}}
 return <div className="card rewardedCard"><div className="row"><div><p className="eyebrow">REWARDED VIDEO</p><h3>🎟️ Tiket Bonus</h3></div><span className="badge">{walletTickets} tiket</span></div><p className="muted">Tonton video opsional untuk mendapat tiket non-tunai. Tiket tidak dapat dicairkan menjadi rupiah.</p><p className="muted">Batas: {dailyCap} sesi/hari.</p><button className="btn secondary" disabled={!enabled||busy} onClick={watch}>{busy?'Memproses…':enabled?(provider==='DEMO'?'Coba Rewarded Ad (Demo)':'Tonton Video'):'Belum tersedia'}</button>{msg&&<p className="adMessage">{msg}</p>}</div>
}
