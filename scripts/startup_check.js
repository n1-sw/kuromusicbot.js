// Simple startup-check script to simulate yt-dlp detection behavior without logging into Discord
(async () => {
  const path = require('path');
  const repoRoot = path.join(__dirname, '..');
  try {
    const { ensureYtDlp } = require(path.join(repoRoot, 'src', 'utils', 'ytDlp'));

    if (process.env.DISABLE_YTDLP_CHECK === '1' || process.env.SKIP_YTDLP_CHECK === '1') {
      console.log('ℹ️ yt-dlp startup check disabled via environment variable');
      process.exit(0);
    }

    try {
      const exe = await ensureYtDlp();
      console.log('✓ yt-dlp available at', exe);
    } catch (err) {
      console.log('ℹ️ yt-dlp not available; falling back to alternative extractors');
      console.log('Reason:', err && err.message ? err.message : err);
    }
  } catch (err) {
    console.error('Startup check failed (could not load ensureYtDlp):', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
