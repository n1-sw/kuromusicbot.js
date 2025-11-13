require('dotenv').config();

// IMPORTANT: Do NOT hard-code your bot token or client ID here in source control.
// Set them in your environment (e.g. a .env file) as DISCORD_TOKEN and CLIENT_ID.
// CLIENT_ID must be the numeric application ID (a Discord snowflake string).
module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  ownerId: process.env.OWNER_ID || '',
  prefix: process.env.PREFIX || '!',
  mongoUri: process.env.MONGODB_URI || 'mongodb+srv://abidhasansajid03:pe9_sYW5Xum7G!Z@kuro.oapk5py.mongodb.net/',
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  embedColor: '#FF0080',
  embedFooter: '🎵 Music Bot',
  statuses: [
    { name: 'spotify.com', type: 'LISTENING' },
    { name: 'youtube.com', type: 'WATCHING' },
    { name: 'your favorite songs', type: 'PLAYING' },
    { name: 'beats & vibes', type: 'STREAMING', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
  ]
};
