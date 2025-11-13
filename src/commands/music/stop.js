const { SlashCommandBuilder } = require('discord.js');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue'),
  prefixCommand: true,
  aliases: ['leave', 'disconnect'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    
    if (isSlash) await interaction.deferReply();
    
    const member = isSlash ? interaction.member : interaction.member;

    if (!member.voice.channel) {
      const embed = EmbedCreator.error('Not in Voice Channel', 'You need to be in a voice channel!');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const success = musicPlayer.stop(member.guild.id);

    if (success) {
      const embed = EmbedCreator.success('Stopped', '⏹️ Stopped the music and cleared the queue.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } else {
      const embed = EmbedCreator.error('Error', 'There is no active music session.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }
  }
};
