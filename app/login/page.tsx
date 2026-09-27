import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import LoginButton from '@/components/LoginButton';
import { authOptions } from '@/lib/auth';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect(session.user.role === 'ADMIN' ? '/admin' : '/dashboard');
  }

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="brandLogo">K</div>
        <h1>KuisPoin</h1>
        <p className="muted">Main kuis, kumpulkan poin, dan raih reward.</p>
        <LoginButton />
        <p className="loginNote">Kami hanya menggunakan identitas dasar akun Google untuk login. KuisPoin tidak meminta akses membaca Gmail kamu.</p>
        <p className="loginTerms">Dengan melanjutkan, kamu menyetujui Syarat & Ketentuan dan Kebijakan Privasi KuisPoin.</p>
      </section>
    </main>
  );
}
