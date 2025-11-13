const { SlashCommandBuilder } = require('discord.js');
const play = require('play-dl');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');
const config = require('../../../config/config');

// Helper: try several search strategies to find a playable YouTube/video result for a track/query.
async function findPlayableVideo(query, maxAttempts = 5) {
  if (!query || typeof query !== 'string') return null;

  // Normalize query
  const baseQuery = query.trim();

  // Candidate query variations to increase chance of matching the official video
  const variants = [
    baseQuery,
    `${baseQuery} official audio`,
    `${baseQuery} official music video`,
    `${baseQuery} lyric video`,
    `${baseQuery} audio`,
    baseQuery.replace(/\(.*?\)/g, '').trim() // remove parentheses
  ];

  // Try progressively more results per query to find a valid URL
  for (const q of variants) {
    try {
      const limit = Math.min(maxAttempts, 5);
      const results = await play.search(q, { limit });
      if (results && results.length > 0) {
        // Prefer the first result that has a usable URL
        for (const r of results) {
          const url = r.url || r.permalink || '';
          if (typeof url === 'string' && url.trim() !== '') return r;
        }
      }
    } catch (err) {
      // ignore and try next variant
      console.warn('Search attempt failed for query', q, err && err.message);
    }
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube or Spotify')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)
    ),
  prefixCommand: true,
  aliases: ['p'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    const member = isSlash ? interaction.member : interaction.member;
    const channel = isSlash ? interaction.channel : interaction.channel;

    if (!member.voice.channel) {
      const embed = EmbedCreator.error('Not in Voice Channel', 'You need to be in a voice channel to play music!');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const query = isSlash ? interaction.options.getString('query') : args.join(' ');

    if (!query) {
      const embed = EmbedCreator.error('No Query', 'Please provide a song name or URL!');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    if (isSlash) await interaction.deferReply();

    try {
      await play.setToken({
        spotify: {
          client_id: config.spotifyClientId,
          client_secret: config.spotifyClientSecret
        }
      });

      let tracks = [];
      let playlistName = null;

      if (play.yt_validate(query) === 'video') {
        const info = await play.video_info(query);
        const vd = info.video_details;
        tracks.push({
          title: vd.title || 'Unknown Title',
          url: vd.url,
          duration: vd.durationInSec || 0,
          thumbnail: (vd.thumbnails && vd.thumbnails.length > 0) ? vd.thumbnails[0].url : 'https://via.placeholder.com/120',
          author: vd.channel?.name || 'Unknown Artist',
          requestedBy: member.user.id
        });
      } else if (play.yt_validate(query) === 'playlist') {
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        
        playlistName = playlist.title;
        tracks = videos.slice(0, 50).map(video => ({
          title: video.title || 'Unknown Title',
          url: video.url,
          duration: video.durationInSec || 0,
          thumbnail: (video.thumbnails && video.thumbnails.length > 0) ? video.thumbnails[0].url : 'https://via.placeholder.com/120',
          author: video.channel?.name || 'Unknown Artist',
          requestedBy: member.user.id
        }));
      } else if (play.sp_validate(query) === 'track') {
        const spotifyData = await play.spotify(query);
        // Try to find a playable video for this Spotify track using robust search
        const searchQuery = `${spotifyData.name} ${spotifyData.artists[0].name}`;
        const video = await findPlayableVideo(searchQuery, 5);
        
        if (video) {
          tracks.push({
            title: video.title || spotifyData.name,
            url: video.url || video.permalink || '',
            duration: video.durationInSec || 0,
            thumbnail: (video.thumbnails && video.thumbnails.length > 0) ? video.thumbnails[0].url : 'https://via.placeholder.com/120',
            author: video.channel?.name || spotifyData.artists[0].name,
            requestedBy: member.user.id
          });
        }
      } else if (play.sp_validate(query) === 'playlist' || play.sp_validate(query) === 'album') {
        const spotifyData = await play.spotify(query);
        playlistName = spotifyData.name;
        
        for (const track of spotifyData.tracks.slice(0, 50)) {
          const searchQuery = `${track.name} ${track.artists[0].name}`;
          const video = await findPlayableVideo(searchQuery, 5);
          if (video) {
            tracks.push({
              title: video.title || track.name,
              url: video.url || video.permalink || '',
              duration: video.durationInSec || 0,
              thumbnail: (video.thumbnails && video.thumbnails.length > 0) ? video.thumbnails[0].url : 'https://via.placeholder.com/120',
              author: video.channel?.name || track.artists[0].name,
              requestedBy: member.user.id
            });
          }
        }
      } else {
        // General search: use robust resolver
        const video = await findPlayableVideo(query, 5);

        if (!video) {
          const embed = EmbedCreator.error('No Results', 'No results found for your query.');
          return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
        }

        tracks.push({
          title: video.title || 'Unknown Title',
          url: video.url || video.permalink || '',
          duration: video.durationInSec || 0,
          thumbnail: (video.thumbnails && video.thumbnails.length > 0) ? video.thumbnails[0].url : 'https://via.placeholder.com/120',
          author: video.channel?.name || 'Unknown Artist',
          requestedBy: member.user.id
        });
      }

      tracks = tracks.filter(track => track.url && track.url.length > 0 && track.url !== 'undefined');

      if (tracks.length === 0) {
        const embed = EmbedCreator.error('No Tracks', 'Could not find any valid tracks to play.');
        return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
      }

      const queue = musicPlayer.getQueue(member.guild.id);

      if (!queue.connection) {
        await musicPlayer.createConnection(member, channel);
      }

      if (tracks.length === 1) {
        queue.addTrack(tracks[0]);
        const embed = EmbedCreator.music(
          'Added to Queue',
          `**[${tracks[0].title}](${tracks[0].url})**\nDuration: ${EmbedCreator.formatDuration(tracks[0].duration)}`,
          tracks[0].thumbnail
        );
        
        if (isSlash) {
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.reply({ embeds: [embed] });
        }
      } else {
        queue.addTracks(tracks);
        const embed = EmbedCreator.music(
          'Playlist Added',
          `Added **${tracks.length}** tracks from **${playlistName}** to the queue.`
        );
        
        if (isSlash) {
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.reply({ embeds: [embed] });
        }
      }

      if (!queue.isPlaying) {
        musicPlayer.play(member.guild.id);
      }

    } catch (error) {
      console.error('Play command error:', error);
      const embed = EmbedCreator.error('Error', `Failed to play music: ${error.message}`);
      
      if (isSlash) {
        if (interaction.deferred) {
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.reply({ embeds: [embed] });
        }
      } else {
        await interaction.reply({ embeds: [embed] });
      }
    }
  }
};
