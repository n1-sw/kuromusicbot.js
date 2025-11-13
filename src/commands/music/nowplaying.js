const { SlashCommandBuilder } = require('discord.js');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing song'),
  prefixCommand: true,
  aliases: ['np', 'current'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    const member = isSlash ? interaction.member : interaction.member;

    const queue = musicPlayer.getQueue(member.guild.id);

    if (!queue.currentTrack || !queue.isPlaying) {
      const embed = EmbedCreator.error('Nothing Playing', 'There is nothing playing right now.');
      return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const embed = EmbedCreator.nowPlaying(queue.currentTrack, queue.currentTrack.requestedBy);
    
    if (queue.loopMode !== 'off') {
      embed.addFields({ 
        name: '🔁 Loop Mode', 
        value: queue.loopMode === 'track' ? 'Track Loop' : 'Queue Loop', 
        inline: true 
      });
    }

    return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
  }
};
