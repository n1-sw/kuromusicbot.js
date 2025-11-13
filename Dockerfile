# Build a Discord music bot image with ffmpeg support for yt-dlp audio extraction.
# This image includes Node.js, ffmpeg, and yt-dlp pre-configured for reliable YouTube extraction.

FROM node:22-slim

# Install ffmpeg and other utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally so it's always available on PATH
RUN pip3 install yt-dlp --break-system-packages || pip3 install yt-dlp

# Create app directory
WORKDIR /home/container

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=optional

# Copy application code
COPY . .

# Set environment to use ffmpeg-based extraction by default
# (Users can override in Wispbyte dashboard if needed)
ENV YTDLP_FORCE_EXTRACT_AUDIO=1
ENV NODE_ENV=production

# Expose port for the bot (Discord uses websocket, but useful for health checks)
EXPOSE 3000

# Default command: start the bot
CMD ["node", "index.js"]
