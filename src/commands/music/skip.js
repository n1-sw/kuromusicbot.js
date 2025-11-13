const { SlashCommandBuilder } = require('discord.js');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),
  prefixCommand: true,
  aliases: ['s'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    const member = isSlash ? interaction.member : interaction.member;

    if (!member.voice.channel) {
      const embed = EmbedCreator.error('Not in Voice Channel', 'You need to be in a voice channel!');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const queue = musicPlayer.getQueue(member.guild.id);

    if (!queue.isPlaying) {
      const embed = EmbedCreator.error('Nothing Playing', 'There is nothing playing to skip.');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const success = musicPlayer.skip(member.guild.id);

    if (success) {
      const embed = EmbedCreator.success('Skipped', '⏭️ Skipped the current song.');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } else {
      const embed = EmbedCreator.error('Error', 'Could not skip the song.');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }
  }
};
