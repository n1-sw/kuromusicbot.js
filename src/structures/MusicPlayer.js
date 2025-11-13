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
        console.error('Invalid track data when attempting to play:', track);
        if (queue.textChannel) {
          queue.textChannel.send({
            embeds: [EmbedCreator.error('Playback Error', 'Track URL is missing or invalid. Skipping to next track.')] 
          });
        }
        this.handleTrackEnd(guildId);
        return;
      }

      const isYouTube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(track.url);
      let resource;

      // For YouTube URLs, use optimized extraction strategy
      if (isYouTube) {
        // Try yt-dlp first as it's most reliable for YouTube
        try {
          const { ensureYtDlp } = require('../utils/ytDlp');
          const ytDlpExecutable = await ensureYtDlp();

          const args = [
            '-o', '-',
            '-f', 'bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio',
            '--no-playlist',
            '--quiet',
            '--no-warnings',
            '--extract-audio',
            '--audio-quality', '0',
            track.url
          ];

          const proc = spawn(ytDlpExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

          // Store the process for cleanup
          queue.ytDlpProcess = proc;

          // Clean up process on exit
          proc.on('exit', (code) => {
            if (queue.ytDlpProcess === proc) {
              queue.ytDlpProcess = null;
            }
          });

          proc.on('error', (err) => {
            console.error('yt-dlp process error:', err);
            if (queue.ytDlpProcess === proc) {
              queue.ytDlpProcess = null;
            }
          });

          proc.stderr.on('data', () => {});

          resource = createAudioResource(proc.stdout, { 
            inputType: StreamType.Arbitrary,
            inlineVolume: true
          });

          // Clean up the process when the resource finishes
          resource.playStream.on('end', () => {
            queue.cleanupProcess();
          });

          resource.playStream.on('error', () => {
            queue.cleanupProcess();
          });

          console.log('✓ Using yt-dlp for high-quality audio extraction');
        } catch (ytDlpErr) {
          console.warn('yt-dlp extraction failed, trying play-dl:', ytDlpErr && ytDlpErr.message);

          // Fallback to play-dl
          try {
            const stream = await play.stream(track.url, { quality: 2 });
            resource = createAudioResource(stream.stream, { 
              inputType: stream.type,
              inlineVolume: true
            });
            console.log('✓ Using play-dl');
          } catch (playDlErr) {
            console.warn('play-dl failed, trying ytdl-core:', playDlErr && playDlErr.message);

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
              console.log('✓ Using ytdl-core');
            } catch (ytdlErr) {
              console.error('All extraction methods failed:', ytdlErr && ytdlErr.message);
              if (queue.textChannel) {
                queue.textChannel.send({ 
                  embeds: [EmbedCreator.error('Playback Error', 'Could not extract audio stream. YouTube may be blocking requests.')] 
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
          const stream = await play.stream(track.url, { quality: 2 });
          resource = createAudioResource(stream.stream, { 
            inputType: stream.type,
            inlineVolume: true
          });
        } catch (err) {
          console.error('play-dl failed for non-YouTube URL:', err && err.message);
          if (queue.textChannel) {
            queue.textChannel.send({ 
              embeds: [EmbedCreator.error('Playback Error', 'Could not play this URL.')] 
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
