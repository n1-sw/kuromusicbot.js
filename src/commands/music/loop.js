const { SlashCommandBuilder } = require('discord.js');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set loop mode')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
    ),
  prefixCommand: true,
  aliases: ['repeat'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    const member = isSlash ? interaction.member : interaction.member;

    if (!member.voice.channel) {
      const embed = EmbedCreator.error('Not in Voice Channel', 'You need to be in a voice channel!');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const queue = musicPlayer.getQueue(member.guild.id);

    if (!queue.currentTrack) {
      const embed = EmbedCreator.error('Nothing Playing', 'There is nothing playing right now.');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const mode = isSlash ? interaction.options.getString('mode') : args[0]?.toLowerCase();

    if (!mode || !['off', 'track', 'queue'].includes(mode)) {
      const embed = EmbedCreator.error('Invalid Mode', 'Please specify a valid loop mode: `off`, `track`, or `queue`');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    queue.setLoop(mode);

    const modeText = {
      'off': '🔁 Loop disabled',
      'track': '🔂 Looping current track',
      'queue': '🔁 Looping queue'
    }[mode];

    const embed = EmbedCreator.success('Loop Mode Updated', modeText);
    return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
  }
};
