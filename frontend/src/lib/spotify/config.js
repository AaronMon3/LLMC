export const SPOTIFY_CONFIG = {
  clientId: 'cfe489856ad94103a41d6cb0bee1b8f1',
  redirectUri: 'llmc://spotify-callback',
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
