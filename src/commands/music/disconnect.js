const { SlashCommandBuilder } = require('discord.js');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect the bot from the voice channel'),
  prefixCommand: true,
  aliases: ['dc', 'leave'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    
    if (isSlash) await interaction.deferReply();
    
    const member = isSlash ? interaction.member : interaction.member;

    if (!member.voice.channel) {
      const embed = EmbedCreator.error('Not in Voice Channel', 'You need to be in a voice channel!');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const success = musicPlayer.disconnect(member.guild.id);

    if (success) {
      const embed = EmbedCreator.success('Disconnected', '👋 Disconnected from the voice channel.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } else {
      const embed = EmbedCreator.error('Error', 'I am not connected to a voice channel.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }
  }
};
