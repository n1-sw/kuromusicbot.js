const { ActivityType } = require('discord.js');
const config = require('../../config/config');
const dataStore = require('../database/LocalDataStore');

module.exports = {
  // v14+ renamed the gateway READY event to 'clientReady' to avoid confusion
  // with the gateway-level READY. Use 'clientReady' to avoid the deprecation warning.
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    
    await dataStore.init();

    let statusIndex = 0;
    const updateStatus = () => {
      const status = config.statuses[statusIndex];
      const activityType = {
        'PLAYING': ActivityType.Playing,
        'LISTENING': ActivityType.Listening,
        'STREAMING': ActivityType.Streaming,
        'WATCHING': ActivityType.Watching
      }[status.type] || ActivityType.Playing;

      const activity = {
        name: status.name,
        type: activityType
      };

      if (status.url) {
        activity.url = status.url;
      }

      client.user.setPresence({
        activities: [activity],
        status: 'online'
      });

      statusIndex = (statusIndex + 1) % config.statuses.length;
    };

    updateStatus();
    setInterval(updateStatus, 15000);

    await dataStore.updateStats('botStarts', 1);
  }
};
