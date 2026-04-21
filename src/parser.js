'use strict';

const { load } = require('cheerio');

/**
 * Extracts structured data from Instagram post HTML.
 * Tries three strategies in order: JSON-LD, OpenGraph meta tags, CSS selectors.
 */
function parseInstagramHTML(html) {
  const $ = load(html);
  const data = {
    username: '',
    displayName: '',
    avatarUrl: '',
    imageUrls: [],
    caption: '',
    likes: null,
    comments: null,
    timestamp: '',
  };

  // Strategy 1: JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      const entries = Array.isArray(json) ? json : [json];

      for (const entry of entries) {
        if (entry['@type'] === 'SocialMediaPosting' || entry['@type'] === 'ImageObject') {
          if (entry.author?.identifier) data.username = entry.author.identifier.replace('@', '');
          if (entry.author?.name) data.displayName = entry.author.name;
          if (entry.description) data.caption = entry.description;
          if (entry.image) {
            const imgs = Array.isArray(entry.image) ? entry.image : [entry.image];
            data.imageUrls.push(...imgs.map(i => (typeof i === 'string' ? i : i.url)).filter(Boolean));
          }
          if (entry.dateCreated) data.timestamp = entry.dateCreated;

          const stats = entry.interactionStatistic || [];
          for (const stat of stats) {
            if (stat['@type'] === 'InteractAction' && stat.userInteractionCount != null) {
              if (/like/i.test(stat.interactionType || '')) data.likes = stat.userInteractionCount;
              if (/comment/i.test(stat.interactionType || '')) data.comments = stat.userInteractionCount;
            }
          }
        }
      }
    } catch {
      // malformed JSON — skip
    }
  });

  // Strategy 2: OpenGraph + Twitter meta tags
  const og = (prop) => $(`meta[property="${prop}"]`).attr('content') || $(`meta[name="${prop}"]`).attr('content') || '';

  if (!data.imageUrls.length) {
    const ogImage = og('og:image');
    if (ogImage) data.imageUrls.push(ogImage);
  }

  if (!data.caption) {
    const desc = og('og:description');
    // Instagram og:description format: "username: caption"
    if (desc) {
      const colonIdx = desc.indexOf(':');
      data.caption = colonIdx > -1 ? desc.slice(colonIdx + 1).trim() : desc.trim();
    }
  }

  if (!data.username) {
    const title = og('og:title');
    // Instagram og:title format: "username (@handle) on Instagram"
    const handleMatch = title.match(/@([\w.]+)/);
    if (handleMatch) data.username = handleMatch[1];
    else if (title) data.username = title.split(' ')[0];
  }

  // Strategy 3: CSS selectors (Instagram DOM)
  if (!data.username) {
    data.username =
      $('[data-testid="user-avatar"] + * a').text().trim() ||
      $('header a[href*="/"]').first().text().trim() ||
      $('a._acan').first().text().trim() ||
      '';
  }

  if (!data.imageUrls.length) {
    $('article img, ._aagt img, [data-testid="post-image"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('150x150') && !src.includes('avatar')) {
        data.imageUrls.push(src);
      }
    });
  }

  if (data.likes === null) {
    const likeText = $('[aria-label*="like"], [data-testid="like-count"]').first().text();
    const parsed = parseCount(likeText);
    if (parsed !== null) data.likes = parsed;
  }

  // Normalize
  data.username = data.username.replace(/^@/, '');
  data.caption = (data.caption || '').slice(0, 300);

  return data;
}

function parseCount(text) {
  if (!text) return null;
  const clean = text.replace(/,/g, '').match(/[\d.]+[KkMm]?/);
  if (!clean) return null;
  const s = clean[0];
  if (/[Kk]$/.test(s)) return Math.round(parseFloat(s) * 1000);
  if (/[Mm]$/.test(s)) return Math.round(parseFloat(s) * 1_000_000);
  return parseInt(s, 10);
}

function formatCount(n) {
  if (n == null) return '';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

module.exports = { parseInstagramHTML, formatCount };
