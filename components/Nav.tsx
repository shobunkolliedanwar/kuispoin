import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/dashboard">🏠<br />Home</Link>
      <Link href="/missions">🎯<br />Misi</Link>
      <Link href="/quiz">🧠<br />Kuis</Link>
      <Link href="/wallet">👛<br />Wallet</Link>
      <Link href="/notifications">🔔<br />Notif</Link>
    </nav>
  );
}
