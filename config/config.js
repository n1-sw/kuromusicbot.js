require("dotenv").config();

module.exports = {
  token:
    process.env.DISCORD_TOKEN ||
    "MTQzODQ0MTg3MTE4NDQ5NDY1Mw.Gikq_H.cDHKoWp-iYJK6I6Wh3HtRHkgKKjLFah5NIsMfM",
  clientId: process.env.CLIENT_ID || "1438441871184494653",
  ownerId: process.env.OWNER_ID || "698131338846404609",
  prefix: process.env.PREFIX || "!",
  spotifyClientId:
    process.env.SPOTIFY_CLIENT_ID || "14b939dcdf0c409ba048fee293da4719",
  spotifyClientSecret:
    process.env.SPOTIFY_CLIENT_SECRET || "06f9cfa7bd7b4c89a09424f410f362a7",
  embedColor: "#FF0080",
  embedFooter: "🎵 Music Bot",
  statuses: [
    { name: "spotify.com", type: "LISTENING" },
    { name: "youtube.com", type: "WATCHING" },
    { name: "your favorite songs", type: "PLAYING" },
    {
      name: "beats & vibes",
      type: "STREAMING",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  ],
};
