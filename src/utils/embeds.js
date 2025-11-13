const { EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

class EmbedCreator {
  static success(title, description) {
    return new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`✅ ${title}`)
      .setDescription(description)
      .setFooter({ text: config.embedFooter })
      .setTimestamp();
  }

  static error(title, description) {
    return new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle(`❌ ${title}`)
      .setDescription(description)
      .setFooter({ text: config.embedFooter })
      .setTimestamp();
  }

  static info(title, description) {
    return new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: config.embedFooter })
      .setTimestamp();
  }

  static music(title, description, thumbnail = null) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`🎵 ${title}`)
      .setDescription(description)
      .setFooter({ text: config.embedFooter })
      .setTimestamp();
    
    if (thumbnail) embed.setThumbnail(thumbnail);
    return embed;
  }

  static nowPlaying(track, requestedBy) {
    return new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('🎶 Now Playing')
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: '🎤 Artist', value: track.author || 'Unknown', inline: true },
        { name: '⏱️ Duration', value: this.formatDuration(track.duration), inline: true },
        { name: '👤 Requested by', value: `<@${requestedBy}>`, inline: true }
      )
      .setThumbnail(track.thumbnail)
      .setFooter({ text: config.embedFooter })
      .setTimestamp();
  }

  static queue(queue, currentTrack) {
    const queueList = queue.slice(0, 10).map((track, index) => 
      `${index + 1}. **[${track.title}](${track.url})** - ${this.formatDuration(track.duration)}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('📜 Music Queue')
      .setDescription(
        `**Now Playing:**\n🎵 [${currentTrack.title}](${currentTrack.url})\n\n**Up Next:**\n${queueList || 'No songs in queue'}`
      )
      .setFooter({ text: `${queue.length > 10 ? `And ${queue.length - 10} more...` : ''} ${config.embedFooter}` })
      .setTimestamp();

    return embed;
  }

  static formatDuration(seconds) {
    if (!seconds || seconds === 0) return 'Live';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}

module.exports = EmbedCreator;
