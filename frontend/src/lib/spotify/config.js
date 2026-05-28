function detectarRedirectUri() {
  if (typeof window === 'undefined') return 'llmc://spotify-callback';
  const esCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (esCapacitor) return 'llmc://spotify-callback';
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${window.location.origin}${base}/spotify-callback`;
}

export const SPOTIFY_CONFIG = {
  clientId: 'cfe489856ad94103a41d6cb0bee1b8f1',
  get redirectUri() { return detectarRedirectUri(); },
  scopes: [
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-top-read',
    'user-read-recently-played',
  ],
  authUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
  apiBase: 'https://api.spotify.com/v1',
};
