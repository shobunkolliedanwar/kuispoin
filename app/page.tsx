import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';

export default function HomePage() {
  return <div className="publicPage">
    <PublicHeader />
    <main>
      <section className="publicHero">
        <span className="publicEyebrow">KUIS • POIN • REWARD</span>
        <h1>Jawab kuis, kumpulkan poin, dan nikmati progresmu.</h1>
        <p>KuisPoin adalah platform kuis yang memberi reward berdasarkan aktivitas yang memenuhi ketentuan. Nilai poin dan aturan penarikan ditampilkan secara transparan di aplikasi.</p>
        <div className="publicActions"><Link className="btn publicBtn" href="/login">Mulai dengan Google</Link><Link className="btn secondary publicBtn" href="/how-it-works">Lihat cara kerja</Link></div>
      </section>
      <section className="publicSection"><h2>Yang bisa kamu lakukan</h2><div className="publicGrid">
        <article><b>🧠 Main kuis</b><p>Jawab pertanyaan dari bank soal dan lihat hasil setelah menyelesaikan sesi.</p></article>
        <article><b>⭐ Kumpulkan poin</b><p>Poin redeemable berasal dari aktivitas yang memenuhi aturan reward, bukan dari klik iklan.</p></article>
        <article><b>🎯 Selesaikan misi</b><p>Ikuti misi harian dan pantau progres langsung dari akunmu.</p></article>
        <article><b>💳 Kelola reward</b><p>Lihat saldo, nilai poin, syarat minimum, dan status penarikan dengan jelas.</p></article>
      </div></section>
      <section className="publicSection publicNotice"><h2>Iklan & reward</h2><p>KuisPoin dapat menampilkan iklan untuk mendukung operasional layanan. Klik iklan tidak memberikan poin. Rewarded ad, jika tersedia, hanya memberikan reward non-tunai seperti tiket dan tidak dapat langsung dicairkan menjadi rupiah.</p></section>
    </main>
    <PublicFooter />
  </div>;
}
