import './globals.css';
import Providers from '@/components/Providers';
export const metadata={title:'KuisPoin MVP',description:'Kuis, kumpulkan poin, dan redeem reward'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="id"><body><Providers>{children}</Providers></body></html>}
