# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Pre-download HyperFrames bundled Chrome so first requests don't time out
# If the command is unavailable (old version), the || true prevents build failure
RUN ./node_modules/.bin/hyperframes browser install 2>/dev/null || true


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

# System dependencies for Chromium/Puppeteer and FFmpeg
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

WORKDIR /app

# Copy pre-built node_modules (includes Chrome download from deps stage)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /root/.cache /root/.cache 2>/dev/null || true

COPY src/ ./src/
COPY package*.json ./

# Chrome must run without sandbox in Docker (no kernel namespace support)
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --single-process"
ENV CHROME_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --single-process"
ENV PUPPETEER_NO_SANDBOX="1"

# Increase shared memory (Chrome default /dev/shm is 64MB)
ENV DBUS_SESSION_BUS_ADDRESS="/dev/null"

EXPOSE 3000

# Use non-root user for better security
RUN groupadd -r appuser && useradd -r -g appuser -G audio,video appuser \
  && chown -R appuser:appuser /app
USER appuser

CMD ["node", "src/index.js"]
