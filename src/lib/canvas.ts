/** Clamp n between lo and hi. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export interface PaletteShift {
  hue?: number;  // degrees added to the base gold hues (negative = rose, etc.)
  sat?: number;  // multiplier on saturation (0–1 reduces, 1 = unchanged)
}

/**
 * Generate gradient stops for the metallic shine overlay.
 * Default = warm amber→gold→champagne. The optional palette shift can rotate
 * the hue (e.g. toward rose) or desaturate (toward platinum/silver).
 */
export function getIridescentStops(
  intensity: number,
  shift: PaletteShift = {},
): [number, string][] {
  const alpha = clamp(intensity * 0.85, 0, 0.85);
  const dh = shift.hue ?? 0;
  const ds = shift.sat ?? 1;
  const h = (base: number) => Math.round(((base + dh) % 360 + 360) % 360);
  const s = (base: number) => Math.round(clamp(base * ds, 0, 100));
  return [
    [0.00, `hsla(${h(28)},  ${s(90)}%, 48%, ${alpha})`],
    [0.16, `hsla(${h(38)},  ${s(95)}%, 58%, ${alpha})`],
    [0.33, `hsla(${h(45)}, ${s(100)}%, 70%, ${alpha})`],
    [0.50, `hsla(${h(50)}, ${s(100)}%, 88%, ${alpha * 1.05})`],
    [0.66, `hsla(${h(45)}, ${s(100)}%, 70%, ${alpha})`],
    [0.83, `hsla(${h(38)},  ${s(95)}%, 58%, ${alpha})`],
    [1.00, `hsla(${h(28)},  ${s(90)}%, 48%, ${alpha})`],
  ];
}

/** Seeded LCG — stable random numbers so sparkles don't jitter between pans. */
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
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

export interface PhotoTransform {
  x: number;   // pixel offset from center, in canvas coordinates
  y: number;
  scale: number; // multiplier on top of cover-fit base scale
}

/**
 * Draw the user's image onto the canvas, cropped to a circle.
 * transform lets the user drag/zoom the photo within the frame.
 */
export function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  transform: PhotoTransform = { x: 0, y: 0, scale: 1 },
): void {
  const size = Math.min(canvasW, canvasH);
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();

  // Cover-fit base, then apply user scale on top
  const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const finalScale = baseScale * transform.scale;
  const sw = img.naturalWidth * finalScale;
  const sh = img.naturalHeight * finalScale;
  const sx = cx - sw / 2 + transform.x;
  const sy = cy - sh / 2 + transform.y;

  ctx.drawImage(img, sx, sy, sw, sh);
  ctx.restore();
}

/**
 * Apply iridescent oil-slick overlay to the entire canvas.
 * Rainbow diagonal gradient at 'overlay' blend + warm golden bloom at 'screen'.
 */
/** Rectangular region the sparkle loop will skip (in canvas pixel coords). */
export interface SparkleExclusion {
  x: number; y: number; w: number; h: number;
}

/**
 * Test whether a sparkle at (x, y) would overlap any exclusion zone.
 * `buffer` is the sparkle's OWN reach (glow radius + rays) — we expand each
 * zone by that buffer so a sparkle centered JUST outside an eye/mouth zone,
 * whose glow would still splash ONTO the feature, gets rejected too.
 * Equivalent to a Minkowski-sum test for a circle against a rectangle.
 */
function inExclusion(
  x: number, y: number,
  zones: SparkleExclusion[] | undefined,
  buffer = 0,
): boolean {
  if (!zones) return false;
  for (const z of zones) {
    if (
      x >= z.x - buffer && x <= z.x + z.w + buffer &&
      y >= z.y - buffer && y <= z.y + z.h + buffer
    ) return true;
  }
  return false;
}

