const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config/config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ],
  partials: ['CHANNEL', 'MESSAGE']
});

client.commands = new Collection();

function loadCommands() {
  const commandFolders = ['music', 'utility'];
  const commands = [];

  for (const folder of commandFolders) {
    const commandPath = path.join(__dirname, 'src', 'commands', folder);
    const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandPath, file);
      const command = require(filePath);

      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
      }
    }
  }

  return commands;
}

function loadEvents() {
  const eventsPath = path.join(__dirname, 'src', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log(`✅ Loaded event: ${event.name}`);
  }
}

async function registerSlashCommands(commands) {
  try {
    console.log('🔄 Registering slash commands...');

    const rest = new REST({ version: '10' }).setToken(config.token);

    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );

    console.log('✅ Successfully registered slash commands globally');
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
}

async function main() {
  try {
    if (!config.token) {
      console.error('❌ ERROR: DISCORD_TOKEN is not set in environment variables!');
      console.error('Please set your Discord bot token in the .env file');
      process.exit(1);
    }

    if (!config.clientId) {
      console.error('❌ ERROR: CLIENT_ID is not set in environment variables!');
      console.error('Please set your Discord client ID in the .env file');
      process.exit(1);
    }

    // Validate that clientId is a Discord snowflake (numeric string).
    if (!/^\d+$/.test(config.clientId)) {
      console.error('❌ ERROR: CLIENT_ID is not a valid Discord snowflake (should be numeric).');
      console.error('Please set CLIENT_ID to your numeric application ID from the Discord Developer Portal.');
      process.exit(1);
    }

    console.log('🤖 Starting Discord Music Bot...');

    // Optional system dependency: yt-dlp.
    // Respect `DISABLE_YTDLP_CHECK=1` (or `SKIP_YTDLP_CHECK=1`) to skip any startup checks.
    // Otherwise, attempt a best-effort (non-blocking) resolution using our `ensureYtDlp()` helper.
    try {
      if (process.env.DISABLE_YTDLP_CHECK === '1' || process.env.SKIP_YTDLP_CHECK === '1') {
        console.log('ℹ️ yt-dlp startup check disabled via environment variable');
      } else {
        const { ensureYtDlp } = require('./src/utils/ytDlp');

        // Call without awaiting so startup isn't blocked. Only log a short message on failure.
        ensureYtDlp()
          .then((exePath) => {
            if (exePath) console.log(`✓ yt-dlp available at ${exePath}`);
          })
          .catch(() => {
            console.log('ℹ️ yt-dlp not available; falling back to alternative extractors');
          });
      }
    } catch (err) {
      // non-fatal — keep startup quiet on environments where require may fail
    }

    const commands = loadCommands();
    loadEvents();

    await registerSlashCommands(commands);

    await client.login(config.token);
  } catch (error) {
    console.error('❌ Fatal error during startup:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

client.on('error', error => {
  console.error('❌ Client error:', error);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  const dataStore = require('./src/database/LocalDataStore');
  await dataStore.disconnect();
  client.destroy();
  process.exit(0);
});

main();
