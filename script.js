const GENIUS_API_KEY = "YOUR_GENIUS_API_KEY";

// Initialize app
window.onload = () => {
  if (window.location.pathname.includes('index.html')) {
    const token = getAccessToken();
    if (token) {
      window.location.href = 'mood.html';
    }
  }
  
  // Initialize sakura petals
  createSakuraPetals();
};

// Utility function for delays
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Sakura Petals Generation
function createSakuraPetals() {
  const container = document.querySelector('.sakura-petals');
  if (!container) return;
  
  container.innerHTML = '';
  const petalCount = 15 + Math.floor(Math.random() * 10);
  
  for (let i = 0; i < petalCount; i++) {
    const petal = document.createElement('div');
    petal.className = 'sakura-petal';
    
    petal.style.cssText = `
      --random-x: ${Math.random() * 2 - 1};
      --random-rotate: ${Math.random()};
      width: ${20 + Math.random() * 30}px;
      height: ${20 + Math.random() * 30}px;
      left: ${Math.random() * 100}%;
      top: -${30 + Math.random() * 30}px;
      animation-duration: ${15 + Math.random() * 25}s;
      animation-delay: ${Math.random() * 15}s;
      opacity: ${0.5 + Math.random() * 0.5};
    `;
    
    container.appendChild(petal);
  }
}

// Spotify Playback Simplified Version
function playOnSpotify(trackId) {
  window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
}

// Search for songs
async function searchSong() {
  const query = document.getElementById('song-search')?.value.trim();
  const token = getAccessToken();

  if (!query) return alert('Please enter a song name');
  
  const resultsDiv = document.getElementById('search-results');
  resultsDiv.innerHTML = '<div class="loading-spinner"></div>';

  try {
    await delay(300);
    
    if (token) {
      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Spotify search failed');
      displayResults((await response.json()).tracks.items);
    } else {
      displayResults([{
        name: query,
        artists: [{ name: "Unknown Artist" }],
        id: "local-" + Math.random().toString(36).substring(7),
        album: { images: [] }
      }]);
    }
  } catch (err) {
    resultsDiv.innerHTML = `
      <div class="error-message">
        ❌ Search failed: ${err.message}<br>
        <small>Please try again later</small>
      </div>
    `;
  }
}

// Display search results
function displayResults(tracks) {
  const resultsDiv = document.getElementById('search-results');
  if (!resultsDiv || !tracks?.length) {
    resultsDiv.innerHTML = '<p>No tracks found. Try a different search.</p>';
    return;
  }

  resultsDiv.innerHTML = '';
  tracks.forEach(track => {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';
    const artists = track.artists.map(a => a.name).join(', ');
    
    trackDiv.innerHTML = `
      <h3>${track.name}</h3>
      <p>${artists}</p>
      ${track.album.images[0]?.url ? `<img src="${track.album.images[0].url}" class="track-thumbnail">` : ''}
      <button onclick="getMoodData('${track.name.replace("'", "\\'")}', '${artists.replace("'", "\\'")}', '${track.id}')">
        <span class="mood-icon">🧠</span> Analyze Mood
      </button>
      <div id="mood-${track.id}"></div>
    `;

    resultsDiv.appendChild(trackDiv);
  });
}

// Mood analysis function
async function getMoodData(trackName, artistName, trackId) {
  const moodDiv = document.getElementById(`mood-${trackId}`);
  moodDiv.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const cacheKey = `lyrics-${artistName}-${trackName}`.toLowerCase();
    const cachedLyrics = localStorage.getItem(cacheKey);
    
    if (cachedLyrics) {
      displayMood(analyzeLyricsMood(cachedLyrics), trackId, trackName);
      return;
    }

    try {
      const lyrics = await fetchGeniusLyrics(trackName, artistName);
      if (lyrics) {
        localStorage.setItem(cacheKey, lyrics);
        displayMood(analyzeLyricsMood(lyrics), trackId, trackName);
        return;
      }
    } catch (geniusErr) {
      console.log("Genius API failed:", geniusErr);
    }

    try {
      const lyrics = await fetchLyricsOVH(trackName, artistName);
      if (lyrics) {
        localStorage.setItem(cacheKey, lyrics);
        displayMood(analyzeLyricsMood(lyrics), trackId, trackName);
        return;
      }
    } catch (ovhErr) {
      console.log("Lyrics.ovh failed:", ovhErr);
    }

    displayMood(analyzeTitleMood(trackName), trackId, trackName, true);

  } catch (err) {
    moodDiv.innerHTML = `
      <div class="error-message">
         Couldn't analyze "${trackName}"<br>
        <small>${err.message || "No lyrics available"}</small>
      </div>
    `;
  }
}


