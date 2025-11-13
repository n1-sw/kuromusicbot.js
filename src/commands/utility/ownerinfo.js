const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ownerinfo')
    .setDescription('Display bot owner information'),
  prefixCommand: true,
  aliases: ['owner'],
  async execute(interaction, args, client) {
    const isSlash = !args;

    try {
      const owner = await client.users.fetch(config.ownerId);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('👑 Bot Owner Information')
        .setThumbnail(owner.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '📛 Username', value: owner.username, inline: true },
          { name: '🆔 User ID', value: owner.id, inline: true },
          { name: '📅 Account Created', value: `<t:${Math.floor(owner.createdTimestamp / 1000)}:R>`, inline: false }
        )
        .setFooter({ text: config.embedFooter })
        .setTimestamp();

      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Error')
        .setDescription('Could not fetch owner information.')
        .setFooter({ text: config.embedFooter })
        .setTimestamp();

      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }
  }
};
