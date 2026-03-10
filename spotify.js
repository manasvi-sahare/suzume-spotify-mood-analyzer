const clientId = 'YOUR_SPOTIFY_CLIENT_ID';
const redirectUri = 'http://localhost:5500/callback.html';
const scopes = 'user-top-read user-modify-playback-state';

function loginWithSpotify() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
}

function getAccessToken() {
  return localStorage.getItem('spotify_token');
}

function enableRainbowMode() {
  const iframe = document.getElementById('spotify-web-player');
  iframe.style.filter = 'hue-rotate(0deg)';
  iframe.style.animation = 'rainbowFilter 5s infinite';
}
