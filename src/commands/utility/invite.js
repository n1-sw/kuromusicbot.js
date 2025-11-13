const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the bot invite link'),
  prefixCommand: true,
  aliases: ['inv'],
  async execute(interaction, args, client) {
    const isSlash = !args;

    const permissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.UseVAD
    ];

    const permissionValue = permissions.reduce((acc, perm) => acc | perm, 0n);

    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=${permissionValue}&scope=bot%20applications.commands`;

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('📨 Invite Me!')
      .setDescription(`[Click here to invite me to your server!](${inviteLink})`)
      .addFields(
        { name: '🎵 Features', value: 'Music playback, Queue management, Loop modes', inline: false },
        { name: '🔗 Supported Platforms', value: 'YouTube, Spotify', inline: false }
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: config.embedFooter })
      .setTimestamp();

    return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
  }
};
