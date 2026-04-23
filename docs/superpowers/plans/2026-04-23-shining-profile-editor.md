# Shining Profile Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page web app where users upload a profile photo, apply the Shining ring frame as a watermark overlay, add an iridescent oil-slick / 70s glow effect, and download the result as a PNG.

**Architecture:** Astro site with one React island (`ImageEditor`) that owns all canvas state. All image compositing happens client-side via HTML5 Canvas — no server required. The Shining SVG frame is loaded as an `<img>` and drawn on top of the user's photo in canvas pixel space.

**Tech Stack:** Astro 5, React 19, TypeScript (strict), Tailwind v4, Framer Motion, Vitest, HTML5 Canvas API

---

## File Map

| Path | Responsibility |
|------|---------------|
| `astro.config.mjs` | Astro config — React integration, output: static |
| `package.json` | Dependencies |
| `tsconfig.json` | TypeScript strict config |
| `src/styles/global.css` | Tailwind v4 import + 70s CSS custom properties |
| `src/layouts/Layout.astro` | Base HTML shell, SEO meta, fonts |
| `src/pages/index.astro` | Landing page — hero copy + `<ImageEditor client:load />` |
| `src/components/ImageEditor.tsx` | React island: upload → canvas → effect → download |
| `src/lib/canvas.ts` | Pure functions: drawImage, applyIridescentEffect, compositeFrame |
| `src/lib/canvas.test.ts` | Vitest unit tests for canvas pure functions |
| `public/shining-frame.svg` | The Shining crescent ring frame asset |
| `public/llms.txt` | LLM-readable site summary |
| `public/robots.txt` | Robots file |

---

## Task 1: Project Bootstrap

**Files:**
- Create: `astro.config.mjs`
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Scaffold Astro project**

```bash
cd /Users/carlhagerling/Documents/Web/Shining
npm create astro@latest . -- --template minimal --typescript strict --no-git --install
```

Expected: Astro project files created, deps installed.

- [ ] **Step 2: Add React and Tailwind integrations**

```bash
npx astro add react --yes
npx astro add tailwind --yes
npm install framer-motion
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 3: Verify `astro.config.mjs`**

Should contain both integrations. Replace its full content with:

```ts
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'static',
});
```

- [ ] **Step 4: Add Vitest config to `package.json`**

Add under the top-level `"scripts"` key (merge, do not replace existing scripts):

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "vitest": {
    "environment": "jsdom"
  }
}
```