export function applyIridescentEffect(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  intensity: number,
  hueOffset: number,
  sparkleExclusion?: SparkleExclusion[],
  palette: PaletteShift = {},
): void {
  if (intensity <= 0) return;

  const stops = getIridescentStops(intensity, palette);
  const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  stops.forEach(([offset, _color], i) => {
    const shiftedIdx = Math.round((i + hueOffset / 60)) % 7;
    grad.addColorStop(offset, stops[Math.abs(shiftedIdx)][1]);
  });

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();

  // ── Rim glow ────────────────────────────────────────────────────────────
  // Instead of a central bloom (which washes out the face), we light the
  // edges of the circular crop. The result is a halo around the subject —
  // glow in the corners/perimeter of the image, the centre stays clear.
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const radius = Math.min(canvasW, canvasH) / 2;
  const rimAlpha = clamp(intensity * 0.55, 0, 0.7);

  const dh = palette.hue ?? 0;
  const ds = palette.sat ?? 1;
  const h = (base: number) => Math.round(((base + dh) % 360 + 360) % 360);
  const s = (base: number) => Math.round(clamp(base * ds, 0, 100));

  const rim = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius * 1.05);
  rim.addColorStop(0,    `hsla(${h(45)}, ${s(100)}%, 70%, 0)`);                  // clear centre
  rim.addColorStop(0.55, `hsla(${h(45)}, ${s(100)}%, 70%, ${rimAlpha * 0.20})`); // soft transition
  rim.addColorStop(0.85, `hsla(${h(42)}, ${s(100)}%, 65%, ${rimAlpha * 0.75})`); // warm rim
  rim.addColorStop(1,    `hsla(${h(35)},  ${s(95)}%, 55%, ${rimAlpha})`);        // deep edge

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();


  // ── Sparkle / glitter layer — scales dramatically with intensity ────────
  // Below ~15% intensity: no sparkles. Above: an ever-denser field of
  // golden/white specks with cross-rays on the brightest ones.
  if (intensity > 0.12) {
    const rng = seededRand(1337);
    const n = Math.floor(35 + intensity * intensity * 260); // quadratic curve
    const alphaBoost = clamp(intensity * 1.3, 0, 1);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x  = rng() * canvasW;
      const y  = rng() * canvasH;
      const sz = 0.7 + rng() * (2 + intensity * 4);   // bigger at high intensity
      // Reach = glow radius + a small margin. Rays (rayLen ≤ sz·3.7) are
      // always shorter than the glow (glowR ≤ sz·4.5), so one radius suffices.
      const glowR = sz * (3 + intensity * 1.5);
      const reach = glowR + 3;
      // Skip sparkles whose GLOW would land on the user's eyes or mouth,
      // not just sparkles whose centre is there
      if (inExclusion(x, y, sparkleExclusion, reach)) continue;
      const al = (0.35 + rng() * 0.65) * alphaBoost;
      // Strongly bias toward gold for a champagne-glitter feel — only ~12%
      // of sparkles read as white-hot highlights.
      const gold = rng() > 0.12;

      // Cross rays on the brighter sparkles (more of them at high intensity)
      if (sz > 2 && rng() < 0.55 + intensity * 0.35) {
        ctx.strokeStyle = gold
          ? `rgba(255,232,130,${(al * 0.85).toFixed(3)})`
          : `rgba(255,252,235,${(al * 0.85).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.5, sz * 0.32);
        ctx.lineCap = 'round';
        const rayLen = sz * (2.2 + intensity * 1.5);
        ctx.beginPath();
        ctx.moveTo(x - rayLen, y); ctx.lineTo(x + rayLen, y);
        ctx.moveTo(x, y - rayLen); ctx.lineTo(x, y + rayLen);
        ctx.stroke();
        // Diagonal rays at very high intensity
        if (intensity > 0.6) {
          ctx.lineWidth = Math.max(0.4, sz * 0.18);
          ctx.strokeStyle = gold
            ? `rgba(255,220,95,${(al * 0.55).toFixed(3)})`
            : `rgba(240,240,255,${(al * 0.55).toFixed(3)})`;
          const d = rayLen * 0.55;
          ctx.beginPath();
          ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
          ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
          ctx.stroke();
        }
      }

      // Soft central glow (glowR computed at top of loop)
      const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      if (gold) {
        g.addColorStop(0,    `rgba(255,252,220,${al.toFixed(3)})`);
        g.addColorStop(0.25, `rgba(255,210,80,${(al * 0.6).toFixed(3)})`);
      } else {
        g.addColorStop(0,    `rgba(255,255,255,${al.toFixed(3)})`);
        g.addColorStop(0.25, `rgba(240,240,255,${(al * 0.55).toFixed(3)})`);
      }
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Clamp the photo transform so the image always covers the full circle.
 * Prevents dragging the photo so an edge is visible inside the circle.
 */
export function clampTransform(
  transform: PhotoTransform,
  imgNaturalW: number,
  imgNaturalH: number,
  canvasSize: number,
): PhotoTransform {
  const baseScale = Math.max(canvasSize / imgNaturalW, canvasSize / imgNaturalH);
  const finalScale = baseScale * transform.scale;
  const sw = imgNaturalW * finalScale;
  const sh = imgNaturalH * finalScale;
  // Max offset = how far the image extends beyond the circle in each direction
  const maxX = Math.max(0, (sw - canvasSize) / 2);
  const maxY = Math.max(0, (sh - canvasSize) / 2);
  return {
    scale: transform.scale,
    x: Math.max(-maxX, Math.min(maxX, transform.x)),
    y: Math.max(-maxY, Math.min(maxY, transform.y)),
  };
}

/**
 * Draw the Shining PNG frame on top of everything.
 * frameImg must be a loaded HTMLImageElement pointing at /shining-frame.png.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frameImg: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  filter?: string,
): void {
  const { x, y, size } = buildFrameDrawParams(canvasW, canvasH);
  if (filter && filter !== 'none') {
    ctx.save();
    ctx.filter = filter;
    ctx.drawImage(frameImg, x, y, size, size);
    ctx.restore();
  } else {
    ctx.drawImage(frameImg, x, y, size, size);
  }
}

/**
 * Clip the canvas contents to a circle, making corners transparent.
 * Call this last, after all drawing is done, so the downloaded PNG is circular.
 */
export function maskToCircle(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const r = Math.min(canvasW, canvasH) / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
