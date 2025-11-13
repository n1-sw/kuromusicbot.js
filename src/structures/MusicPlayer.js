const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('ytdl-core');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const MusicQueue = require('./MusicQueue');
const EmbedCreator = require('../utils/embeds');

class MusicPlayer {
  constructor() {
    this.queues = new Map();
  }

  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, new MusicQueue(guildId));
    }
    return this.queues.get(guildId);
  }

  async createConnection(member, channel) {
    try {
      const queue = this.getQueue(member.guild.id);
      
      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: member.guild.id,
        adapterCreator: member.guild.voiceAdapterCreator,
      });

      // Wait for the connection to enter Ready or Connecting state to ensure it's established.
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Ready, 30000),
          entersState(connection, VoiceConnectionStatus.Connecting, 30000),
        ]);
      } catch (readyError) {
        console.error('Voice connection failed to reach Ready/Connecting state:', readyError && readyError.message);
        connection.destroy();
        throw new Error('Failed to establish voice connection. Check your network and firewall settings for UDP.');
      }

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
        } catch (error) {
          console.warn('Failed to reconnect voice connection:', error && error.message);
          // Clean up yt-dlp process before destroying connection
          queue.cleanupProcess();
          connection.destroy();
          this.queues.delete(member.guild.id);
          if (queue.textChannel) {
            queue.textChannel.send({
              embeds: [EmbedCreator.error('Voice Connection Lost', 'Lost connection to voice channel. Please try again.')]
            });
          }
        }
      });

      connection.on('error', error => {
        console.error('Voice connection error:', error && error.message ? error.message : error);
        // Log the full error for debugging but don't spam the channel
        if (error && error.message && !error.message.includes('socket closed')) {
          if (queue.textChannel) {
            queue.textChannel.send({
              embeds: [EmbedCreator.error('Voice Error', 'A voice connection error occurred.')]
            });
          }
        }
      });

      const player = createAudioPlayer();

      player.on(AudioPlayerStatus.Idle, () => {
        this.handleTrackEnd(member.guild.id);
      });

      player.on('error', error => {
        console.error('Audio player error:', error);
        if (queue.textChannel) {
          queue.textChannel.send({ 
            embeds: [EmbedCreator.error('Playback Error', 'An error occurred while playing the track.')] 
          });
        }
        this.handleTrackEnd(member.guild.id);
      });

      connection.subscribe(player);

      queue.connection = connection;
      queue.player = player;
      queue.textChannel = channel;

      return { connection, player };
    } catch (error) {
      console.error('Error creating connection:', error && error.message ? error.message : error);
      throw error;
    }
  }

  async play(guildId) {
    const queue = this.getQueue(guildId);
    
    if (!queue.connection || !queue.player) {
      return;
    }

    const track = queue.getNextTrack();
    
    if (!track) {
      queue.isPlaying = false;
      if (queue.textChannel) {
        queue.textChannel.send({ 
          embeds: [EmbedCreator.info('Queue Ended', 'No more tracks in the queue.')] 
        });
      }
      
      setTimeout(() => {
        if (queue.connection) {
          queue.connection.destroy();
          this.queues.delete(guildId);
        }
      }, 60000);
      return;
    }

    // Clean up any existing yt-dlp process before starting new playback
    queue.cleanupProcess();

    queue.currentTrack = track;
    queue.isPlaying = true;

    try {
      // Defensive checks: ensure we have a valid string URL before calling play-dl.
      if (!track || typeof track.url !== 'string' || track.url === 'undefined' || track.url.trim() === '') {
        console.error('❌ Invalid track data when attempting to play:', track);
        if (queue.textChannel) {
          queue.textChannel.send({
            embeds: [EmbedCreator.error('Playback Error', 'Track URL is missing or invalid. Skipping to next track.')] 
          });
        }
        this.handleTrackEnd(guildId);
        return;
      }

      console.log('🎵 Now playing:', track.title);
      console.log('📎 Track URL:', track.url);

      const isYouTube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(track.url);
      let resource;

      // For YouTube URLs, use optimized extraction strategy
      if (isYouTube) {
        // Try yt-dlp first as it's most reliable for YouTube
        let ytDlpFailed = false;
        try {
          console.log('🎵 Attempting to extract with yt-dlp...');
          const { ensureYtDlp } = require('../utils/ytDlp');
          const ytDlpExecutable = await ensureYtDlp();

          // Decide whether to request yt-dlp to extract audio using ffmpeg
          // or to stream a native audio container directly. The latter is
          // safer on restricted hosts (no ffmpeg required). The behavior
          // can be forced with `YTDLP_FORCE_EXTRACT_AUDIO=1` when you have
          // ffmpeg available on the host.
          const forceExtract = process.env.YTDLP_FORCE_EXTRACT_AUDIO === '1';
          let ffmpegPresent = false;
          try {
            const which = spawnSync('which', ['ffmpeg']);
            ffmpegPresent = which && which.status === 0;
          } catch (e) {
            ffmpegPresent = false;
          }

          let args;
          if (forceExtract) {
            if (ffmpegPresent) {
              // Ask yt-dlp to extract audio via ffmpeg (more compatible formats)
              args = [
                  '-o', '-',
                  '-f', 'bestaudio',
                  '--no-playlist',
                  '--quiet',
                  '--no-warnings',
                  '--extract-audio',
                  '--audio-quality', '0',
                  '--no-check-certificate',
                  '--extractor-args', 'youtube:player_client=default',
                  track.url
                ];
            } else {
              console.warn('⚠️ YTDLP_FORCE_EXTRACT_AUDIO set but ffmpeg not found; falling back to streaming a native audio container');
              args = [
                '-o', '-',
                '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
                '--no-playlist',
                '--quiet',
                '--no-warnings',
                '--no-check-certificate',
                track.url
              ];
            }
          } else {
            // Default: stream audio container directly (no ffmpeg required)
            args = [
              '-o', '-',
              '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
              '--no-playlist',
              '--quiet',
              '--no-warnings',
              '--no-check-certificate',
              '--extractor-args', 'youtube:player_client=default',
              track.url
            ];
          }

          const proc = spawn(ytDlpExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

          // Store the process for cleanup
          queue.ytDlpProcess = proc;

          let stderrData = '';
          let hasOutputData = false;

          proc.stdout.on('data', () => {
            hasOutputData = true;
          });

          proc.stderr.on('data', (data) => {
            stderrData += data.toString();
          });

          // Wait briefly for yt-dlp to produce stdout. If it exits or
          // times out without producing data, fallback to other extractors.
          const waitForOutput = () => new Promise((resolve) => {
            let resolved = false;

            const onData = () => {
              if (resolved) return;
              resolved = true;
              cleanupListeners();
              resolve(true);
            };

            const onExit = () => {
              if (resolved) return;
              resolved = true;
              cleanupListeners();
              resolve(false);
            };

            const onError = () => {
              if (resolved) return;
              resolved = true;
              cleanupListeners();
              resolve(false);
            };

            const timeout = setTimeout(() => {
              if (resolved) return;
              resolved = true;
              cleanupListeners();
              resolve(false);
            }, 5000);

            function cleanupListeners() {
              clearTimeout(timeout);
              try { proc.stdout.removeListener('data', onData); } catch (e) {}
              try { proc.removeListener('exit', onExit); } catch (e) {}
              try { proc.removeListener('error', onError); } catch (e) {}
            }

            proc.stdout.once('data', onData);
            proc.once('exit', onExit);
            proc.once('error', onError);
          });

          const produced = await waitForOutput();
          if (!produced) {
            // yt-dlp failed or timed out before producing usable stdout.
            try {
              if (queue.ytDlpProcess === proc) queue.ytDlpProcess = null;
              proc.kill('SIGTERM');
            } catch (e) {}

            console.warn('⚠️ yt-dlp did not produce output or was terminated; falling back to other extractors');
            if (process.env.YTDLP_DEBUG === '1' && stderrData) {
              console.error('--- yt-dlp stderr (debug) ---');
              console.error(stderrData);
              console.error('--- end yt-dlp stderr ---');
            }

            // Fallback to play-dl
            try {
              const stream = await play.stream(track.url, { quality: 2 });
              resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
              });
              console.log('✓ Using play-dl for audio streaming (fallback)');
            } catch (playDlErr) {
              console.warn('⚠️ play-dl failed as fallback:', playDlErr && playDlErr.message);
              // Last fallback: ytdl-core
              try {
                const ytStream = ytdl(track.url, {
                  filter: 'audioonly',
                  quality: 'highestaudio',
                  highWaterMark: 1 << 25
                });
                ytStream.on('error', streamErr => {
                  console.error('ytdl stream error:', streamErr);
                });
                resource = createAudioResource(ytStream, {
                  inputType: StreamType.Arbitrary,
                  inlineVolume: true
                });
                console.log('✓ Using ytdl-core for audio streaming (fallback)');
              } catch (ytdlErr) {
                console.error('❌ All extraction methods failed for (fallback):', track.url);
                if (queue.textChannel) {
                  queue.textChannel.send({
                    embeds: [EmbedCreator.error('Playback Error', 'Could not extract audio stream (fallbacks failed). Try another song.')]
                  });
                }
                this.handleTrackEnd(guildId);
                return;
              }
            }
          } else {
            // produced data; use proc stdout as resource
            resource = createAudioResource(proc.stdout, {
              inputType: StreamType.Arbitrary,
              inlineVolume: true
            });

            resource.playStream.on('end', () => {
              queue.cleanupProcess();
            });

            resource.playStream.on('error', (err) => {
              console.error('❌ Audio stream error:', err);
              queue.cleanupProcess();
            });

            console.log('✓ Using yt-dlp for audio extraction');
          }

          proc.on('exit', (code, signal) => {
            if (queue.ytDlpProcess === proc) {
              queue.ytDlpProcess = null;
            }
            if (code !== 0) {
              console.error('❌ yt-dlp exited with code:', code, 'signal:', signal);
              if (stderrData) console.error('yt-dlp error output:', stderrData);
            }
            // If debug logging is enabled, always print stderr to aid diagnosis.
            if (process.env.YTDLP_DEBUG === '1' && stderrData) {
              console.error('--- yt-dlp stderr (debug) ---');
              console.error(stderrData);
              console.error('--- end yt-dlp stderr ---');
            }
          });

          proc.on('error', (err) => {
            if (queue.ytDlpProcess === proc) queue.ytDlpProcess = null;
            console.error('❌ yt-dlp process error:', err);
          });
        } catch (ytDlpErr) {
          ytDlpFailed = true;
          console.warn('⚠️ yt-dlp failed:', ytDlpErr && ytDlpErr.message);

          // Fallback to play-dl
          try {
            console.log('🎵 Attempting to stream with play-dl...');
            const stream = await play.stream(track.url, { quality: 2 });
            resource = createAudioResource(stream.stream, { 
              inputType: stream.type,
              inlineVolume: true
            });
            console.log('✓ Using play-dl for audio streaming');
          } catch (playDlErr) {
            console.warn('⚠️ play-dl failed:', playDlErr && playDlErr.message);

            // Last fallback: ytdl-core
            try {
              console.log('🎵 Attempting to stream with ytdl-core...');
              const ytStream = ytdl(track.url, { 
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
              });

              ytStream.on('error', streamErr => {
                console.error('ytdl stream error:', streamErr);
              });

              resource = createAudioResource(ytStream, { 
                inputType: StreamType.Arbitrary,
                inlineVolume: true
              });
              console.log('✓ Using ytdl-core for audio streaming');
            } catch (ytdlErr) {
              console.error('❌ All extraction methods failed for:', track.url);
              console.error('yt-dlp error:', ytDlpErr && ytDlpErr.message);
              console.error('play-dl error:', playDlErr && playDlErr.message);
              console.error('ytdl-core error:', ytdlErr && ytdlErr.message);
              if (queue.textChannel) {
                queue.textChannel.send({ 
                  embeds: [EmbedCreator.error('Playback Error', 'Could not extract audio stream. The video may be restricted or unavailable. Try another song.')] 
                });
              }
              this.handleTrackEnd(guildId);
              return;
            }
          }
        }
      } else {
        // For non-YouTube URLs, try play-dl
        try {
          console.log('🎵 Streaming non-YouTube URL with play-dl...');
          const stream = await play.stream(track.url, { quality: 2 });
          resource = createAudioResource(stream.stream, { 
            inputType: stream.type,
            inlineVolume: true
          });
          console.log('✓ Using play-dl for non-YouTube URL');
        } catch (err) {
          console.error('❌ play-dl failed for non-YouTube URL:', err && err.message);
          if (queue.textChannel) {
            queue.textChannel.send({ 
              embeds: [EmbedCreator.error('Playback Error', 'Could not play this URL. Please try a YouTube link.')] 
            });
          }
          this.handleTrackEnd(guildId);
          return;
        }
      }

      queue.player.play(resource);

      if (queue.textChannel) {
        queue.textChannel.send({ 
          embeds: [EmbedCreator.nowPlaying(track, track.requestedBy)] 
        });
      }
    } catch (error) {
      console.error('Error playing track:', error, 'track=', track);
      if (queue.textChannel) {
        const title = track && track.title ? track.title : (track && track.url ? track.url : 'Unknown');
        queue.textChannel.send({ 
          embeds: [EmbedCreator.error('Playback Error', `Could not play: ${title}`)] 
        });
      }
      this.handleTrackEnd(guildId);
    }
  }

  handleTrackEnd(guildId) {
    const queue = this.getQueue(guildId);
    
    // Clean up yt-dlp process from previous track
    queue.cleanupProcess();
    
    if (queue.loopMode === 'track' || !queue.isEmpty() || queue.loopMode === 'queue') {
      setTimeout(() => this.play(guildId), 500);
    } else {
      queue.isPlaying = false;
      queue.currentTrack = null;
    }
  }

  pause(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      queue.player.pause();
      return true;
    }
    return false;
  }

  resume(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      queue.player.unpause();
      return true;
    }
    return false;
  }

  stop(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.connection) {
      queue.clear();
      queue.isPlaying = false;
      queue.currentTrack = null;
      if (queue.player) {
        queue.player.stop();
      }
      // Clean up yt-dlp process if running
      queue.cleanupProcess();
      queue.connection.destroy();
      this.queues.delete(guildId);
      return true;
    }
    return false;
  }

  skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player && queue.isPlaying) {
      // Clean up yt-dlp process if running
      queue.cleanupProcess();
      queue.player.stop();
      return true;
    }
    return false;
  }

  disconnect(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.connection) {
      queue.isPlaying = false;
      if (queue.player) {
        queue.player.stop();
      }
      // Clean up yt-dlp process if running
      queue.cleanupProcess();
      queue.connection.destroy();
      this.queues.delete(guildId);
      return true;
    }
    return false;
  }
}

module.exports = new MusicPlayer();
