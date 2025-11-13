# Discord Music Bot - Fix Guide

## Common Issues & Solutions

### Voice Connection Error: "Cannot perform IP discovery – socket closed"

**What it means:** The bot can't establish a UDP connection to Discord's voice servers. This is usually a network/firewall issue, not a code problem.

**Solutions:**

1. **Check your network:**
   - Ensure your host/machine has outbound UDP access (Discord uses ephemeral UDP ports).
   - If behind a corporate firewall/proxy, ask your network admin to allow UDP traffic to Discord servers.
   - On local testing: try from a different network or VPN.

2. **Ensure opus codec is installed:**
   ```bash
   npm install opusscript
   # or (for better performance, requires system opus library):
   npm install @discordjs/opus
   ```

3. **Update @discordjs/voice (may fix newer Discord API issues):**
   ```bash
   npm update @discordjs/voice
   ```

4. **Diagnose with a simple test:**
   ```bash
   node -e "const v = require('@discordjs/voice'); console.log('Voice library loaded OK');"
   ```

5. **Check Discord bot permissions:**
   - Ensure your bot has "Connect" and "Speak" permissions in the target voice channel.
   - In Discord Server Settings > Roles, verify the bot's role has voice channel permissions.

### Music Extraction Errors: "Invalid URL" / "Could not extract functions"

**Fixed in this release:** The bot now uses a multi-layer fallback system:
- play-dl (primary extractor)
- ytdl-core (secondary fallback)
- yt-dlp (auto-downloaded, last-resort fallback)

The cached `yt-dlp` binary is stored in `~/.cache/discord-music-bot/yt-dlp` and auto-updates every 7 days.

### "not snowflake" error on startup

**Fixed in this release:** The bot now validates `CLIENT_ID` is numeric and fails fast with a clear error message if misconfigured.

Ensure your `.env` file has:
```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_numeric_application_id
```

The `CLIENT_ID` must be a numeric snowflake (digits only), found in Discord Developer Portal > Application > General Information.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   # Edit .env with your bot token and numeric client ID
   ```

3. **Run the bot:**
   ```bash
   node index.js
   ```

## Features

- **Multi-layer music extraction:** Automatically falls back through play-dl → ytdl-core → yt-dlp.
- **Auto-updating yt-dlp:** Keeps the fallback extractor fresh without manual intervention.
- **Graceful error handling:** Failed tracks are skipped with channel notifications instead of crashes.
- **Spotify support:** Maps Spotify tracks to YouTube for playback.
- **Robust search:** Uses multiple search strategies to find playable videos even when mapping Spotify to YouTube.
- **MongoDB logging:** Tracks stats (commands executed, bot starts, etc.).

## Troubleshooting

**Bot won't start:**
- Check `.env` file exists and `CLIENT_ID` is numeric.
- Verify `DISCORD_TOKEN` is valid and not expired.
- Check Node.js version (v18+ recommended).

**Music won't play:**
- Voice connection errors? See "Cannot perform IP discovery – socket closed" above.
- Track extraction failing? Check console logs for which extractor failed (play-dl, ytdl-core, or yt-dlp).
- Spotify links not working? Bot automatically searches YouTube; slow links may time out.

**Performance issues:**
- If downloads are slow, yt-dlp caches in `~/.cache/discord-music-bot/yt-dlp`. Delete it to force re-download.
- Large playlists (50+ tracks) may take time to map to YouTube.

## Environment Variables

See `.env.example` for all available options. Key variables:

- `DISCORD_TOKEN` — bot token from Discord Developer Portal
- `CLIENT_ID` — numeric application ID
- `OWNER_ID` — your Discord user ID (optional)
- `PREFIX` — text command prefix (default: `!`)
- `MONGODB_URI` — MongoDB connection string (optional, for stats logging)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` — Spotify API credentials (optional, improves Spotify track mapping)

## Architecture

- `src/commands/` — slash/text commands
- `src/structures/` — MusicPlayer, MusicQueue
- `src/utils/` — embeddings, yt-dlp downloader, helpers
- `src/events/` — Discord event handlers
- `src/database/` — MongoDB integration

## Development

Run tests:
```bash
node tests/ytdl_test.js
```

This tests play-dl, ytdl-core, and yt-dlp on a sample URL to verify extraction fallback chains.
