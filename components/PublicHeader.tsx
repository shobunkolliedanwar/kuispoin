import Link from 'next/link';

export default function PublicHeader() {
  return <header className="publicHeader">
    <Link href="/" className="publicBrand">KuisPoin</Link>
    <nav className="publicNav">
      <Link href="/how-it-works">Cara Kerja</Link>
      <Link href="/faq">FAQ</Link>
      <Link href="/about">Tentang</Link>
      <Link href="/login" className="publicLogin">Masuk</Link>
    </nav>
  </header>;
}
