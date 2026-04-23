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
    [0.00, `hsla(0,   90%, 60%, ${alpha})`],
    [0.16, `hsla(30,  95%, 62%, ${alpha})`],
    [0.33, `hsla(60,  90%, 65%, ${alpha})`],
    [0.50, `hsla(160, 80%, 58%, ${alpha})`],
    [0.66, `hsla(220, 85%, 65%, ${alpha})`],
    [0.83, `hsla(280, 80%, 65%, ${alpha})`],
    [1.00, `hsla(330, 90%, 62%, ${alpha})`],
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
 * Rainbow diagonal gradient at 'overlay' blend + warm golden bloom at 'screen'.
 */
export function applyIridescentEffect(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  intensity: number,
  hueOffset: number,
): void {
  if (intensity <= 0) return;

  const stops = getIridescentStops(intensity);
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

  // Warm golden bloom at 'screen' blend for 70s glow
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
