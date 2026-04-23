/**
 * Fetches the latest #shining posts from Twitter (via Nitter RSS)
 * and merges with manually curated LinkedIn posts.
 *
 * Usage: npm run fetch-posts
 * Output: src/data/social-posts.json
 */

import { XMLParser } from 'fast-xml-parser';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '../src/data/social-posts.json');
const LINKEDIN_FILE = join(__dirname, '../src/data/linkedin-manual.json');

// Nitter instances (public mirrors of Twitter, no auth needed)
// If one fails the script tries the next
const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.cz',
  'https://nitter.net',
];

async function fetchTwitterPosts() {
  for (const instance of NITTER_INSTANCES) {
    try {
      console.log(`Trying ${instance}...`);
      const res = await fetch(
        `${instance}/search/rss?q=%23shining&f=tweets`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Shining-bot/1.0)' },
          signal: AbortSignal.timeout(12000),
        }
      );
      if (!res.ok) {
        console.warn(`  → HTTP ${res.status}, skipping`);
        continue;
      }
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false });
      const doc = parser.parse(xml);
      const rawItems = doc?.rss?.channel?.item ?? [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      const posts = items.slice(0, 10).map((item) => ({
        platform: 'twitter',
        author: item['dc:creator'] ?? item.author ?? 'Unknown',
        content: stripHtml(item.description ?? item.title ?? ''),
        url: item.link ?? '',
        date: item.pubDate ?? '',
        avatar: null,
      }));

      console.log(`  ✓ Got ${posts.length} Twitter posts from ${instance}`);
      return posts;
    } catch (err) {
      console.warn(`  → Failed: ${err.message}`);
    }
  }
  console.warn('All Nitter instances failed — Twitter posts will be empty.');
  return [];
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function loadLinkedInPosts() {
  if (!existsSync(LINKEDIN_FILE)) {
    console.log('No linkedin-manual.json found — creating template...');
    const template = [
      {
        platform: 'linkedin',
        author: 'Jane Doe',
        authorTitle: 'CEO at Example AB',
        content: 'Paste the post text here. #shining',
        url: 'https://www.linkedin.com/posts/example',
        date: new Date().toISOString(),
        avatar: null,
      },
    ];
    await writeFile(LINKEDIN_FILE, JSON.stringify(template, null, 2));
    console.log(`  → Created template at src/data/linkedin-manual.json`);
    console.log('  → Edit it with real LinkedIn posts and run fetch-posts again.');
    return template;
  }
  const raw = await readFile(LINKEDIN_FILE, 'utf8');
  const posts = JSON.parse(raw);
  console.log(`  ✓ Loaded ${posts.length} LinkedIn posts from linkedin-manual.json`);
  return posts.map((p) => ({ ...p, platform: 'linkedin' }));
}

async function main() {
  console.log('\n=== Fetching #shining posts ===\n');

  const [twitter, linkedin] = await Promise.all([
    fetchTwitterPosts(),
    loadLinkedInPosts(),
  ]);

  // Interleave: twitter first, then linkedin, sorted by date desc where possible
  const all = [...twitter, ...linkedin].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const output = {
    fetchedAt: new Date().toISOString(),
    posts: all,
  };

  await writeFile(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote ${all.length} posts to src/data/social-posts.json`);
  console.log('  Run: npm run build && npm run deploy\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
