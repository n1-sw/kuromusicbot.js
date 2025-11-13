const { SlashCommandBuilder } = require('discord.js');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s ping'),
  prefixCommand: true,
  aliases: [],
  async execute(interaction, args, client) {
    const isSlash = !args;

    const embed = EmbedCreator.info(
      '🏓 Pong!',
      `Latency: ${Date.now() - (isSlash ? interaction.createdTimestamp : interaction.createdTimestamp)}ms\nAPI Latency: ${Math.round(client.ws.ping)}ms`
    );

    return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
  }
};
