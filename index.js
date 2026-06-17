const express = require('express');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const DISCORD_WEBHOOK =
  'https://discord.com/api/webhooks/1512608075272552498/KkoD7KBWU5dZtstFsdPYocDBG0SJAQP_vhKZhz1HxaBkERl8Mmg1sRILbfRhgl3Q8OHZ';

const WATCHED_USERS = ['ShiinaBR', 'HYPEX'];

const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.cz',
  'https://nitter.space',
  'https://n.opnxng.com',
];

const POLL_INTERVAL_MS = 60 * 1000;

const seenIds = new Set();
const parser = new XMLParser({ ignoreAttributes: false });

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.send('X leak bot is running. Watching: ' + WATCHED_USERS.join(', '));
});

app.listen(PORT, () => {
  console.log(`Health check server on port ${PORT}`);
});

async function fetchRSS(username) {
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/${username}/rss`;
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; leak-bot/1.0)' },
      });
      const parsed = parser.parse(res.data);
      const items = parsed?.rss?.channel?.item;
      if (!items) return [];
      return Array.isArray(items) ? items : [items];
    } catch {
      continue;
    }
  }
  console.warn(`All Nitter instances failed for @${username}`);
  return [];
}

function extractTweetId(link) {
  const match = link && link.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function isReply(item) {
  const title = (item.title || '').trim();
  return title.startsWith('R to') || title.startsWith('@');
}

function extractImagesFromDescription(description) {
  if (!description) return [];
  const regex = /<img[^>]+src="([^"]+)"/g;
  const urls = [];
  let match;
  while ((match = regex.exec(description)) !== null) {
    const src = match[1];
    if (!src.includes('/pic/') && !src.includes('profile_images')) {
      urls.push(src);
    } else if (src.includes('/pic/')) {
      urls.push(src);
    }
  }
  return urls;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function sendDiscordWebhook(username, tweetText, tweetId, imageUrls) {
  const tweetUrl = `https://x.com/${username}/status/${tweetId}`;

  const embed = {
    color: 0x1da1f2,
    author: {
      name: `@${username}`,
      url: `https://x.com/${username}`,
      icon_url: `https://unavatar.io/twitter/${username}`,
    },
    description: tweetText || '*(no text)*',
    url: tweetUrl,
    timestamp: new Date().toISOString(),
    footer: { text: 'X (Twitter)' },
  };

  if (imageUrls.length > 0) {
    embed.image = { url: imageUrls[0] };
    if (imageUrls.length > 1) {
      embed.description += `\n\n🖼️ *${imageUrls.length} images — [view all on X](${tweetUrl})*`;
    }
  }

  const payload = {
    content: `**@${username}** just posted a new leak! 🚨`,
    embeds: [embed],
  };

  try {
    await axios.post(DISCORD_WEBHOOK, payload);
    console.log(`Sent to Discord: @${username} tweet ${tweetId}`);
  } catch (err) {
    console.error('Discord webhook error:', err.response?.data || err.message);
  }
}

async function pollUser(username) {
  const items = await fetchRSS(username);

  for (const item of items) {
    if (isReply(item)) continue;

    const tweetId = extractTweetId(item.link || item.guid || '');
    if (!tweetId) continue;
    if (seenIds.has(tweetId)) continue;

    seenIds.add(tweetId);

    const description = item.description || '';
    const tweetText = stripHtml(description);
    const imageUrls = extractImagesFromDescription(description);

    await sendDiscordWebhook(username, tweetText, tweetId, imageUrls);
  }
}

async function seedSeen() {
  console.log('Seeding seen IDs to avoid duplicate alerts on startup...');
  for (const username of WATCHED_USERS) {
    const items = await fetchRSS(username);
    for (const item of items) {
      const id = extractTweetId(item.link || item.guid || '');
      if (id) seenIds.add(id);
    }
    console.log(`Seeded ${seenIds.size} IDs for @${username}`);
  }
}

async function poll() {
  console.log(`Polling at ${new Date().toISOString()}`);
  for (const username of WATCHED_USERS) {
    await pollUser(username);
  }
}

async function main() {
  await seedSeen();
  console.log('Bot is live. Checking every 60 seconds for:', WATCHED_USERS.join(', '));
  setInterval(poll, POLL_INTERVAL_MS);
}

main();
