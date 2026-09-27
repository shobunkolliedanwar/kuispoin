import Link from 'next/link';

export default function PublicFooter() {
  return <footer className="publicFooter">
    <div><b>KuisPoin</b><p>Platform kuis dan reward yang mengutamakan pengalaman yang jelas dan transparan.</p></div>
    <div className="footerLinks">
      <Link href="/how-it-works">Cara Kerja</Link><Link href="/faq">FAQ</Link><Link href="/about">Tentang</Link>
      <Link href="/privacy">Privasi</Link><Link href="/terms">Syarat & Ketentuan</Link>
    </div>
    <small>© {new Date().getFullYear()} KuisPoin.</small>
  </footer>;
}
