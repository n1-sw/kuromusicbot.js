const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { spawnSync } = require('child_process');

// Use user home cache directory: ~/.cache/discord-music-bot/
const CACHE_DIR = path.join(os.homedir(), '.cache', 'discord-music-bot');
const BIN_PATH = path.join(CACHE_DIR, 'yt-dlp');

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function which(binary) {
  try {
    const result = spawnSync('which', [binary]);
    if (result.status === 0) return result.stdout.toString().trim();
  } catch (e) {
    // ignore
  }
  return null;
}

async function downloadYtDlp(dest) {
  const maxRedirects = 6;

  function getUrl(url, redirectsLeft) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, res => {
        // follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects when downloading yt-dlp'));
          return resolve(getUrl(res.headers.location, redirectsLeft - 1));
        }

        if (res.statusCode !== 200) return reject(new Error('Failed to download yt-dlp: ' + res.statusCode));

        const file = fs.createWriteStream(dest, { mode: 0o755 });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
        file.on('error', reject);
      });

      req.on('error', reject);
    });
  }

  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  return getUrl(url, maxRedirects);
}

async function ensureYtDlp() {
  // 1) check system PATH
  const system = which('yt-dlp');
  if (system) return system;

  // 2) check cache and validate age
  try {
    if (isExecutable(BIN_PATH)) {
      const stat = fs.statSync(BIN_PATH);
      const ageMs = Date.now() - stat.mtimeMs;
      const ageHours = ageMs / (1000 * 60 * 60);
      const maxAgeHours = 7 * 24; // 7 days

      if (ageHours < maxAgeHours) {
        console.log(`yt-dlp cache is fresh (${Math.round(ageHours)} hours old), using cached binary`);
        return BIN_PATH;
      } else {
        console.log(`yt-dlp cache is stale (${Math.round(ageHours)} hours old), re-downloading...`);
        try {
          fs.unlinkSync(BIN_PATH);
        } catch (e) {
          // ignore unlink errors
        }
      }
    }
  } catch (e) {
    // continue to download
  }

  // 3) attempt to download into cache
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    await downloadYtDlp(BIN_PATH);
    try { fs.chmodSync(BIN_PATH, 0o755); } catch (e) {}
    if (isExecutable(BIN_PATH)) {
      console.log('yt-dlp downloaded and cached at', BIN_PATH);
      return BIN_PATH;
    }
  } catch (err) {
    // failed to download or make executable
    throw new Error('yt-dlp not available and download failed: ' + (err && err.message));
  }

  throw new Error('yt-dlp not available');
}


module.exports = { ensureYtDlp };
