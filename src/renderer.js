'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const HYPERFRAMES_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'hyperframes');
const RENDER_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Renders a HyperFrames composition directory to an MP4 file.
 * The composition must have a valid index.html at compositionDir.
 */
function renderComposition(compositionDir, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      'render',
      '--output', outputPath,
      '--quality', 'low',
      '--fps', '24',
      '--workers', '1',
      '--ffmpeg-path', '/usr/bin/ffmpeg',
    ];

    const env = {
      ...process.env,
      // Required for Chrome in Docker/Railway (no sandbox)
      PUPPETEER_ARGS: '--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu',
      CHROME_FLAGS: '--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu',
    };

    execFile(HYPERFRAMES_BIN, args, {
      cwd: compositionDir,
      timeout: RENDER_TIMEOUT_MS,
      env,
      maxBuffer: 50 * 1024 * 1024, // 50MB stdout buffer
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr || stdout || error.message;
        console.error('[renderer] failed:', detail);
        reject(new Error(`HyperFrames render failed: ${detail.slice(0, 400)}`));
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error('Render completed but output file not found'));
        return;
      }

      console.log('[renderer] done:', outputPath);
      resolve(outputPath);
    });
  });
}

module.exports = { renderComposition };
