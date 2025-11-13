const mongodb = require('../database/mongodb');
const EmbedCreator = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction, null, client);
      await mongodb.updateStats('commandsExecuted', 1);
    } catch (error) {
      console.error(`Error executing slash command ${interaction.commandName}:`, error);
      
      try {
        const embed = EmbedCreator.error('Command Error', 'There was an error executing this command.');
        
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ embeds: [embed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      } catch (replyError) {
        console.error('Could not send error message (possibly missing permissions):', replyError.message);
      }
    }
  }
};
