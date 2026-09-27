'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRupiah, pointsToRupiah } from '@/lib/point-value';

export default function WithdrawForm({ balance, minPoints = 1000, pointsPerRupiah = 1 }: { balance: number; minPoints?: number; pointsPerRupiah?: number }) {
  const [method, setMethod] = useState('DANA');
  const [points, setPoints] = useState(minPoints);
  const [accountNumber, setNumber] = useState('');
  const [accountName, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const r = useRouter();
  const rupiah = pointsToRupiah(points, pointsPerRupiah);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Tarik ${points.toLocaleString('id-ID')} poin (≈ ${formatRupiah(rupiah)}) ke ${method}?`)) return;
    setBusy(true);
    const x = await fetch('/api/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, points, accountNumber, accountName }) });
    const j = await x.json(); setBusy(false);
    if (!x.ok) return alert(j.error);
    setNumber(''); r.refresh();
  }

  return <form className="card" onSubmit={submit}>
    <h3>Request Withdrawal</h3>
    <p className="muted">Nilai poin: <b>{pointsPerRupiah === 1 ? '1 Poin = Rp1' : `${pointsPerRupiah.toLocaleString('id-ID')} Poin = Rp1`}</b>.</p>
    <p className="muted">Minimum {minPoints.toLocaleString('id-ID')} poin = {formatRupiah(pointsToRupiah(minPoints, pointsPerRupiah))}. Payout V1 diproses manual oleh admin.</p>
    <label>Metode</label><select value={method} onChange={e => setMethod(e.target.value)}>{['DANA', 'GOPAY', 'OVO', 'SHOPEEPAY'].map(x => <option key={x}>{x}</option>)}</select>
    <label>Jumlah poin</label><input type="number" min={minPoints} step="500" max={balance} value={points} onChange={e => setPoints(Number(e.target.value))}/>
    <p className="muted">Kamu akan menerima: <b>{formatRupiah(rupiah)}</b></p>
    <label>Nomor e-wallet</label><input required minLength={6} value={accountNumber} onChange={e => setNumber(e.target.value)} placeholder="08xxxxxxxxxx"/>
    <label>Nama pemilik</label><input value={accountName} onChange={e => setName(e.target.value)}/>
    <button className="btn" disabled={busy || balance < minPoints}>{busy ? 'Memproses...' : 'Request Withdrawal'}</button>
  </form>;
}
