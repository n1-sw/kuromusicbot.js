const { MessageFlags } = require('discord.js');
const dataStore = require('../database/LocalDataStore');
const EmbedCreator = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction, null, client);
      await dataStore.updateStats('commandsExecuted', 1);
    } catch (error) {
      console.error(`Error executing slash command ${interaction.commandName}:`, error);
      
      try {
        const embed = EmbedCreator.error('Command Error', 'There was an error executing this command.');
        
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
      } catch (replyError) {
        console.error('Could not send error message (possibly missing permissions):', replyError.message);
      }
    }
  }
};