// Fetch from Genius API
async function fetchGeniusLyrics(trackName, artistName) {
  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${trackName} ${artistName}`)}`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${GENIUS_API_KEY}` }
  });

  if (!searchRes.ok) throw new Error("Genius API unavailable");
  
  const searchData = await searchRes.json();
  const songPath = searchData.response?.hits[0]?.result?.api_path;
  
  if (!songPath) throw new Error("Lyrics not found on Genius");
  
  const lyricsUrl = `https://api.genius.com${songPath}`;
  const lyricsRes = await fetch(lyricsUrl, {
    headers: { 'Authorization': `Bearer ${GENIUS_API_KEY}` }
  });
  
  if (!lyricsRes.ok) throw new Error("Failed to load lyrics");
  
  const lyricsData = await lyricsRes.json();
  return lyricsData.response.song.lyrics.plain;
}

// Fallback to Lyrics.ovh
async function fetchLyricsOVH(trackName, artistName) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`;
  const response = await fetch(url);
  
  if (!response.ok) throw new Error("Lyrics.ovh failed");
  
  const data = await response.json();
  return data.lyrics;
}

// Enhanced mood analysis
function analyzeLyricsMood(lyrics) {
  const lowerLyrics = lyrics.toLowerCase();
  
  const moodKeywords = {
    comforting: {
      words: ['home', 'safe', 'warm', 'hug', 'soft', 'gentle', 'hold', 'comfort'],
      score: 0,
      emoji: '🤗',
      desc: (name) => `${name} wraps around you like a favorite blanket, offering soft reassurance.`,
      vibe: 'The gentle embrace of unconditional acceptance'
    },
    nostalgic: {
      words: ['remember', 'memory', 'childhood', 'old', 'past', 'used to', 'years ago'],
      score: 0,
      emoji: '🛤️',
      desc: (name) => `${name} smells like yellowed pages in a childhood diary, bittersweet and familiar.`,
      vibe: 'Flipping through faded polaroids'
    },
    euphoric: {
      words: ['free', 'fly', 'alive', 'wild', 'dance', 'laugh', 'sun', 'light'],
      score: 0,
      emoji: '🌞',
      desc: (name) => `${name} tastes like stolen kisses and summer strawberries - sweet and intoxicating.`,
      vibe: 'Heart pounding with uncontainable joy'
    },
    melancholic: {
      words: ['alone', 'miss', 'gone', 'fade', 'empty', 'dark', 'rain', 'tears'],
      score: 0,
      emoji: '☔',
      desc: (name) => `${name} feels like watching raindrops trace paths down a windowpane.`,
      vibe: 'The beautiful ache of longing'
    },
    passionate: {
      words: ['burn', 'fire', 'touch', 'skin', 'need', 'want', 'crave', 'desire'],
      score: 0,
      emoji: '💓',
      desc: (name) => `${name} burns like whiskey on a winter night - warming you from within.`,
      vibe: 'Fingertips tracing invisible sparks'
    },
    reflective: {
      words: ['think', 'wonder', 'maybe', 'if', 'why', 'question', 'search', 'meaning'],
      score: 0,
      emoji: '🤔',
      desc: (name) => `${name} settles like dusk over a quiet city, inviting contemplation.`,
      vibe: 'Thoughts swirling like autumn leaves'
    },
    energetic: {
      words: ['go', 'move', 'run', 'jump', 'shake', 'bass', 'beat', 'pulse'],
      score: 0,
      emoji: '🎉',
      desc: (name) => `${name} hits like a sugar rush at midnight, your body moving instinctively.`,
      vibe: 'Adrenaline singing through your veins'
    },
    lover: {
      words: ['love', 'darling', 'sweet', 'honey', 'baby', 'lover', 'beloved', 'adore'],
      score: 0,
      emoji: '💖',
      desc: (name) => `${name} wraps around you like a favorite blanket, offering soft reassurance.`,
      vibe: 'The gentle embrace of unconditional love'
    }
  };

  // Score each mood category
  Object.keys(moodKeywords).forEach(mood => {
    moodKeywords[mood].score = moodKeywords[mood].words
      .filter(word => lowerLyrics.includes(word))
      .length;
  });

  // Determine dominant mood
  const scores = Object.values(moodKeywords).map(m => m.score);
  const maxScore = Math.max(...scores);
  
  if (maxScore < 2) return {
    mood: 'neutral',
    emoji: '🎭',
    desc: (name) => `${name} shifts like shadows on a wall, revealing different emotions.`,
    vibe: 'A tapestry woven from many feelings'
  };
  
  const detectedMood = Object.keys(moodKeywords).find(key => 
    moodKeywords[key].score === maxScore
  );
  
  return {
    mood: detectedMood,
    ...moodKeywords[detectedMood]
  };
}

// Fallback title analysis
function analyzeTitleMood(trackName) {
  const lowerName = trackName.toLowerCase();
  
  if (/home|safe|warm|comfort/.test(lowerName)) return {
    mood: 'comforting',
    emoji: '🤗',
    desc: (name) => `${name} feels like coming in from the cold to a crackling fireplace.`,
    vibe: 'The relief of being truly seen'
  };
  
  if (/memory|old|past|remember/.test(lowerName)) return {
    mood: 'nostalgic',
    emoji: '🛤️',
    desc: (name) => `${name} smells like your grandmother's perfume on a forgotten sweater.`,
    vibe: 'Bittersweet echoes of the past'
  };
  
  if (/love|heart|romance|baby/.test(lowerName)) return {
    mood: 'passionate',
    emoji: '💓',
    desc: (name) => `${name} tastes like the first sip of wine on a candlelit evening.`,
    vibe: 'Butterflies dancing in golden light'
  };
  
  if (/sad|cry|tears|pain/.test(lowerName)) return {
    mood: 'melancholic',
    emoji: '☔',
    desc: (name) => `${name} feels like pressing on a bruise just to feel something real.`,
    vibe: 'The comfort of shared sorrow'
  };
  
  if (/party|dance|energy/.test(lowerName)) return {
    mood: 'energetic',
    emoji: '🎉',
    desc: (name) => `${name} hits like a midnight adrenaline rush.`,
    vibe: 'Uncontainable energy buzzing through you'
  };
  
  return {
    mood: 'neutral',
    emoji: '🎭',
    desc: (name) => `${name} reveals its emotions slowly, like dawn breaking.`,
    vibe: 'Complex feelings woven together'
  };
}

