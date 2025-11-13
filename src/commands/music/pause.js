const { SlashCommandBuilder } = require('discord.js');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the currently playing song'),
  prefixCommand: true,
  aliases: [],
  async execute(interaction, args, client) {
    const isSlash = !args;
    
    if (isSlash) await interaction.deferReply();
    
    const member = isSlash ? interaction.member : interaction.member;

    if (!member.voice.channel) {
      const embed = EmbedCreator.error('Not in Voice Channel', 'You need to be in a voice channel!');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const queue = musicPlayer.getQueue(member.guild.id);

    if (!queue.isPlaying) {
      const embed = EmbedCreator.error('Nothing Playing', 'There is nothing playing right now.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const success = musicPlayer.pause(member.guild.id);

    if (success) {
      const embed = EmbedCreator.success('Paused', '⏸️ Paused the music.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } else {
      const embed = EmbedCreator.error('Error', 'Could not pause the music.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }
  }
};
