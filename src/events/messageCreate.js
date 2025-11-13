const config = require('../../config/config');
const dataStore = require('../database/LocalDataStore');
const EmbedCreator = require('../utils/embeds');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    if (message.channel.type === 1) {
      const attachments = message.attachments.map(att => ({
        name: att.name,
        url: att.url,
        size: att.size
      }));

      await dataStore.saveDM(
        message.author.id,
        message.author.username,
        message.content,
        attachments
      );

      console.log(`📩 DM from ${message.author.tag}: ${message.content}`);
    }

    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) || 
                   client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command || !command.prefixCommand) return;

    try {
      await command.execute(message, args, client);
      await dataStore.updateStats('commandsExecuted', 1);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      
      try {
        const embed = EmbedCreator.error('Command Error', 'There was an error executing this command.');
        await message.reply({ embeds: [embed] });
      } catch (replyError) {
        console.error('Could not send error message (possibly missing permissions):', replyError.message);
      }
    }
  }
};
