const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands'),
  prefixCommand: true,
  aliases: ['commands', 'h'],
  async execute(interaction, args, client) {
    const isSlash = !args;

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('🎵 Music Bot Commands')
      .setDescription('Here are all the available commands:')
      .addFields(
        {
          name: '🎵 Music Commands',
          value: `\`play [song/url]\` - Play a song from YouTube or Spotify
\`pause\` - Pause the current song
\`resume\` - Resume the paused song
\`skip\` - Skip the current song
\`stop\` - Stop the music and clear queue
\`queue\` - Show the music queue
\`nowplaying\` - Show currently playing song
\`loop [off/track/queue]\` - Set loop mode`,
          inline: false
        },
        {
          name: '⚙️ Utility Commands',
          value: `\`ping\` - Check bot latency
\`help\` - Show this message
\`botinfo\` - Display bot information
\`ownerinfo\` - Display owner information
\`invite\` - Get bot invite link`,
          inline: false
        },
        {
          name: '💡 Tips',
          value: `• You can use slash commands (\`/\`) or prefix commands (\`${config.prefix}\`)
• Supports YouTube URLs, Spotify URLs, and search queries
• Supports playlists from both YouTube and Spotify`,
          inline: false
        }
      )
      .setFooter({ text: config.embedFooter })
      .setTimestamp();

    return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
  }
};
