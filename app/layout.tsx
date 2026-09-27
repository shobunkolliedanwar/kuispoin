import './globals.css';
import Providers from '@/components/Providers';
import { getAdSenseClientId, getAdSenseScriptUrl, isAdSenseEnabled } from '@/lib/adsense';

export const metadata = {
  title: { default: 'KuisPoin', template: '%s | KuisPoin' },
  description: 'Main kuis, kumpulkan poin dari aktivitas yang memenuhi syarat, dan kelola reward di KuisPoin.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const clientId = getAdSenseClientId();
  const adsenseEnabled = isAdSenseEnabled();
  return <html lang="id">
    <head>
      {adsenseEnabled ? <script async src={getAdSenseScriptUrl(clientId)} crossOrigin="anonymous" /> : null}
    </head>
    <body><Providers>{children}</Providers></body>
  </html>;
}
