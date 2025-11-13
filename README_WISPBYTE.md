# Deploying kuromusicbot.js to Wispbyte

This document covers deployment notes and environment variables useful when hosting on restricted platforms like Wispbyte where installing binaries or writing to arbitrary cache directories may be restricted.

## Recommended environment variables

- `DISABLE_YTDLP_CHECK=1` (or `SKIP_YTDLP_CHECK=1` / `DISABLE_YTDLP_DOWNLOAD=1`)
  - Prevents the bot from attempting to download `yt-dlp` at runtime. When set, the bot will only use a system `yt-dlp` if present in `PATH` and will otherwise fall back to `play-dl` / `ytdl-core`.

- `YTDLP_FORCE_EXTRACT_AUDIO=1` (optional)
  - When set to `1`, the bot will request `yt-dlp` to extract audio using `ffmpeg` (adds `--extract-audio`). This produces more compatible audio output but requires `ffmpeg` to be installed and available on `PATH` in the host/container. If `ffmpeg` is not present the bot will log a warning and fall back to streaming a native audio container.

- `DISCORD_TOKEN` and `CLIENT_ID` (required)
  - Set your bot credentials as usual in Wispbyte's environment settings.

- Other optional settings used by the bot can be configured as environment variables in `config/config.js` (e.g., `OWNER_ID`, `PREFIX`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`).

## Why this is needed on Wispbyte

Wispbyte is a shared hosting platform and may not allow executing package managers or writing to the filesystem during runtime. The bot previously tried a synchronous `which yt-dlp` check and attempted to download `yt-dlp` into `~/.cache/discord-music-bot/` if missing. That produced noisy warnings or failed writes on restricted hosts.

With the updated code, you can set `DISABLE_YTDLP_CHECK=1` to avoid any download attempts and suppress noisy startup warnings.

## Deploy steps (quick)

1. Push your project to the Git repository Wispbyte uses.
2. In your Wispbyte project dashboard, add environment variables:
   - `DISABLE_YTDLP_CHECK=1`
   - `DISCORD_TOKEN=your_token`
   - `CLIENT_ID=your_client_id`
3. Start the service in Wispbyte. Check the logs.

Expected log messages on startup:
- If `DISABLE_YTDLP_CHECK=1` is set: `ℹ️ yt-dlp startup check disabled via environment variable`
- If unset and system `yt-dlp` is not present: `ℹ️ yt-dlp not available; falling back to alternative extractors`
- If `yt-dlp` is found (system/cached): `✓ yt-dlp available at /path/to/yt-dlp`

## Notes on playback

- With downloads disabled and no system `yt-dlp`, the bot will use `play-dl` and `ytdl-core` as fallback extractors. These work for most public videos but may fail on restricted content.
- If you need the most robust YouTube extraction, the host must provide a `yt-dlp` binary on `PATH` (or allow runtime downloads). Consider using a VM/host that permits that if needed.

## Deploying with Docker (Recommended if Wispbyte supports custom Docker images)

If your Wispbyte instance supports custom Docker images, you can use the included `Dockerfile` which includes `ffmpeg` and `yt-dlp` pre-installed. This eliminates any concerns about missing system binaries and ensures the most reliable YouTube extraction.

### Build the Docker image locally

```bash
docker build -t discord-music-bot:latest .
```

### Run locally for testing

```bash
docker run -e DISCORD_TOKEN=your_token -e CLIENT_ID=your_client_id discord-music-bot:latest
```

### Push to Wispbyte

1. Configure your Wispbyte project to use a custom Docker image (check Wispbyte's dashboard for "Docker Image" or "Custom Image" settings).
2. Build and push the image to a Docker registry (e.g., Docker Hub, GitHub Container Registry, or a private registry Wispbyte can access):
   ```bash
   docker tag discord-music-bot:latest your-registry/discord-music-bot:latest
   docker push your-registry/discord-music-bot:latest
   ```
3. In Wispbyte's dashboard, set the image to `your-registry/discord-music-bot:latest`.
4. Configure environment variables in Wispbyte (no need to set `YTDLP_FORCE_EXTRACT_AUDIO` — it's already `1` in the Dockerfile):
   - `DISCORD_TOKEN=your_token`
   - `CLIENT_ID=your_client_id`
   - `OWNER_ID=your_owner_id` (optional)
   - `PREFIX=!` (optional)
5. Deploy and monitor logs. The bot should now have full ffmpeg + yt-dlp support.

### What the Dockerfile provides

- Node.js 22 (slim base image, ~200MB).
- `ffmpeg` — for robust audio extraction with yt-dlp.
- `yt-dlp` installed globally — always on PATH and pre-downloaded into the image.
- `YTDLP_FORCE_EXTRACT_AUDIO=1` by default — ensures best audio quality and format support.
- Small footprint with `--no-install-recommends` and cleanup of apt cache.

## Troubleshooting

- If you still see a warning about `yt-dlp` on startup, search the codebase for the exact warning string and update the environment variable as above.
- If playback fails for certain videos, check the bot logs for extractor-specific errors; the bot will choose the next available fallback automatically.

If you'd like, I can add these notes into a `README.md` (root) or keep this as `README_WISPBYTE.md`. Let me know your preference.