- [ ] **Step 5: Copy Shining frame SVG to public/**

```bash
cp /Users/carlhagerling/Desktop/Shining.svg /Users/carlhagerling/Documents/Web/Shining/public/shining-frame.svg
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: `Local: http://localhost:4321/` — no errors.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: bootstrap Astro + React + Tailwind project"
```

---

## Task 2: Global Styles & Layout

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/Layout.astro`

- [ ] **Step 1: Write global CSS with 70s disco tokens**

Create `src/styles/global.css`:

```css
@import "tailwindcss";

@layer base {
  :root {
    --color-gold: #daa520;
    --color-gold-light: #ffd700;
    --color-gold-dim: #b8860b;
    --color-amber: #ff9f00;
    --color-bg: #0c0700;
    --color-surface: #1a0f02;
    --color-surface-2: #241505;
    --color-text: #f5e6c8;
    --color-text-muted: #a08050;
    --radius-card: 1.5rem;
  }

  * {
    box-sizing: border-box;
  }

  body {
    background-color: var(--color-bg);
    color: var(--color-text);
    font-family: 'DM Sans', sans-serif;
  }

  ::selection {
    background: var(--color-gold);
    color: #000;
  }
}
```

- [ ] **Step 2: Create Layout.astro**

Create `src/layouts/Layout.astro`:

```astro
---
interface Props {
  title?: string;
  description?: string;
}

const {
  title = '#Shining — Make Your Profile Glow',
  description = 'Upload your profile photo, apply the Shining frame, and download your glowing 70s-style profile picture.',
} = Astro.props;

const canonicalURL = new URL(Astro.url.pathname, Astro.site ?? 'https://shining.se');
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalURL} />

    <!-- Open Graph -->
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalURL} />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600&display=swap"
      rel="stylesheet"
    />

    <title>{title}</title>
    <link rel="stylesheet" href="/src/styles/global.css" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 3: Create `public/robots.txt`**

```
User-agent: *
Allow: /
```

- [ ] **Step 4: Create `public/llms.txt`**

```
# Shining

A web tool for creating 70s-inspired glowing profile pictures.

## What it does
- Upload a profile photo
- Apply the Shining ring frame as a watermark overlay
- Add an iridescent oil-slick / disco glow effect
- Download the result as a PNG

## Brand
#Shining — 70s disco gold aesthetic
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add global 70s styles, layout, SEO meta"
```

---

## Task 3: Canvas Pure Functions (TDD)

**Files:**
- Create: `src/lib/canvas.ts`
- Create: `src/lib/canvas.test.ts`

These are pure functions that do the image math. Testing canvas drawing in jsdom is limited (no GPU), so we test the *logic* — color generation, compositing parameters — not the pixel output.

- [ ] **Step 1: Write failing tests**

Create `src/lib/canvas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getIridescentStops,
  buildFrameDrawParams,
  clamp,
} from './canvas';

describe('clamp', () => {
  it('clamps below minimum', () => expect(clamp(-1, 0, 1)).toBe(0));
  it('clamps above maximum', () => expect(clamp(2, 0, 1)).toBe(1));
  it('passes through in-range values', () => expect(clamp(0.5, 0, 1)).toBe(0.5));
});

describe('getIridescentStops', () => {
  it('returns 7 color stops', () => {
    const stops = getIridescentStops(1);
    expect(stops).toHaveLength(7);
  });

  it('each stop has offset 0-1 and a CSS color string', () => {
    const stops = getIridescentStops(0.5);
    stops.forEach(([offset, color]) => {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1);
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^hsla\(/);
    });
  });

  it('alpha scales with intensity', () => {
    const low = getIridescentStops(0.2);
    const high = getIridescentStops(1.0);
    // Extract alpha from first stop: hsla(h, s%, l%, alpha)
    const parseAlpha = (c: string) => parseFloat(c.match(/[\d.]+\)$/)![0]);
    expect(parseAlpha(low[0][1])).toBeLessThan(parseAlpha(high[0][1]));
  });
});

describe('buildFrameDrawParams', () => {
  it('returns x=0, y=0 for a square canvas', () => {
    const p = buildFrameDrawParams(500, 500);
    expect(p).toEqual({ x: 0, y: 0, size: 500 });
  });

  it('centers frame horizontally on landscape canvas', () => {
    const p = buildFrameDrawParams(800, 500);
    expect(p.size).toBe(500);
    expect(p.x).toBe(150);
    expect(p.y).toBe(0);
  });

  it('centers frame vertically on portrait canvas', () => {
    const p = buildFrameDrawParams(500, 800);
    expect(p.size).toBe(500);
    expect(p.x).toBe(0);
    expect(p.y).toBe(150);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: `ReferenceError` / "cannot find module `./canvas`" — all red.

- [ ] **Step 3: Implement `src/lib/canvas.ts`**

```ts
/** Clamp n between lo and hi. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Generate rainbow gradient stops for the iridescent overlay.
 * Returns [offset, hsla-color] pairs covering the full hue wheel.
 * intensity: 0–1 controls alpha of each stop.
 */
export function getIridescentStops(intensity: number): [number, string][] {
  const alpha = clamp(intensity * 0.55, 0, 0.55);
  return [
    [0.00, `hsla(0,   90%, 60%, ${alpha})`],    // red
    [0.16, `hsla(30,  95%, 62%, ${alpha})`],    // orange-gold
    [0.33, `hsla(60,  90%, 65%, ${alpha})`],    // yellow
    [0.50, `hsla(160, 80%, 58%, ${alpha})`],    // teal
    [0.66, `hsla(220, 85%, 65%, ${alpha})`],    // blue
    [0.83, `hsla(280, 80%, 65%, ${alpha})`],    // violet
    [1.00, `hsla(330, 90%, 62%, ${alpha})`],    // magenta-pink
  ];
}

