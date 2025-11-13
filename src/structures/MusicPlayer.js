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
const { spawn } = require('child_process');
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
          entersState(connection, 'Ready', 30000),
          entersState(connection, 'Connecting', 30000),
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

    queue.currentTrack = track;
    queue.isPlaying = true;

    try {
      // Defensive checks: ensure we have a valid string URL before calling play-dl.
      if (!track || typeof track.url !== 'string' || track.url === 'undefined' || track.url.trim() === '') {
        console.error('Invalid track data when attempting to play:', track);
        if (queue.textChannel) {
          queue.textChannel.send({
            embeds: [EmbedCreator.error('Playback Error', 'Track URL is missing or invalid. Skipping to next track.')] 
          });
        }
        this.handleTrackEnd(guildId);
        return;
      }

      // Try play-dl first (supports YouTube, Spotify lookups, etc.).
      let resource;
      try {
        const stream = await play.stream(track.url);
        resource = createAudioResource(stream.stream, { inputType: stream.type });
      } catch (err) {
        console.warn('play-dl failed to create stream directly:', err && err.message);

        // Try play-dl video_info -> stream_from_info as a secondary fallback before ytdl.
        try {
          const info = await play.video_info(track.url);
          if (info) {
            try {
              const streamFromInfo = await play.stream_from_info(info);
              resource = createAudioResource(streamFromInfo.stream, { inputType: streamFromInfo.type });
              console.log('play-dl: stream_from_info succeeded');
            } catch (infoStreamErr) {
              console.warn('play-dl: stream_from_info failed:', infoStreamErr && infoStreamErr.message);
            }
          }
        } catch (infoErr) {
          console.warn('play-dl: video_info failed during fallback:', infoErr && infoErr.message);
        }

        if (!resource) {
          console.warn('Attempting ytdl-core fallback:');
        }

        // If the URL looks like YouTube, try ytdl-core as a fallback.
        const isYouTube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(track.url);
        if (isYouTube) {
          try {
            // Verify we can extract info first; this fails fast if YouTube format changed or URL invalid.
            await ytdl.getInfo(track.url);
            const ytStream = ytdl(track.url, { filter: 'audioonly', highWaterMark: 1 << 25 });

            // Attach an error handler to the ytdl stream so we can log and skip on stream errors.
            ytStream.on('error', streamErr => {
              console.error('ytdl stream error:', streamErr);
            });

            resource = createAudioResource(ytStream, { inputType: StreamType.Arbitrary });
          } catch (ytdlErr) {
            console.warn('ytdl-core fallback failed (getInfo/stream):', ytdlErr && ytdlErr.message ? ytdlErr.message : ytdlErr);

            // Try system yt-dlp (external binary) as a last-resort fallback.
            // Use our runtime downloader/ensurer to get a usable binary path (system PATH or downloaded into .cache).
            try {
              const { ensureYtDlp } = require('../utils/ytDlp');
              let ytDlpExecutable;
              try {
                ytDlpExecutable = await ensureYtDlp();
              } catch (ensureErr) {
                throw ensureErr;
              }

              const args = ['-o', '-', '-f', 'bestaudio[ext=webm]/bestaudio', '--no-playlist', track.url];

              const proc = spawn(ytDlpExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

              proc.stderr.on('data', data => {
                console.error('yt-dlp stderr:', data.toString());
              });

              proc.on('error', procErr => {
                console.error('yt-dlp spawn error:', procErr);
              });

              resource = createAudioResource(proc.stdout, { inputType: StreamType.Arbitrary });
              console.log('yt-dlp fallback: streaming from yt-dlp stdout');
            } catch (ytErr) {
              console.error('yt-dlp fallback failed or yt-dlp not available:', ytErr && ytErr.message ? ytErr.message : ytErr);
              if (queue.textChannel) {
                queue.textChannel.send({ embeds: [EmbedCreator.error('Playback Error', `Skipping track: could not extract stream for this YouTube URL.`)] });
              }
              this.handleTrackEnd(guildId);
              return;
            }
          }
        } else {
          // Not a YouTube URL and play-dl failed — rethrow to be handled by outer catch.
          throw err;
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
      queue.player.stop();
      queue.connection.destroy();
      this.queues.delete(guildId);
      return true;
    }
    return false;
  }

  skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player && queue.isPlaying) {
      queue.player.stop();
      return true;
    }
    return false;
  }
}

module.exports = new MusicPlayer();
