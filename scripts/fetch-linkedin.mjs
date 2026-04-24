/**
 * Fetches #shining posts from LinkedIn.
 *
 * First run: a browser window opens → log in to LinkedIn → press Enter here.
 * Subsequent runs: session reused automatically, no login needed.
 *
 * Usage: npm run fetch-linkedin
 * Output: src/data/linkedin-manual.json
 */

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, '../.linkedin-session');
const OUT_FILE = join(__dirname, '../src/data/linkedin-manual.json');
const SEARCH_URL = 'https://www.linkedin.com/search/results/content/?keywords=%23shining&origin=GLOBAL_SEARCH_HEADER&sortBy=date_posted';

async function waitForEnter(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(msg, () => { rl.close(); resolve(); }));
}

async function main() {
  await mkdir(SESSION_DIR, { recursive: true });

  const firstRun = !existsSync(join(SESSION_DIR, 'Default', 'Cookies'));
  console.log('\n=== LinkedIn #shining post fetcher ===\n');

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  if (firstRun) {
    console.log('First run — a browser window has opened.');
    console.log('Log into LinkedIn, then come back here and press Enter.\n');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    await waitForEnter('Press Enter once you are logged in...');
  } else {
    console.log('Reusing saved session...');
    await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded' });

    // Check if still logged in
    const url = page.url();
    if (url.includes('/login') || url.includes('/authwall')) {
      console.log('Session expired — please log in again.');
      await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
      await waitForEnter('Press Enter once you are logged in...');
    }
  }

  console.log('Navigating to #shining search results...');
  await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Scroll to load more posts
  console.log('Loading posts...');
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1800);
  }

  const posts = await page.evaluate(() => {
    const results = [];
    const cardSelectors = [
      '[data-urn*="activity"]',
      '.feed-shared-update-v2',
      '.occludable-update',
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      const found = [...document.querySelectorAll(sel)];
      if (found.length > 0) { cards = found; break; }
    }

    cards.forEach((card) => {
      try {
        const authorEl = card.querySelector(
          '.update-components-actor__name span[aria-hidden="true"], .feed-shared-actor__name'
        );
        const titleEl = card.querySelector(
          '.update-components-actor__description span[aria-hidden="true"], .feed-shared-actor__description'
        );
        const contentEl = card.querySelector(
          '.update-components-text span[dir], .feed-shared-update-v2__description, .break-words'
        );
        const linkEl = card.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
        const timeEl = card.querySelector('time');

        const author = authorEl?.innerText?.trim();
        const content = contentEl?.innerText?.trim();
        if (!author || !content || content.length < 5) return;

        results.push({
          platform: 'linkedin',
          author,
          authorTitle: titleEl?.innerText?.trim() ?? '',
          content: content.slice(0, 500),
          url: linkEl ? new URL(linkEl.href, location.origin).href : location.href,
          date: timeEl?.getAttribute('datetime') ?? new Date().toISOString(),
          avatar: null,
        });
      } catch { /* skip */ }
    });

    return results;
  });

  await browser.close();

  if (posts.length === 0) {
    console.warn('\n⚠️  No posts extracted — LinkedIn may have updated its markup.');
    console.warn('   Add posts manually to src/data/linkedin-manual.json\n');
    process.exit(1);
  }

  await writeFile(OUT_FILE, JSON.stringify(posts.slice(0, 10), null, 2));
  console.log(`\n✓ Saved ${posts.length} posts → src/data/linkedin-manual.json`);
  console.log('  Run: npm run build && npm run deploy\n');
}

main().catch(err => { console.error(err); process.exit(1); });
