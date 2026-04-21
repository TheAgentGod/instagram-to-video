'use strict';

const express = require('express');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const { parseInstagramHTML } = require('./parser');
const { generateComposition } = require('./composer');
const { renderComposition } = require('./renderer');

const app = express();

// Accept raw HTML body or JSON with an "html" key
app.use(express.json({ limit: '15mb' }));
app.use(express.text({ type: 'text/html', limit: '15mb' }));

// ---------------------------------------------------------------------------
// Image downloader
// ---------------------------------------------------------------------------

async function downloadImage(url, destPath) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp'
      : contentType.includes('gif') ? 'gif'
      : 'jpg';

    const filename = `post-image.${ext}`;
    const fullPath = path.join(destPath, filename);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fsp.writeFile(fullPath, buffer);
    console.log(`[downloader] saved ${filename} (${buffer.length} bytes)`);
    return filename;
  } catch (err) {
    console.warn('[downloader] failed to download image:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Conversion pipeline
// ---------------------------------------------------------------------------

async function convert(html) {
  const jobId = crypto.randomUUID();
  const jobDir = path.join(os.tmpdir(), `hf-${jobId}`);

  await fsp.mkdir(jobDir, { recursive: true });
  console.log(`[job:${jobId}] started in ${jobDir}`);

  try {
    // 1. Parse
    const postData = parseInstagramHTML(html);
    console.log(`[job:${jobId}] parsed — @${postData.username}, imageUrls: ${postData.imageUrls.length}`);

    // 2. Download first image
    let localImageFile = null;
    for (const url of postData.imageUrls) {
      localImageFile = await downloadImage(url, jobDir);
      if (localImageFile) break;
    }

    // 3. Generate composition
    const compositionHTML = generateComposition(postData, localImageFile);
    await fsp.writeFile(path.join(jobDir, 'index.html'), compositionHTML, 'utf8');

    // 4. Render
    const outputPath = path.join(jobDir, 'output.mp4');
    await renderComposition(jobDir, outputPath);

    // 5. Read result
    const videoBuffer = await fsp.readFile(outputPath);
    console.log(`[job:${jobId}] done — ${videoBuffer.length} bytes`);

    return { jobId, videoBuffer };
  } finally {
    // Async cleanup — don't wait for it
    fsp.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /convert
// Body: raw HTML (Content-Type: text/html)
//   or JSON { "html": "..." }
//   or form  { "html": "..." }
app.post('/convert', async (req, res) => {
  const html = typeof req.body === 'string'
    ? req.body
    : req.body?.html;

  if (!html || typeof html !== 'string' || html.trim().length < 10) {
    return res.status(400).json({ error: 'Missing or empty "html" body' });
  }

  try {
    const { jobId, videoBuffer } = await convert(html);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="post-${jobId}.mp4"`);
    res.setHeader('Content-Length', videoBuffer.length);
    res.setHeader('X-Job-Id', jobId);
    res.send(videoBuffer);
  } catch (err) {
    console.error('[/convert] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /
app.get('/', (_req, res) => {
  res.json({
    name: 'instagram-to-video',
    version: '1.0.0',
    endpoints: {
      'POST /convert': 'Convert Instagram HTML to MP4. Body: text/html or JSON { html }',
      'GET /health': 'Health check',
    },
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`instagram-to-video listening on port ${PORT}`);
});
