const DEFAULT_CLIENT_ID = 'ca-pub-3192016222321677';

export function getAdSenseClientId() {
  return (process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID || DEFAULT_CLIENT_ID).trim();
}

export function isAdSenseEnabled() {
  return process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ADSENSE_ENABLED !== 'false';
}

export function getAdSenseScriptUrl(clientId = getAdSenseClientId()) {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
}
