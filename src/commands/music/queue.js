const { SlashCommandBuilder } = require('discord.js');
const musicPlayer = require('../../structures/MusicPlayer');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),
  prefixCommand: true,
  aliases: ['q'],
  async execute(interaction, args, client) {
    const isSlash = !args;
    
    if (isSlash) await interaction.deferReply();
    
    const member = isSlash ? interaction.member : interaction.member;

    const queue = musicPlayer.getQueue(member.guild.id);

    if (!queue.currentTrack) {
      const embed = EmbedCreator.error('Empty Queue', 'There is nothing playing right now.');
      return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    }

    const embed = EmbedCreator.queue(queue.getQueue(), queue.currentTrack);
    
    if (queue.loopMode !== 'off') {
      embed.addFields({ 
        name: '🔁 Loop Mode', 
        value: queue.loopMode === 'track' ? 'Track Loop' : 'Queue Loop', 
        inline: true 
      });
    }

    return isSlash ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
  }
};
