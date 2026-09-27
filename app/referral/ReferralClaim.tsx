'use client';
import { useEffect, useState } from 'react';

type Result = { status?: string; error?: string };

export default function ReferralClaim({ alreadyAttributed = false }: { alreadyAttributed?: boolean }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(alreadyAttributed ? 'Kode referral sudah terhubung ke akun kamu.' : 'Memeriksa referral dari link...');
  const [locked, setLocked] = useState(alreadyAttributed);
  const [busy, setBusy] = useState(false);

  async function attribute(manualCode?: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/referrals/attribution', {
        method: 'POST',
        headers: manualCode ? { 'content-type': 'application/json' } : undefined,
        body: manualCode ? JSON.stringify({ code: manualCode }) : undefined,
      });
      const body = await response.json() as Result;
      if (!response.ok) throw new Error(body.error || 'Gagal memproses kode referral.');
      if (body.status === 'ATTRIBUTED') {
        setMessage('Kode referral berhasil digunakan. Selesaikan syarat untuk mendapatkan bonus.');
        setLocked(true);
      } else if (body.status === 'ALREADY_ATTRIBUTED') {
        setMessage('Kode referral sudah terhubung ke akun kamu dan tidak dapat diganti.');
        setLocked(true);
      } else if (body.status === 'NO_CODE') {
        setMessage('Punya kode referral? Masukkan kode di bawah.');
      } else {
        setMessage('Referral diproses.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memproses kode referral.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!alreadyAttributed) void attribute();
  }, [alreadyAttributed]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{8,16}$/.test(normalized)) {
      setMessage('Format kode referral tidak valid.');
      return;
    }
    await attribute(normalized);
  }

  return <div className="card stack">
    <div><h3>Punya kode referral?</h3><p className="muted">Masukkan kode teman jika kamu tidak membuka KuisPoin dari link referral.</p></div>
    <form className="referralClaimForm" onSubmit={submit}>
      <input aria-label="Kode referral" name="code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Contoh: KP12AB34CD" maxLength={16} autoComplete="off" disabled={locked || busy}/>
      <button className="btn" type="submit" disabled={locked || busy || !code.trim()}>{busy ? 'Memproses...' : locked ? 'Sudah digunakan' : 'Gunakan Kode'}</button>
    </form>
    <p className="muted" aria-live="polite">{message}</p>
  </div>;
}
