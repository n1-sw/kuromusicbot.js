# Wispbyte Deployment Checklist — Option 3 (Recommended for most users)

This checklist guides you through deploying the Discord Music Bot on Wispbyte with yt-dlp auto-download at startup (no Docker required, no manual ffmpeg install needed).

## Pre-Deployment

- [ ] You have a Discord bot token and Client ID from the [Discord Developer Portal](https://discord.com/developers/applications).
- [ ] You have SSH/Git access to Wispbyte or can push your repository to a Git provider Wispbyte can pull from.
- [ ] Your Wispbyte project is configured to run Node.js apps.

## Step 1: Push code to Wispbyte's Git

1. If your code is on GitHub/GitLab/Gitea, ensure Wispbyte can access it:
   ```bash
   git remote -v  # Show your remotes
   ```

2. If you need to add or update the remote for Wispbyte:
   ```bash
   git remote set-url origin https://your-wispbyte-git-url
   git push origin main
   ```

3. Wispbyte will automatically pull and run the startup commands defined in your project configuration (usually `npm install && node index.js`).

## Step 2: Set Environment Variables in Wispbyte Dashboard

In your Wispbyte project settings, add these environment variables:

| Variable | Value | Required |
|----------|-------|----------|
| `DISCORD_TOKEN` | Your bot token from Discord Developer Portal | ✅ Yes |
| `CLIENT_ID` | Your bot's Client ID from Discord Developer Portal | ✅ Yes |
| `OWNER_ID` | Your Discord user ID (optional, for owner-only commands) | ❌ No |
| `PREFIX` | Command prefix (default: `!`) | ❌ No |
| `NODE_ENV` | Set to `production` to suppress debug logs | ❌ No |

**Do NOT set** `DISABLE_YTDLP_CHECK` or `YTDLP_FORCE_EXTRACT_AUDIO` — the bot will use defaults:
- Default behavior: yt-dlp will attempt to download and cache itself at startup if not found on PATH.
- This usually works on Wispbyte because the container typically allows downloads to `~/.cache/`.

## Step 3: Start the Service

1. In the Wispbyte dashboard, click **Start** or **Deploy**.
2. Wait for the bot to start. Initial startup may take 30–60 seconds while yt-dlp downloads (first run only).
3. Check the **Logs** tab. You should see:
   ```
   🤖 Starting Discord Music Bot...
   ✅ Loaded command: play
   ✅ Loaded command: queue
   ...
   ✅ Successfully registered slash commands globally
   yt-dlp downloaded and cached at /home/container/.cache/discord-music-bot/yt-dlp
   ✓ yt-dlp available at /home/container/.cache/discord-music-bot/yt-dlp
   ✅ Logged in as YourBotName#0000
   📊 Serving 1 servers
   ```

4. If you see those messages, the bot is running successfully.

## Step 4: Test the Bot

1. Join a voice channel in your Discord server.
2. Use a bot command:
   ```
   /play moho
   ```
3. The bot should search YouTube and play the song. Watch the logs for messages like:
   ```
   🔍 Searching for: moho
   ✓ Found video: AFTERMATH l MOHO (OFFICIAL MUSIC VIDEO)
   🎵 Now playing: AFTERMATH l MOHO (OFFICIAL MUSIC VIDEO)
   📎 Track URL: https://www.youtube.com/watch?v=...
   🎵 Attempting to extract with yt-dlp...
   ✓ Using yt-dlp for audio extraction
   ```

4. If playback succeeds, audio should play in the voice channel. You're done!

## Troubleshooting

### Bot doesn't start or logs show "yt-dlp not available"

**Problem:** The bot couldn't download yt-dlp.

**Solutions:**
- Check if Wispbyte allows outbound HTTPS (required to download yt-dlp from GitHub). If not, use Option 1 (Dockerfile).
- Or manually set `DISABLE_YTDLP_CHECK=1` and accept fallback extractors (`play-dl`, `ytdl-core`).

### Some videos fail to play / "Extraction Failed" error

**Cause:** yt-dlp, play-dl, and ytdl-core all failed to extract audio (video may be restricted, geo-blocked, or extractor outdated).

**Solutions:**
1. Check the logs for extractor-specific errors.
2. Try a different video to narrow down if it's a specific-video issue or a general extractor issue.
3. If you own the Wispbyte instance and can install ffmpeg, switch to Option 1 (Dockerfile) for better extraction reliability.

### "yt-dlp failed with exit code: null" or other exit/signal errors

**Cause:** yt-dlp started but exited unexpectedly (usually missing system dependencies like ffmpeg for audio conversion).

**Solutions:**
1. Use Option 1 (Dockerfile) which includes ffmpeg.
2. Or contact Wispbyte support to ask if they can install ffmpeg in the container.

### Bot is running but not responding to commands

**Cause:** Bot is logged in but slash commands may not have synced.

**Solutions:**
1. Wait 1–2 minutes for Discord to sync commands.
2. Check the bot has permission to send messages in the server.
3. Restart the bot to force a command resync.

## Next Steps

- **Invite the bot to your server:** Use the OAuth2 URL from Discord Developer Portal with scopes `bot` + `applications.commands`.
- **Customize settings:** Modify `config/config.js` or pass environment variables for prefix, colors, etc.
- **Monitor logs:** Regularly check Wispbyte logs to catch issues early.

## Support

If you encounter issues:
1. Check the logs in the Wispbyte dashboard.
2. Search for the exact error message in the `MusicPlayer.js` or `ytDlp.js` source code.
3. Verify environment variables are set correctly.
4. Try Option 1 (Dockerfile) for a fully self-contained setup.

---

**Summary:** Option 3 lets the bot download yt-dlp at startup. No Docker knowledge required; just set your Discord token and Client ID in Wispbyte, and deploy. If downloads are blocked, switch to Option 1.