/** Parameters to draw the frame SVG centered and scaled to cover the canvas. */
export function buildFrameDrawParams(
  canvasW: number,
  canvasH: number,
): { x: number; y: number; size: number } {
  const size = Math.min(canvasW, canvasH);
  return {
    x: (canvasW - size) / 2,
    y: (canvasH - size) / 2,
    size,
  };
}

/**
 * Draw the user's image onto the canvas, cropped to a circle.
 * Call this first before any overlays.
 */
export function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
): void {
  const size = Math.min(canvasW, canvasH);
  const x = (canvasW - size) / 2;
  const y = (canvasH - size) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(canvasW / 2, canvasH / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  // Cover-fit the source image into the circle
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  const sx = x + (size - sw) / 2;
  const sy = y + (size - sh) / 2;

  ctx.drawImage(img, sx, sy, sw, sh);
  ctx.restore();
}

/**
 * Apply iridescent oil-slick overlay to the entire canvas.
 * Uses a conic gradient (diagonal linear fallback) at 'overlay' blend mode.
 */
export function applyIridescentEffect(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  intensity: number,
  hueOffset: number,  // 0–360, used to animate the rainbow shift
): void {
  if (intensity <= 0) return;

  const stops = getIridescentStops(intensity);
  const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  stops.forEach(([offset, color]) => {
    // Shift hue by rotating which stops get which colors (simple offset wrap)
    const shiftedIdx = Math.round((offset * 6 + hueOffset / 60) % 7);
    grad.addColorStop(offset, stops[shiftedIdx][1]);
  });

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();

  // Warm golden bloom — drawn at 'screen' to add the 70s glow
  const bloom = ctx.createRadialGradient(
    canvasW / 2, canvasH / 2, 0,
    canvasW / 2, canvasH / 2, canvasW * 0.6,
  );
  const bloomAlpha = clamp(intensity * 0.3, 0, 0.3);
  bloom.addColorStop(0, `hsla(45, 100%, 75%, ${bloomAlpha})`);
  bloom.addColorStop(0.5, `hsla(35, 90%, 55%, ${bloomAlpha * 0.5})`);
  bloom.addColorStop(1, 'hsla(30, 80%, 40%, 0)');

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();
}

/**
 * Draw the Shining SVG frame on top of everything.
 * frameImg must be a loaded HTMLImageElement pointing at /shining-frame.svg.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frameImg: HTMLImageElement,
  canvasW: number,
  canvasH: number,
): void {
  const { x, y, size } = buildFrameDrawParams(canvasW, canvasH);
  ctx.drawImage(frameImg, x, y, size, size);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: all green, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: canvas pure functions with full test coverage"
```

---

## Task 4: ImageEditor React Component

**Files:**
- Create: `src/components/ImageEditor.tsx`

This is the main interactive island. It manages: file upload state, canvas rendering, effect intensity slider, hue animation, and the download action.

- [ ] **Step 1: Create `src/components/ImageEditor.tsx`**

```tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  drawCircularImage,
  applyIridescentEffect,
  drawFrame,
} from '../lib/canvas';

const CANVAS_SIZE = 600;

export function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);

  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(0.6);
  const [hueOffset, setHueOffset] = useState(0);
  const [animating, setAnimating] = useState(true);
  const [dragging, setDragging] = useState(false);
  const animFrameRef = useRef<number>(0);
  const hueRef = useRef(0);

  // Pre-load the frame SVG once
  useEffect(() => {
    const img = new Image();
    img.src = '/shining-frame.svg';
    img.onload = () => { frameImgRef.current = img; };
  }, []);

  const render = useCallback((currentHue: number, currentIntensity: number, src: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const photo = new Image();
    photo.onload = () => {
      drawCircularImage(ctx, photo, CANVAS_SIZE, CANVAS_SIZE);
      applyIridescentEffect(ctx, CANVAS_SIZE, CANVAS_SIZE, currentIntensity, currentHue);
      if (frameImgRef.current) {
        drawFrame(ctx, frameImgRef.current, CANVAS_SIZE, CANVAS_SIZE);
      }
    };
    photo.src = src;
  }, []);

  // Animation loop for hue rotation
  useEffect(() => {
    if (!animating || !photoSrc) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 30) { // ~30fps cap
        hueRef.current = (hueRef.current + 1.2) % 360;
        setHueOffset(hueRef.current);
        render(hueRef.current, intensity, photoSrc);
        last = t;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animating, photoSrc, intensity, render]);

  // Static re-render when animating=false
  useEffect(() => {
    if (!animating) render(hueOffset, intensity, photoSrc);
  }, [intensity, hueOffset, animating, photoSrc, render]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setPhotoSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shining-profile.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto px-4">
      {/* Upload zone */}
      <AnimatePresence>
        {!photoSrc && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <div
              style={{
                border: `2px dashed ${dragging ? 'var(--color-gold-light)' : 'var(--color-gold-dim)'}`,
                borderRadius: 'var(--radius-card)',
                background: dragging ? 'rgba(218,165,32,0.08)' : 'var(--color-surface)',
                padding: '3rem 2rem',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div style={{ fontSize: '2.5rem' }}>✦</div>
                <p style={{ color: 'var(--color-text)', fontFamily: 'DM Serif Display, serif', fontSize: '1.25rem' }}>
                  Drop your photo here
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  or click to browse — PNG, JPG, WEBP
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <AnimatePresence>
        {photoSrc && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center gap-6 w-full"
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={{
                  borderRadius: '50%',
                  width: 'min(90vw, 400px)',
                  height: 'min(90vw, 400px)',
                  boxShadow: `0 0 60px hsla(40, 90%, 55%, 0.35), 0 0 120px hsla(40, 80%, 40%, 0.2)`,
                }}
              />
            </div>

            {/* Controls */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-gold-dim)',
                borderRadius: 'var(--radius-card)',
                padding: '1.5rem 2rem',
                width: '100%',
              }}
              className="flex flex-col gap-5"
            >
              {/* Intensity slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 500 }}>
                    Shine Intensity
                  </label>
                  <span style={{ color: 'var(--color-gold)', fontSize: '0.875rem' }}>
                    {Math.round(intensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(intensity * 100)}
                  onChange={(e) => setIntensity(Number(e.target.value) / 100)}
                  style={{ accentColor: 'var(--color-gold)', width: '100%' }}
                />
              </div>

              {/* Animate toggle */}
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 500 }}>
                  Animate Rainbow
                </span>
                <button
                  onClick={() => setAnimating((a) => !a)}
                  style={{
                    background: animating ? 'var(--color-gold)' : 'var(--color-surface-2)',
                    border: '1px solid var(--color-gold-dim)',
                    borderRadius: '2rem',
                    color: animating ? '#000' : 'var(--color-text-muted)',
                    padding: '0.35rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {animating ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setPhotoSrc(null)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid var(--color-gold-dim)',
                    borderRadius: '0.75rem',
                    color: 'var(--color-text-muted)',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Change Photo
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    flex: 2,
                    background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light))',
                    border: 'none',
                    borderRadius: '0.75rem',
                    color: '#000',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  ↓ Download PNG
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/
git commit -m "feat: ImageEditor component with canvas compositing and iridescent effect"
```

---

## Task 5: Landing Page

**Files:**
- Create: `src/pages/index.astro`
- Modify: `src/layouts/Layout.astro` (fix stylesheet import to use Astro standard)

- [ ] **Step 1: Fix stylesheet import in Layout.astro**

The `<link rel="stylesheet" href="/src/styles/global.css" />` won't work in production. Replace it with the Astro-correct import. In `Layout.astro`, inside `<head>`:

Remove:
```html
<link rel="stylesheet" href="/src/styles/global.css" />
```

Add (at the top of the frontmatter `---` block, after the existing imports):
```astro
---
import '../styles/global.css';
```

- [ ] **Step 2: Create `src/pages/index.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import { ImageEditor } from '../components/ImageEditor';
---

