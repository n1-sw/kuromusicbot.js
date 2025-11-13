const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const config = require('../../../config/config');
const mongodb = require('../../database/mongodb');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display bot information'),
  prefixCommand: true,
  aliases: ['info', 'bi'],
  async execute(interaction, args, client) {
    const isSlash = !args;

    const stats = await mongodb.getStats();
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor(uptime / 3600) % 24;
    const minutes = Math.floor(uptime / 60) % 60;
    const seconds = Math.floor(uptime % 60);

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('🤖 Bot Information')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '📛 Bot Name', value: client.user.username, inline: true },
        { name: '🆔 Bot ID', value: client.user.id, inline: true },
        { name: '📊 Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: '👥 Users', value: `${client.users.cache.size}`, inline: true },
        { name: '📝 Commands Executed', value: `${stats.commandsExecuted || 0}`, inline: true },
        { name: '⏰ Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: '📚 Discord.js', value: `v${version}`, inline: true },
        { name: '🟢 Node.js', value: process.version, inline: true },
        { name: '💾 Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true }
      )
      .setFooter({ text: config.embedFooter })
      .setTimestamp();

    return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
  }
};
