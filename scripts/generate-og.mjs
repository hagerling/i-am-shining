// Render the OpenGraph share image via Playwright. Produces a 1200×630 PNG
// from a self-contained HTML template that mirrors the brand. Run once
// when the brand changes:
//   node scripts/generate-og.mjs
//
// Output: public/og-image.png

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '..', 'public', 'og-image.png');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #0c0700;
    color: #f5e6c8;
    font-family: 'DM Sans', sans-serif;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stars {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(2px 2px at 12% 20%, rgba(255,215,0,0.6), transparent),
      radial-gradient(1.5px 1.5px at 78% 14%, rgba(255,232,140,0.55), transparent),
      radial-gradient(1px 1px at 88% 60%, rgba(255,215,0,0.55), transparent),
      radial-gradient(1.5px 1.5px at 22% 78%, rgba(255,232,140,0.55), transparent),
      radial-gradient(1px 1px at 64% 84%, rgba(255,215,0,0.5), transparent),
      radial-gradient(1.5px 1.5px at 92% 32%, rgba(255,250,200,0.5), transparent);
  }
  .glow {
    position: absolute;
    width: 1100px;
    height: 1100px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(218,165,32,0.42) 0%, rgba(184,134,11,0.18) 35%, rgba(0,0,0,0) 65%);
    filter: blur(20px);
  }
  .ring {
    position: absolute;
    width: 540px;
    height: 540px;
    border-radius: 50%;
    border: 14px solid transparent;
    background:
      linear-gradient(#0c0700, #0c0700) padding-box,
      linear-gradient(135deg, #b8860b 0%, #ffd700 30%, #fffde5 50%, #ffd700 70%, #ff9f00 100%) border-box;
    box-shadow:
      0 0 80px rgba(218,165,32,0.45),
      inset 0 0 80px rgba(255,215,0,0.15);
  }
  .content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .badge {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: transparent;
    background: linear-gradient(90deg, #b8860b, #ffd700);
    -webkit-background-clip: text;
    background-clip: text;
    margin-bottom: 24px;
  }
  h1 {
    font-family: 'DM Serif Display', serif;
    font-size: 168px;
    line-height: 1;
    margin: 0;
    color: #f5e6c8;
  }
  h1 em {
    font-style: italic;
    color: transparent;
    background: linear-gradient(120deg, #b8860b 0%, #ffd700 30%, #fffde5 50%, #ffd700 70%, #ff9f00 100%);
    -webkit-background-clip: text;
    background-clip: text;
    margin-left: 0.06em;
  }
  .tag {
    margin-top: 36px;
    font-size: 26px;
    color: #b89058;
    letter-spacing: 0.06em;
  }
  .tag b {
    color: #ffd700;
    font-weight: 600;
  }
  .url {
    position: absolute;
    bottom: 36px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 18px;
    color: #b89058;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    z-index: 3;
  }
</style>
</head>
<body>
  <div class="stars"></div>
  <div class="glow"></div>
  <div class="ring"></div>
  <div class="content">
    <div class="badge">#Shining</div>
    <h1>I am <em>Shining</em></h1>
    <div class="tag">A golden profile picture &amp; LinkedIn banner — <b>free, in your browser</b></div>
  </div>
  <div class="url">i-am-shining.com</div>
</body>
</html>`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
});
const buf = await page.screenshot({ type: 'png', fullPage: false, omitBackground: false });
writeFileSync(out, buf);
await browser.close();
console.log(`Wrote ${out} (${buf.length} bytes)`);
