FROM node:22-slim

# System dependencies for chrome-headless-shell and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Create appuser WITH real home directory (-m creates /home/appuser)
RUN useradd -m -u 1001 -s /bin/bash appuser

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
RUN npm install gsap
COPY src/ ./src/

# Install chrome-headless-shell during BUILD into appuser's home cache.
# HyperFrames resolves Chrome from ~/.cache/puppeteer by default.
# We point PUPPETEER_CACHE_DIR there and run `browser ensure` (not install).
ENV PUPPETEER_CACHE_DIR=/home/appuser/.cache/puppeteer
ENV HYPERFRAMES_CACHE_DIR=/tmp/.cache/hyperframes

RUN mkdir -p /home/appuser/.cache/puppeteer /tmp/.cache/hyperframes \
  && ./node_modules/.bin/hyperframes browser ensure \
  && chown -R appuser:appuser /home/appuser \
  && chmod -R 755 /home/appuser/.cache

# No-sandbox flags required in Docker (no kernel namespace support)
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu"
ENV CHROME_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu"
ENV PUPPETEER_NO_SANDBOX="1"
ENV FFMPEG_PATH="/usr/bin/ffmpeg"
ENV FFMPEG_PROBE_PATH="/usr/bin/ffprobe"
ENV DBUS_SESSION_BUS_ADDRESS="/dev/null"
ENV NODE_ENV="production"

RUN which ffmpeg && ffmpeg -version

RUN chown -R appuser:appuser /app

ENV FFMPEG_THREADS="1"
ENV HYPERFRAMES_FFMPEG_THREADS="1"

EXPOSE 3000
USER appuser
CMD ["node", "src/index.js"]
