/**
 * Fetches #shining posts from LinkedIn using a persistent browser session.
 *
 * First run: browser opens, log into LinkedIn, press Enter in this terminal.
 * Subsequent runs: session is reused automatically (no login needed).
 *
 * Usage: npm run fetch-linkedin
 * Output: src/data/linkedin-manual.json
 */

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, '../.linkedin-session');
const OUT_FILE = join(__dirname, '../src/data/linkedin-manual.json');
const SEARCH_URL = 'https://www.linkedin.com/search/results/content/?keywords=%23shining&origin=GLOBAL_SEARCH_HEADER&sortBy=date_posted';

async function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function isLoggedIn(page) {
  return page.url().includes('linkedin.com') && !page.url().includes('/login') && !page.url().includes('/authwall');
}

async function main() {
  await mkdir(SESSION_DIR, { recursive: true });

  const isFirstRun = !existsSync(join(SESSION_DIR, 'state.json'));

  console.log('\n=== LinkedIn #shining post fetcher ===\n');

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    storageState: existsSync(join(SESSION_DIR, 'state.json'))
      ? join(SESSION_DIR, 'state.json')
      : undefined,
  });

  const page = await browser.newPage();

  if (isFirstRun) {
    console.log('First run — opening LinkedIn login page.');
    console.log('Log in with your LinkedIn credentials, then come back here and press Enter.\n');
    await page.goto('https://www.linkedin.com/login');
    await waitForEnter('Press Enter once you are logged into LinkedIn...');
    // Save session after login
    await browser.storageState({ path: join(SESSION_DIR, 'state.json') });
    console.log('Session saved — future runs will skip login.\n');
  } else {
    console.log('Reusing saved session...');
    await page.goto('https://www.linkedin.com');
    if (!(await isLoggedIn(page))) {
      console.log('Session expired — please log in again.');
      await page.goto('https://www.linkedin.com/login');
      await waitForEnter('Press Enter once you are logged in...');
      await browser.storageState({ path: join(SESSION_DIR, 'state.json') });
    }
  }

  console.log('Navigating to #shining search...');
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Scroll to load more posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(1500);
  }

  // Extract post data from the page
  const posts = await page.evaluate(() => {
    const results = [];
    // LinkedIn content search results are in li elements with data-urn
    const cards = document.querySelectorAll('[data-urn*="activity"]');

    cards.forEach((card) => {
      try {
        const authorEl = card.querySelector('.update-components-actor__name, .feed-shared-actor__name, [aria-label*="profile"]');
        const titleEl = card.querySelector('.update-components-actor__description, .feed-shared-actor__description, .update-components-actor__meta');
        const contentEl = card.querySelector('.update-components-text, .feed-shared-update-v2__description, .break-words');
        const linkEl = card.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
        const timeEl = card.querySelector('time, .update-components-actor__sub-description-link, [aria-label*="ago"]');

        const author = authorEl?.innerText?.trim();
        const content = contentEl?.innerText?.trim();

        if (!author || !content) return;
        if (!content.toLowerCase().includes('shining')) return;

        results.push({
          platform: 'linkedin',
          author,
          authorTitle: titleEl?.innerText?.trim() ?? '',
          content: content.slice(0, 500),
          url: linkEl?.href ?? 'https://www.linkedin.com',
          date: timeEl?.getAttribute('datetime') ?? new Date().toISOString(),
          avatar: null,
        });
      } catch {
        // skip malformed card
      }
    });

    return results;
  });

  await browser.storageState({ path: join(SESSION_DIR, 'state.json') });
  await browser.close();

  if (posts.length === 0) {
    console.warn('⚠️  No posts found — LinkedIn may have changed its markup.');
    console.warn('   Add posts manually to src/data/linkedin-manual.json');
  } else {
    await writeFile(OUT_FILE, JSON.stringify(posts.slice(0, 10), null, 2));
    console.log(`\n✓ Saved ${posts.length} posts to src/data/linkedin-manual.json`);
    console.log('  Now run: npm run build && npm run deploy\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