async function playOnSpotify(trackId) {
  window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
  if (!requireSpotify()) return;
  
  const token = getAccessToken();
  if (!token) return loginWithSpotify();

  try {
    // Check for active devices
    const devicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!devicesRes.ok) throw new Error('Failed to get devices');
    
    const { devices } = await devicesRes.json();
    const activeDevice = devices.find(d => d.is_active);
    const webPlayer = devices.find(d => d.type === 'Computer');

    if (!activeDevice && webPlayer) {
      // Transfer playback to web player if available
      await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [webPlayer.id],
          play: false
        })
      });
    } else if (!activeDevice) {
      throw new Error('No active devices found');
    }

    // Start playback
    const playbackRes = await fetch(`https://api.spotify.com/v1/me/player/play`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`]
      })
    });
    
    if (!playbackRes.ok) throw new Error('Playback failed');
    
  } catch (err) {
    console.error('Playback error:', err);
    showPlaybackError(err.message);
  }
}

function showPlaybackError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'playback-error';
  errorDiv.innerHTML = `
    <p>❌ ${message || 'Playback error'}</p>
    <small>1. Make sure Spotify is open on any device</small><br>
    <small>2. Refresh this page and try again</small>
  `;
  
  // Add error message below the play button
  const moodCard = document.querySelector('.mood-card');
  const existingError = moodCard.querySelector('.playback-error');
  if (existingError) {
    moodCard.replaceChild(errorDiv, existingError);
  } else {
    moodCard.appendChild(errorDiv);
  }
}

// Display mood result with cute names
function displayMood(moodAnalysis, trackId, trackName, isFallback = false) {
  const moodDiv = document.getElementById(`mood-${trackId}`);
  
  // Mood name mapping with cute titles
  const moodNames = {
    comforting: "Warm Hug Mood 🤗",
    nostalgic: "Memory Lane Mood 🛤️",
    euphoric: "Sunshine Joy Mood 🌞",
    melancholic: "Rainy Day Mood ☔",
    passionate: "Heart Flutter Mood 💓",
    reflective: "Deep Thoughts Mood 🤔",
    energetic: "Dance Party Mood 🎉",
    lover: "Lover's Embrace 💖",
    neutral: "Mixed Feelings Mood �"
  };

  // Get mood color
  const moodColors = {
    comforting: "#FF9CDA",
    nostalgic: "#B399D4",
    euphoric: "#FFD166",
    melancholic: "#7AD0F5",
    passionate: "#FF6B95",
    reflective: "#06D6A0",
    energetic: "#FF9E7D",
    neutral: "#C5A3FF"
  };

  moodDiv.innerHTML = `
    <div class="mood-card" style="border-left-color: ${moodColors[moodAnalysis.mood]}">
      <div class="mood-emoji">${moodAnalysis.emoji}</div>
      <div class="mood-name" style="background: linear-gradient(45deg, ${moodColors[moodAnalysis.mood]}, ${moodColors[moodAnalysis.mood]}80)">
        ${moodNames[moodAnalysis.mood] || moodNames['neutral']}
      </div>
      <div class="mood-title">${trackName}</div>
      <div class="mood-desc">${moodAnalysis.desc(trackName)}</div>
      <div class="mood-vibe" style="background: linear-gradient(45deg, ${moodColors[moodAnalysis.mood]}, ${moodColors[moodAnalysis.mood]}80)">
        ✨ ${moodAnalysis.vibe}
      </div>
      ${getAccessToken() ? `
        <button class="spotify-play-btn" onclick="playOnSpotify('${trackId}')">
          <span class="spotify-icon">▶</span> Play on Spotify
        </button>
      ` : ''}
      ${isFallback ? '<div class="fallback-notice">(Inspired by song title)</div>' : ''}
    </div>
  `;
}

function requireSpotify() {
  if (!getAccessToken()) {
    if (confirm("This feature requires Spotify login. Go to login page?")) {
      window.location.href = 'index.html';
    }
    return false;
  }
  return true;
}

// Easter eggs and interactions
document.addEventListener('keydown', (e) => {
  if (e.target === document.body && e.key.toLowerCase() === 's') {
    const secret = Array.from(document.querySelectorAll('.floating-emojis span'));
    secret.forEach(emoji => {
      emoji.style.animation = 'rainbow 2s infinite';
    });
    
    // Add rainbow background
    document.body.style.animation = 'rainbowBG 5s infinite';
    
    // Make mascot dance
    const mascot = document.querySelector('.mascot');
    mascot.style.animation = 'dance 1s infinite';
  }
});

// Mascot interaction
document.querySelector('.mascot')?.addEventListener('click', () => {
  const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-bird-whistling-2290.mp3');
  audio.play();
});
// Function to create the 'Play on Spotify' button and handle the click
function createPlayButton(trackUrl, trackId) {
  const playButtonDiv = document.createElement("div");
  playButtonDiv.classList.add("play-button");

  const playButton = document.createElement("button");
  playButton.innerText = "Play on Spotify";
  playButton.classList.add("spotify-play-btn");

  // Redirect to Spotify track URL on button click
  playButton.addEventListener("click", function() {
    window.open(trackUrl, "_blank");
  });

  playButtonDiv.appendChild(playButton);
  document.getElementById(`mood-${trackId}`).appendChild(playButtonDiv);
}

// Example usage when displaying track data
function displayTrackData(track, mood) {
  const trackId = track.id;
  const trackName = track.name;
  const trackUrl = track.external_urls.spotify; // Spotify URL for the track

  displayMood(mood, trackId, trackName);
  createPlayButton(trackUrl, trackId);  // Add the Play on Spotify button
}
