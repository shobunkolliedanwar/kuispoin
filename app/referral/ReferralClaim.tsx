'use client';
import { useEffect, useState } from 'react';
export default function ReferralClaim(){
 const [message,setMessage]=useState('Memeriksa referral...');
 useEffect(()=>{fetch('/api/referrals/attribution',{method:'POST'}).then(async r=>{const b=await r.json();if(!r.ok) throw new Error(b.error||'Gagal');setMessage(b.status==='ATTRIBUTED'?'Referral berhasil dicatat. Selesaikan syarat untuk mendapatkan bonus.':b.status==='ALREADY_ATTRIBUTED'?'Referral kamu sudah tercatat.':'Tidak ada referral baru untuk diproses.');}).catch(e=>setMessage(e.message));},[]);
 return <p className="muted" aria-live="polite">{message}</p>;
}
