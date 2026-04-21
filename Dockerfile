# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

# System dependencies for Chrome/Puppeteer and FFmpeg
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

# Create non-root user WITH a real home directory
RUN groupadd -r appuser \
  && useradd -r -g appuser -G audio,video \
     --create-home --home-dir /home/appuser appuser

WORKDIR /app

# Copy pre-built node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY package*.json ./

# ── Chrome pre-install during BUILD (as root, full write access) ───────────────
# Install into /tmp/.cache/hyperframes so the binary is baked into the image.
# HYPERFRAMES_CACHE_DIR tells HyperFrames where to look at runtime too.
ENV HYPERFRAMES_CACHE_DIR=/tmp/.cache/hyperframes
ENV PUPPETEER_CACHE_DIR=/tmp/.cache/hyperframes

RUN mkdir -p /tmp/.cache/hyperframes \
  && ./node_modules/.bin/hyperframes browser install 2>&1 || echo "hyperframes browser install skipped" \
  && chmod -R 755 /tmp/.cache/hyperframes

# ── Runtime env ───────────────────────────────────────────────────────────────
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --single-process"
ENV CHROME_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --single-process"
ENV PUPPETEER_NO_SANDBOX="1"
ENV DBUS_SESSION_BUS_ADDRESS="/dev/null"
ENV NODE_ENV="production"

# Fix ownership of app files for non-root user
RUN chown -R appuser:appuser /app /home/appuser

EXPOSE 3000

USER appuser

CMD ["node", "src/index.js"]
