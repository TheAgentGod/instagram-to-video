'use strict';

const { formatCount } = require('./parser');

// Seeded PRNG — deterministic, no Math.random() (required by HyperFrames)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generates a standalone HyperFrames index.html for Instagram Reels.
 * Format: 1080x1920 (9:16 vertical), 9 seconds, 30fps.
 *
 * @param {object} postData  - parsed Instagram post data
 * @param {string|null} localImagePath - filename of downloaded image in job dir
 */
function generateComposition(postData, localImagePath) {
  const { username, displayName, caption, likes, comments } = postData;

  const displayUsername  = username || 'instagram';
  const displayCaption   = (caption || '').slice(0, 280);
  const likesStr         = formatCount(likes);
  const commentsStr      = formatCount(comments);
  const hasStats         = likesStr || commentsStr;
  const hasImage         = Boolean(localImagePath);

  // Avatar initials (up to 2 chars)
  const initials = (displayName || displayUsername)
    .split(/[\s_.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  // Deterministic avatar gradient hue from username
  const rng = mulberry32(
    displayUsername.split('').reduce((a, c) => a + c.charCodeAt(0), 7)
  );
  const hue1 = Math.floor(rng() * 360);
  const hue2 = (hue1 + 80) % 360;

  // Caption font size: smaller for longer text
  const captionFontSize = displayCaption.length > 220 ? 30
    : displayCaption.length > 140 ? 36
    : displayCaption.length > 80  ? 42
    : 48;

  const imageTag = hasImage
    ? `<img class="bg-image" src="./${localImagePath}" crossorigin="anonymous" alt="" />`
    : `<div class="bg-image bg-placeholder"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>@${displayUsername}</title>
</head>
<body>
<div
  data-composition-id="instagram-reel"
  data-width="1080"
  data-height="1920"
  data-duration="9"
>

  <!-- ── Decorative: full-bleed background (absolute, not a clip) ── -->
  <div class="bg-wrapper">
    ${imageTag}
  </div>

  <!-- ── Decorative: gradient overlays ── -->
  <div class="overlay-top"></div>
  <div class="overlay-bottom"></div>

  <!-- ── Timed clip: all content ── -->
  <div id="scene" data-start="0" data-duration="9" data-track-index="0">
    <div class="scene-content">

      <!-- Spacer: pushes content to bottom third -->
      <div class="flex-spacer"></div>

      <!-- Main text block — slides up from below at t=0.5 -->
      <div id="main-text">

        ${displayCaption ? `
        <p id="caption" class="caption" style="font-size:${captionFontSize}px">
          ${escapeHtml(displayCaption)}
        </p>` : ''}

        ${hasStats ? `
        <div class="stats">
          ${likesStr ? `
          <div class="stat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#E1306C" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span>${likesStr}</span>
          </div>` : ''}
          ${commentsStr ? `
          <div class="stat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>${commentsStr}</span>
          </div>` : ''}
        </div>` : ''}

      </div><!-- /#main-text -->

      <!-- Handle — fades in at t=7 as closing signature -->
      <div id="handle" class="handle">
        <div class="handle-avatar" style="background:linear-gradient(135deg,hsl(${hue1},70%,55%),hsl(${hue2},65%,45%))">
          <span>${initials}</span>
        </div>
        <div class="handle-text">
          <span class="handle-username">@${escapeHtml(displayUsername)}</span>
          ${displayName ? `<span class="handle-displayname">${escapeHtml(displayName)}</span>` : ''}
        </div>
        <!-- Instagram wordmark SVG -->
        <div class="handle-ig">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="igG" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#F58529"/>
                <stop offset="50%" stop-color="#DD2A7B"/>
                <stop offset="100%" stop-color="#515BD4"/>
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#igG)" stroke-width="2" fill="none"/>
            <circle cx="12" cy="12" r="4.5" stroke="url(#igG)" stroke-width="2" fill="none"/>
            <circle cx="17.5" cy="6.5" r="1.2" fill="url(#igG)"/>
          </svg>
        </div>
      </div><!-- /#handle -->

    </div><!-- /.scene-content -->
  </div><!-- /#scene -->

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    [data-composition-id="instagram-reel"] {
      position: relative;
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      background: #0a0a0a;
      font-family: 'DM Sans', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Background ── */
    .bg-wrapper {
      position: absolute;
      inset: 0;
      overflow: hidden;
      transform-origin: center center;
    }

    .bg-image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .bg-placeholder {
      background: linear-gradient(
        160deg,
        hsl(${hue1}, 45%, 12%) 0%,
        hsl(${(hue1 + 120) % 360}, 40%, 8%) 50%,
        hsl(${hue2}, 45%, 14%) 100%
      );
    }

    /* ── Overlays ── */
    .overlay-top {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 320px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%);
      z-index: 1;
    }

    .overlay-bottom {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 900px;
      background: linear-gradient(
        to top,
        rgba(0,0,0,0.95) 0%,
        rgba(0,0,0,0.80) 35%,
        rgba(0,0,0,0.40) 65%,
        transparent 100%
      );
      z-index: 1;
    }

    /* ── Scene clip ── */
    #scene {
      position: absolute;
      inset: 0;
      z-index: 2;
    }

    .scene-content {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 80px 64px;
      box-sizing: border-box;
    }

    .flex-spacer { flex: 1; }

    /* ── Main text ── */
    #main-text {
      display: flex;
      flex-direction: column;
      gap: 28px;
      margin-bottom: 48px;
    }

    .caption {
      color: rgba(255, 255, 255, 0.95);
      font-weight: 400;
      line-height: 1.5;
      letter-spacing: 0.1px;
      max-width: 920px;
    }

    .stats {
      display: flex;
      gap: 36px;
      align-items: center;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 30px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.85);
      font-variant-numeric: tabular-nums;
    }

    /* ── Handle ── */
    #handle {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .handle-avatar {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
    }

    .handle-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .handle-username {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      font-weight: 400;
      color: #ffffff;
      letter-spacing: 1px;
    }

    .handle-displayname {
      font-size: 22px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.55);
    }

    .handle-ig {
      margin-left: auto;
      flex-shrink: 0;
      opacity: 0.85;
    }
  </style>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });

    // 1. Background image: opacity 0 → 1 over 1s
    tl.from('.bg-wrapper', {
      opacity: 0,
      duration: 1,
      ease: 'power2.out'
    }, 0);

    // 2. Background: subtle Ken Burns zoom 1.0 → 1.05 over entire 9s
    tl.to('.bg-wrapper', {
      scale: 1.05,
      duration: 9,
      ease: 'none'
    }, 0);

    // 3. Main text: fade in from below at t=0.5, duration 0.8s
    tl.from('#main-text', {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, 0.5);

    // 4. Handle: fade in at t=7 as closing signature
    tl.from('#handle', {
      opacity: 0,
      y: 16,
      duration: 0.6,
      ease: 'power2.out'
    }, 7);

    // 5. Final fade out (last/only scene — allowed per rules)
    tl.to('#scene', {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in'
    }, 8.3);

    window.__timelines['instagram-reel'] = tl;
  </script>

</div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { generateComposition };
