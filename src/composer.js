'use strict';

const { formatCount } = require('./parser');

// Seeded PRNG for deterministic pseudo-random values (required by HyperFrames)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generates a standalone HyperFrames index.html for the given post data.
 * localImagePath is the filename of the downloaded image in the job directory,
 * or null if no image was downloaded.
 */
function generateComposition(postData, localImagePath) {
  const {
    username,
    displayName,
    caption,
    likes,
    comments,
  } = postData;

  const displayUsername = username || 'instagram';
  const displayCaption = caption || '';
  const likesStr = formatCount(likes);
  const commentsStr = formatCount(comments);
  const hasStats = likesStr || commentsStr;
  const hasImage = Boolean(localImagePath);

  // Avatar initials (up to 2 chars)
  const initials = (displayName || displayUsername)
    .split(/[\s_]/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Determine if caption needs smaller font
  const captionFontSize = displayCaption.length > 180 ? 28
    : displayCaption.length > 100 ? 34
    : 40;

  const imageTag = hasImage
    ? `<img class="post-image" src="./${localImagePath}" crossorigin="anonymous" alt="" />`
    : `<div class="post-image-placeholder"></div>`;

  // Instagram gradient avatar bg (deterministic via seed)
  const rng = mulberry32(displayUsername.split('').reduce((a, c) => a + c.charCodeAt(0), 42));
  const hue = Math.floor(rng() * 360);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Instagram Post — ${displayUsername}</title>
</head>
<body>
  <div
    data-composition-id="instagram-post"
    data-width="1080"
    data-height="1080"
    data-duration="9"
  >
    <!-- Decorative: full-screen post image -->
    ${imageTag}

    <!-- Decorative: gradient overlays for text legibility -->
    <div class="overlay-top"></div>
    <div class="overlay-bottom"></div>

    <!-- Timed clip: all visible content -->
    <div id="scene" data-start="0" data-duration="9" data-track-index="0">
      <div class="scene-content">

        <!-- Header: avatar + username -->
        <div class="header">
          <div id="avatar" class="avatar" style="background: linear-gradient(135deg, hsl(${hue},75%,55%), hsl(${(hue + 80) % 360},70%,45%))">
            <span class="avatar-initials">${initials}</span>
          </div>
          <div class="header-text">
            <span id="username" class="username">@${displayUsername}</span>
            ${displayName && displayName !== displayUsername
              ? `<span id="displayname" class="display-name">${escapeHtml(displayName)}</span>`
              : ''}
          </div>
          <div id="ig-badge" class="ig-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#F58529"/>
                  <stop offset="50%" stop-color="#DD2A7B"/>
                  <stop offset="100%" stop-color="#515BD4"/>
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#igGrad)" stroke-width="2" fill="none"/>
              <circle cx="12" cy="12" r="4.5" stroke="url(#igGrad)" stroke-width="2" fill="none"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="url(#igGrad)"/>
            </svg>
          </div>
        </div>

        <!-- Spacer pushes caption to bottom -->
        <div class="spacer"></div>

        <!-- Caption -->
        ${displayCaption ? `
        <div id="caption-wrap" class="caption-wrap">
          <p id="caption" class="caption" style="font-size:${captionFontSize}px">${escapeHtml(displayCaption)}</p>
        </div>` : ''}

        <!-- Stats -->
        ${hasStats ? `
        <div id="stats" class="stats">
          ${likesStr ? `
          <div class="stat">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#E1306C" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span>${likesStr}</span>
          </div>` : ''}
          ${commentsStr ? `
          <div class="stat">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A8A8A8" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>${commentsStr}</span>
          </div>` : ''}
        </div>` : ''}

      </div>
    </div>

    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }

      [data-composition-id="instagram-post"] {
        position: relative;
        width: 1080px;
        height: 1080px;
        overflow: hidden;
        background: #0a0a0a;
        font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      /* Decoratives */
      .post-image,
      .post-image-placeholder {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .post-image-placeholder {
        background: linear-gradient(
          135deg,
          hsl(${hue}, 40%, 15%) 0%,
          hsl(${(hue + 120) % 360}, 35%, 10%) 50%,
          hsl(${(hue + 240) % 360}, 40%, 15%) 100%
        );
      }

      .overlay-top {
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 280px;
        background: linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%);
        z-index: 1;
      }

      .overlay-bottom {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 480px;
        background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 55%, transparent 100%);
        z-index: 1;
      }

      /* Clip: scene */
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
        padding: 52px 56px;
        gap: 0;
      }

      /* Header */
      .header {
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .avatar {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 0 0 3px rgba(255,255,255,0.2);
      }

      .avatar-initials {
        font-size: 26px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.5px;
      }

      .header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .username {
        font-size: 32px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.3px;
      }

      .display-name {
        font-size: 22px;
        font-weight: 400;
        color: rgba(255,255,255,0.6);
      }

      .ig-badge {
        margin-left: auto;
        flex-shrink: 0;
        opacity: 0.9;
      }

      /* Spacer */
      .spacer { flex: 1; }

      /* Caption */
      .caption-wrap {
        margin-bottom: 28px;
      }

      .caption {
        font-weight: 400;
        color: rgba(255,255,255,0.92);
        line-height: 1.55;
        letter-spacing: 0.1px;
        max-width: 880px;
      }

      /* Stats */
      .stats {
        display: flex;
        gap: 32px;
        align-items: center;
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 28px;
        font-weight: 600;
        color: rgba(255,255,255,0.85);
        font-variant-numeric: tabular-nums;
      }
    </style>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // Image: subtle Ken Burns zoom
      tl.from('.post-image, .post-image-placeholder', {
        scale: 1.06,
        opacity: 0,
        duration: 1.2,
        ease: 'power2.out'
      }, 0);

      // Overlays
      tl.from('.overlay-top, .overlay-bottom', {
        opacity: 0,
        duration: 0.8,
        ease: 'power1.out'
      }, 0.2);

      // Avatar: scale in
      tl.from('#avatar', {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(1.7)'
      }, 0.7);

      // Username: slide from left
      tl.from('#username', {
        x: -24,
        opacity: 0,
        duration: 0.5,
        ease: 'expo.out'
      }, 0.85);

      // Display name (if present)
      tl.from('#displayname', {
        x: -16,
        opacity: 0,
        duration: 0.4,
        ease: 'power3.out'
      }, 0.95);

      // Instagram badge: fade in
      tl.from('#ig-badge', {
        opacity: 0,
        scale: 0.7,
        duration: 0.4,
        ease: 'power2.out'
      }, 1.0);

      // Caption: slide up
      tl.from('#caption-wrap', {
        y: 30,
        opacity: 0,
        duration: 0.65,
        ease: 'power3.out'
      }, 1.4);

      // Stats: slide up with slight stagger
      tl.from('#stats .stat', {
        y: 20,
        opacity: 0,
        duration: 0.45,
        stagger: 0.12,
        ease: 'power2.out'
      }, 2.0);

      // Final fade out (last scene — allowed per rules)
      tl.to('#scene', {
        opacity: 0,
        duration: 0.7,
        ease: 'power2.in'
      }, 8.1);

      window.__timelines['instagram-post'] = tl;
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