<Layout>
  <main>
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">#shining</div>
        <h1>Make Your Profile&nbsp;<em>Glow</em></h1>
        <p class="hero-sub">
          Upload a photo. Apply the Shining frame. Download your disco-era masterpiece.
        </p>
      </div>
    </section>

    <!-- Editor -->
    <section class="editor-section">
      <ImageEditor client:load />
    </section>

    <!-- Footer -->
    <footer class="site-footer">
      <p>#shining &mdash; keep it golden</p>
    </footer>
  </main>
</Layout>

<style>
  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .hero {
    width: 100%;
    padding: 5rem 1rem 3rem;
    text-align: center;
    background: radial-gradient(ellipse 80% 50% at 50% 0%, hsla(40, 80%, 30%, 0.25) 0%, transparent 70%);
  }

  .hero-inner {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  .hero-badge {
    display: inline-block;
    background: linear-gradient(90deg, var(--color-gold-dim), var(--color-gold-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  h1 {
    font-family: 'DM Serif Display', serif;
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    line-height: 1.08;
    color: var(--color-text);
    margin: 0;
  }

  h1 em {
    font-style: italic;
    background: linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light), var(--color-amber));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    color: var(--color-text-muted);
    font-size: 1.1rem;
    max-width: 440px;
    line-height: 1.6;
    margin: 0;
  }

  .editor-section {
    width: 100%;
    max-width: 700px;
    padding: 2rem 1rem 4rem;
  }

  .site-footer {
    padding: 2rem;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
</style>
```

- [ ] **Step 3: Start dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:4321` — check:
- Dark warm background, gold typography
- Upload zone visible
- Hero headline with gradient italic text
- No console errors

- [ ] **Step 4: Upload a test photo, confirm:**
  - Photo appears in canvas with circular crop
  - Shining ring frame overlaid
  - Iridescent rainbow animates
  - Slider changes effect intensity
  - Animate toggle pauses/resumes
  - Download button saves a PNG

- [ ] **Step 5: Commit**

```bash
git add src/pages/ src/layouts/
git commit -m "feat: landing page with 70s disco hero and editor section"
```

---

## Task 6: Build Verification & Deploy Config

**Files:**
- Modify: `astro.config.mjs` (add `site`)
- Create: `vercel.json` (if deploying to Vercel)

- [ ] **Step 1: Run type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all green.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: `dist/` created, 0 errors, 0 warnings.

- [ ] **Step 4a: If deploying to Vercel**

```bash
npm install -g vercel
vercel --prod
```

Or create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "astro"
}
```

Push to GitHub, connect repo in Vercel dashboard → auto-deploy on push.

- [ ] **Step 4b: If deploying to Loopia (FTP)**

```bash
npm run build
lftp -e "mirror -R --delete --exclude .DS_Store dist/ /shining.se/public_html/; quit" \
     -u <username>,<password> ftpcluster.loopia.se
```

- [ ] **Step 5: Add `site` to astro config (required for canonical URLs)**

In `astro.config.mjs`:

```ts
export default defineConfig({
  site: 'https://shining.se',   // ← update to real domain
  integrations: [react(), tailwind()],
  output: 'static',
});
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: build verified, deploy config added"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|---|---|
| Upload profile image | Task 4 — file input + drag & drop |
| Apply Shining frame as watermark overlay | Task 3 `drawFrame()` + Task 4 canvas render pipeline |
| Iridescent / oil-slick / 70s glow effect | Task 3 `applyIridescentEffect()` with overlay + screen blend |
| Intensity control | Task 4 — slider 0–100% |
| Download PNG | Task 4 — `handleDownload()` via `canvas.toBlob()` |
| 70s disco gold theme | Task 2 — CSS custom properties, DM Serif Display, gradient text |
| SEO (title, description, OG, canonical) | Task 2 — Layout.astro |
| `/llms.txt` | Task 2 |
| Vercel or Loopia deploy | Task 6 — both options documented |

### Placeholder Scan
None found — all code steps are complete.

### Type Consistency
- `getIridescentStops` returns `[number, string][]` — used identically in `canvas.ts` and `canvas.test.ts`. ✓
- `drawCircularImage`, `applyIridescentEffect`, `drawFrame` signatures match their call-sites in `ImageEditor.tsx`. ✓
- `buildFrameDrawParams` returns `{ x, y, size }` — matched in test assertions. ✓
