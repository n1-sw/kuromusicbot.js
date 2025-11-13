const play = require('play-dl');
const ytdl = require('ytdl-core');

const urls = [
  'https://www.youtube.com/watch?v=G9F8VtqNhzo'
];

async function testUrl(url) {
  console.log('\n=== Testing', url, '===');

  // play-dl info
  try {
    const info = await play.video_info(url);
    console.log('play-dl: video_info OK:', info && info.video_details && info.video_details.title);
  } catch (err) {
    console.error('play-dl: video_info ERROR:', err && err.message ? err.message : err);
  }

  try {
    const s = await play.stream(url);
    console.log('play-dl: stream OK - type:', s.type);
    if (s.stream && s.stream.destroy) s.stream.destroy();
  } catch (err) {
    console.error('play-dl: stream ERROR:', err && err.message ? err.message : err);
  }

  // try stream_from_info if video_info available
  try {
    const info = await play.video_info(url);
    if (info) {
      try {
        const sf = await play.stream_from_info(info);
        console.log('play-dl: stream_from_info OK - type:', sf.type);
        if (sf.stream && sf.stream.destroy) sf.stream.destroy();
      } catch (sfErr) {
        console.error('play-dl: stream_from_info ERROR:', sfErr && sfErr.message ? sfErr.message : sfErr);
      }
    }
  } catch (infoErr) {
    // ignore
  }

  // ytdl-core info
  try {
    const info = await ytdl.getInfo(url);
    console.log('ytdl-core: getInfo OK:', info.videoDetails && info.videoDetails.title);
  } catch (err) {
    console.error('ytdl-core: getInfo ERROR:', err && err.message ? err.message : err);
  }

  try {
    const stream = ytdl(url, { filter: 'audioonly', highWaterMark: 1 << 25 });
    stream.on('error', e => console.error('ytdl-core: stream ERROR (async):', e && e.message ? e.message : e));
    stream.once('data', chunk => {
      console.log('ytdl-core: stream produced data, fallback stream seems OK');
      stream.destroy();
    });
    console.log('ytdl-core: stream created (listening for data)');
  } catch (err) {
    console.error('ytdl-core: stream ERROR (sync):', err && err.message ? err.message : err);
  }

  // Try system yt-dlp binary fallback (use runtime downloader/ensurer)
  try {
    const { spawn } = require('child_process');
    const { ensureYtDlp } = require('../src/utils/ytDlp');
    const exe = await (async () => { try { return await ensureYtDlp(); } catch(e){ return null;} })();
    if (!exe) {
      console.log('yt-dlp not available (not installed and download failed)');
    } else {
      const args = ['-o', '-', '-f', 'bestaudio[ext=webm]/bestaudio', '--no-playlist', url];
      const proc = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stderr.on('data', d => console.error('yt-dlp stderr:', d.toString()));
      proc.on('error', e => console.error('yt-dlp spawn error:', e));
      // try to read a small chunk to ensure it started
      proc.stdout.once('data', chunk => {
        console.log('yt-dlp: stdout chunk received, fallback stream seems OK');
        proc.kill();
      });
      // if process closes immediately, log
      proc.on('close', code => {
        console.log('yt-dlp process closed with code', code);
      });
    }
  } catch (err) {
    console.error('yt-dlp test ERROR:', err && err.message ? err.message : err);
  }
}

(async () => {
  for (const url of urls) {
    await testUrl(url);
  }
})();
