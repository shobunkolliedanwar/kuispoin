import Link from 'next/link';
export default function AdminNav(){
  return <nav className="adminNav">
    <div className="adminBrand"><span>KP</span><div><b>KuisPoin</b><small>Admin Console</small></div></div>
    <div className="adminLinks">
      <Link href="/admin">▦ Overview</Link><Link href="/admin/quizzes">❓ Quiz CMS</Link><Link href="/admin/users">👥 Users</Link><Link href="/admin/withdrawals">💸 Withdrawals</Link><Link href="/admin/fraud">🛡 Fraud</Link><Link href="/admin/referrals">🔗 Referrals</Link><Link href="/admin/analytics">📊 Analytics</Link><Link href="/admin/operations">🩺 Operations</Link><Link href="/admin/settings">⚙ Reward Settings</Link>
    </div>
    <Link className="adminBack" href="/dashboard">← Kembali ke KuisPoin</Link>
  </nav>
}
