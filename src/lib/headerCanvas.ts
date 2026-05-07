// LinkedIn header canvas renderer for the Shining app.
// Kaleidoscope treatment of the user's uploaded photo — gold-tinted,
// diamond-faceted, wrapped in lens flares and sparkles.

/** Seeded LCG — deterministic per seed, returns [0, 1) */
function makePRNG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface HeaderOptions {
  seed: number;
  ballAngle: number;
  /** Number of kaleidoscope facets (8–28). More = busier, tighter shards. */
  slices: number;
  /** How much the photo is scaled into each facet (0.7–1.7). */
  photoScale: number;
  /** Sample-point offset within the source photo — shifts which features appear in each facet. */
  photoOffsetX: number;   // in photo naturalWidth units (-0.3 to +0.3)
  photoOffsetY: number;
  /** Multiplier on glitter + confetti density (0.6–1.8). */
  density: number;
  /** Overall gold tint hue bias. 0 = neutral, positive pushes orange, negative pushes rose. */
  hueBias: number;        // -20 to +20 degrees
  /** Brightness / bloom multiplier. */
  exposure: number;       // 0.8 to 1.3
  /** Flare + sparkle pop multiplier. */
  flareBoost: number;     // 0.5 to 1.5
  /** How heavy the gold overlay is. 0.3 = barely tinted / photo-dominant,
   *  1.3 = deeply golden. Keeps generations from all looking brown. */
  tintStrength: number;   // 0.3 to 1.3
}

/**
 * Produce a heavily-randomised HeaderOptions for a single generation.
 * Wide ranges are intentional — every "Regenerate" should feel meaningfully
 * different, not just shuffled.
 *
 * If `faceCenter` is provided (normalised 0–1 coords of the face centroid in
 * the uploaded photo), the kaleidoscope is anchored near the face so eyes,
 * nose, and mouth appear in every facet. A small jitter still adds variety.
 */
export function makeRandomHeaderOptions(
  faceCenter?: { x: number; y: number },
): HeaderOptions {
  const r = (min: number, max: number) => min + Math.random() * (max - min);
  const slicesChoices = [8, 10, 12, 14, 16, 20, 24];

  // Normalised sample point for the kaleidoscope centre. Defaults to photo
  // centre; when face centroid is known, jitter gently around it so the
  // user's features always feature prominently.
  let sampleX: number, sampleY: number;
  if (faceCenter) {
    sampleX = Math.max(0.12, Math.min(0.88, faceCenter.x + r(-0.04, 0.04)));
    sampleY = Math.max(0.12, Math.min(0.88, faceCenter.y + r(-0.04, 0.04)));
  } else {
    // Gentler random range than before — stays closer to image centre so
    // we don't sample background corners when we have no face info.
    sampleX = 0.5 + r(-0.12, 0.12);
    sampleY = 0.5 + r(-0.10, 0.10);
  }

  return {
    seed:         Math.floor(Math.random() * 1_000_000),
    ballAngle:    r(0, Math.PI * 2),
    slices:       slicesChoices[Math.floor(Math.random() * slicesChoices.length)],
    photoScale:   r(1.2, 2.5),
    photoOffsetX: sampleX,
    photoOffsetY: sampleY,
    density:      r(0.6, 1.75),
    hueBias:      r(-22, 22),
    exposure:     r(0.82, 1.28),
    flareBoost:   r(0.55, 1.5),
    tintStrength: r(0.35, 1.25),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fillHexFlare(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  orient: number,
  innerColor: string, midColor: string,
) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = orient + (i / 6) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0,    innerColor);
  g.addColorStop(0.55, midColor);
  g.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** 8-point sparkle star — soft glow + crossed rays. */
function drawSparkleStar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  alpha: number, gold: boolean,
) {
  const rimR = gold ? 255 : 255;
  const rimG = gold ? 222 : 248;
  const rimB = gold ? 90  : 220;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Soft central glow
  const glowR = size * 3.2;
  const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
  g.addColorStop(0,    `rgba(255,252,235,${(alpha * 0.95).toFixed(2)})`);
  g.addColorStop(0.18, `rgba(${rimR},${rimG},${rimB},${(alpha * 0.55).toFixed(2)})`);
  g.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Long 4-point cross rays
  ctx.strokeStyle = `rgba(255,252,235,${(alpha * 0.95).toFixed(2)})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.6, size * 0.22);
  ctx.beginPath();
  ctx.moveTo(x - size * 2.4, y);  ctx.lineTo(x + size * 2.4, y);
  ctx.moveTo(x, y - size * 2.4);  ctx.lineTo(x, y + size * 2.4);
  ctx.stroke();

  // Shorter diagonal rays
  ctx.lineWidth = Math.max(0.4, size * 0.12);
  ctx.strokeStyle = `rgba(255,240,175,${(alpha * 0.75).toFixed(2)})`;
  const d = size * 1.1;
  ctx.beginPath();
  ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
  ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
  ctx.stroke();

  ctx.restore();
}

function drawConfetti(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number,
  rotY: number, rotZ: number,
  color: string,
) {
  // Simulate a 3D rectangle by squishing width (cos of the Y-rotation)
  const w = size * Math.abs(Math.cos(rotY));
  const h = size * 0.45;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotZ);
  ctx.fillStyle = color;
  // Small "lit" face
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // Subtle darker edge on the side to suggest depth
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2, -h / 2, Math.max(0.5, w * 0.12), h);
  ctx.restore();
}

/**
 * Kaleidoscope — classic canvas technique: clip to a wedge, draw the source image
 * translated so the sampled region lands at the wedge apex, then rotate around
 * the center. Alternate wedges are mirrored (scale -1,1) so adjacent slices
 * reflect each other into the jewel-like pattern.
 */
function drawKaleidoscope(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  cx: number, cy: number, radius: number,
  slices: number,
  rotation: number,
  photoScale: number,
  sampleX: number,       // normalised 0–1 of photo — the pixel to land at the wedge apex
  sampleY: number,
): void {
  const sliceAngle = (Math.PI * 2) / slices;
  const halfA = sliceAngle / 2;
  const imgW = photo.naturalWidth;
  const imgH = photo.naturalHeight;

  // Normalise the photo to a draw target centred on the wedge apex.
  // photoScale lets us zoom into the photo so finer detail fills the kaleidoscope.
  // 3.2× radius ensures every wedge is fully covered with no background gaps.
  const drawDim = radius * 3.2 * photoScale;
  const aspect  = imgW / imgH;
  const drawW = aspect >= 1 ? drawDim * aspect : drawDim;
  const drawH = aspect >= 1 ? drawDim         : drawDim / aspect;

  // Draw ONE source wedge into an offscreen canvas, then stamp + mirror it.
  // This guarantees every pair of adjacent slices is a perfect reflection.
  const offW = Math.ceil(radius * 1.02);
  const offH = Math.ceil(2 * radius * Math.tan(halfA) * 1.02);
  const off = document.createElement('canvas');
  off.width = offW;
  off.height = offH;
  const oCtx = off.getContext('2d')!;

  // Clip to a triangle (apex at left edge, fan out to right)
  oCtx.beginPath();
  oCtx.moveTo(0, offH / 2);
  oCtx.lineTo(offW, 0);
  oCtx.lineTo(offW, offH);
  oCtx.closePath();
  oCtx.clip();

  // Draw the photo so the sample point lands at the apex (0, offH/2)
  oCtx.drawImage(
    photo,
    -sampleX * drawW,
    offH / 2 - sampleY * drawH,
    drawW, drawH,
  );

  for (let i = 0; i < slices; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation + i * sliceAngle - halfA);

    // Even slices: draw as-is. Odd slices: flip vertically for mirror.
    if (i % 2 === 1) {
      ctx.scale(1, -1);
    }

    // Draw the pre-rendered wedge: apex at (0,0), fanning outward
    ctx.drawImage(off, 0, -offH / 2);
    ctx.restore();
  }
}

// ── Main renderer ───────────────────────────────────────────────────────────

export function renderLinkedInHeader(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  photo: HTMLImageElement | null,
  frame: HTMLImageElement | null,
  opts: HeaderOptions,
  includeText = false,
  /** CSS filter (e.g. "hue-rotate(-25deg) saturate(0.95)") applied as a final
   * pass over the entire banner. Matches the user's chosen frame style. */
  tintFilter?: string,
): void {
  const {
    seed, ballAngle,
    slices       = 18,
    photoScale   = 1.15,
    photoOffsetX = 0.08,
    photoOffsetY = 0.05,
    density      = 1.0,
    hueBias      = 0,
    exposure     = 1.0,
    flareBoost   = 1.0,
    tintStrength = 0.85,
  } = opts;
  const rng = makePRNG(seed);

  // ── Background — soft cream / champagne base ─────────────────────────────
  ctx.clearRect(0, 0, W, H);

  // Dark base so any gaps in the kaleidoscope blend into the page background
  ctx.fillStyle = '#0c0700';
  ctx.fillRect(0, 0, W, H);

  // Rose sunrise tint from upper-left — softer on a light background
  const roseG = ctx.createRadialGradient(W * 0.15, -H * 0.2, 0, W * 0.15, -H * 0.2, W * 0.9);
  roseG.addColorStop(0,   'rgba(255,180,150,0.28)');
  roseG.addColorStop(0.4, 'rgba(240,160,100,0.12)');
  roseG.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = roseG;
  ctx.fillRect(0, 0, W, H);

  // Kaleidoscope centred in the banner and sized to cover it entirely —
  // the jewel now BECOMES the header rather than sitting to one side.
  const ballCX   = Math.round(W * 0.50);
  const ballCY   = Math.round(H * 1.00);
  const BALL_R   = Math.round(H * 0.46);                 // visual / frame reference size
  const KALEIDO_R = Math.round(Math.hypot(W / 2, H)) + 4; // covers every corner from bottom-center

  // Bigger, warmer glow behind the ball
  const warmG = ctx.createRadialGradient(ballCX, ballCY, 0, ballCX, ballCY, W * 0.50);
  warmG.addColorStop(0,   'rgba(255,185,60,0.32)');
  warmG.addColorStop(0.25,'rgba(230,150,40,0.18)');
  warmG.addColorStop(0.6, 'rgba(130, 80, 20,0.07)');
  warmG.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = warmG;
  ctx.fillRect(0, 0, W, H);

  // Faint blurred photo in background
  if (photo) {
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.filter = 'blur(55px)';
    const sc = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    ctx.drawImage(
      photo,
      (W - photo.naturalWidth * sc) / 2,
      (H - photo.naturalHeight * sc) / 2,
      photo.naturalWidth * sc,
      photo.naturalHeight * sc,
    );
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Warm-gold vignette — tints edges instead of darkening them (works on light bg)
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  vig.addColorStop(0, 'rgba(210,150,50,0)');
  vig.addColorStop(1, 'rgba(200,135,40,0.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // ── Far depth — gold specks (darker so they read on a white base) ────────
  const nFar = Math.floor((320 + rng() * 160) * density);
  for (let i = 0; i < nFar; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const sz = 0.3 + rng() * 1.0;
    const al = 0.12 + rng() * 0.38;
    const v = Math.round(80 + rng() * 80);
    ctx.fillStyle = `rgba(${Math.round(v + 80)},${Math.round(v + 20)},${Math.round(v - 30)},${al.toFixed(2)})`;
    ctx.fillRect(x, y, sz, sz);
  }

  // ── Mid-depth glitter — darker gold + rose so it reads on white ─────────
  const nMid = Math.floor((480 + rng() * 200) * density);
  for (let i = 0; i < nMid; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const sz = 0.5 + rng() * 2.6;
    const al = 0.20 + rng() * 0.55;
    const br = rng();
    const pick = rng();
    if (pick > 0.55) {
      // Deep gold
      ctx.fillStyle = `rgba(${Math.round(170 + br * 50)},${Math.round(120 + br * 40)},${Math.round(20 + br * 20)},${al.toFixed(2)})`;
    } else if (pick > 0.22) {
      // Amber
      ctx.fillStyle = `rgba(${Math.round(200 + br * 40)},${Math.round(145 + br * 40)},${Math.round(40 + br * 30)},${(al * 0.85).toFixed(2)})`;
    } else {
      // Rose / coral accent
      ctx.fillStyle = `rgba(${Math.round(210 + br * 30)},${Math.round(110 + br * 40)},${Math.round(85 + br * 35)},${(al * 0.85).toFixed(2)})`;
    }
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }

  // ── Volumetric light beam (wide cone from the light source) ─────────────
  const lfx = W * (0.06 + rng() * 0.09);
  const lfy = H * (0.04 + rng() * 0.14);

  {
    // Beam direction — roughly toward the main ball / bottom-right
    const targetX = W * 0.55 + (rng() - 0.5) * 100;
    const targetY = H * 1.05;
    const beamAng = Math.atan2(targetY - lfy, targetX - lfx);
    const beamLen = Math.hypot(targetX - lfx, targetY - lfy) * 1.1;
    const spread  = 0.55;
    ctx.save();
    ctx.translate(lfx, lfy);
    ctx.rotate(beamAng);
    ctx.globalCompositeOperation = 'lighter';
    const beamG = ctx.createLinearGradient(0, 0, beamLen, 0);
    beamG.addColorStop(0,    'rgba(255,240,180,0.18)');
    beamG.addColorStop(0.15, 'rgba(255,220,110,0.14)');
    beamG.addColorStop(0.6,  'rgba(210,150,30,0.05)');
    beamG.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = beamG;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(beamLen, -Math.tan(spread) * beamLen);
    ctx.lineTo(beamLen,  Math.tan(spread) * beamLen);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // ── Full-bleed golden kaleidoscope — fills the entire banner ────────────
  if (photo) {
    // No clip — the kaleidoscope takes up the whole canvas as the hero visual.
    // photoOffsetX/Y are NORMALISED (0–1). When face detection supplies them
    // they point at the face centroid; otherwise a random near-centre sample.
    // Rotation locked to -π/2 so a wedge boundary points straight up from
    // the bottom-centre origin. Combined with the odd/even mirroring this
    // guarantees perfect bilateral (left–right) symmetry every time.
    drawKaleidoscope(
      ctx, photo,
      ballCX, ballCY, KALEIDO_R,
      slices,
      -Math.PI / 2,
      photoScale,
      photoOffsetX,
      photoOffsetY,
    );

    // Warm gold tint — sized to cover the full canvas
    // Hue-biased gold tint using OVERLAY (preserves the photo's highlights &
    // shadows instead of flattening them into a uniform brown the way
    // 'multiply' does). `tintStrength` further varies the intensity per
    // generation, so some results are heavily golden, others almost natural.
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const tint = ctx.createRadialGradient(ballCX, ballCY, 0, ballCX, ballCY, KALEIDO_R);
    const ts = tintStrength;
    tint.addColorStop(0,    `hsla(${50 + hueBias}, 95%, 70%, ${(0.85 * ts).toFixed(3)})`);
    tint.addColorStop(0.45, `hsla(${40 + hueBias}, 85%, 50%, ${(0.72 * ts).toFixed(3)})`);
    tint.addColorStop(1,    `hsla(${30 + hueBias}, 80%, 30%, ${(0.80 * ts).toFixed(3)})`);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Contrast boost — lifts highlights, deepens shadows. Uses a soft-light
    // S-curve-ish pass so the photo retains dynamic range.
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const contrastGrad = ctx.createLinearGradient(0, 0, 0, H);
    contrastGrad.addColorStop(0,   `rgba(255,255,255,${(0.35 * exposure).toFixed(3)})`);
    contrastGrad.addColorStop(0.5, 'rgba(180,180,180,0.10)');
    contrastGrad.addColorStop(1,   `rgba(0,0,0,${(0.30 * exposure).toFixed(3)})`);
    ctx.fillStyle = contrastGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Warm sheen — screen blend adds a final pop of gold on the highlights
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    const sA = Math.min(0.45, 0.22 * exposure);
    const sB = Math.min(0.22, 0.08 * exposure);
    const sC = Math.min(0.40, 0.18 * exposure);
    sheen.addColorStop(0,   `rgba(255,240,180,${sA.toFixed(3)})`);
    sheen.addColorStop(0.5, `rgba(200,150,40,${sB.toFixed(3)})`);
    sheen.addColorStop(1,   `rgba(255,220,120,${sC.toFixed(3)})`);
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Facet edge lines — rays radiating from the centre, fading to edges.
    // Same slice count as the kaleidoscope so the cuts align with the photo facets.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rayLen = Math.max(W, H) * 0.7;
    for (let i = 0; i < slices; i++) {
      const a = -Math.PI / 2 + (i / slices) * Math.PI * 2;
      const grad = ctx.createLinearGradient(
        ballCX, ballCY,
        ballCX + Math.cos(a) * rayLen,
        ballCY + Math.sin(a) * rayLen,
      );
      grad.addColorStop(0,    'rgba(255,250,220,0.75)');
      grad.addColorStop(0.15, 'rgba(255,225,130,0.40)');
      grad.addColorStop(1,    'rgba(255,200,70,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(ballCX, ballCY);
      ctx.lineTo(
        ballCX + Math.cos(a) * rayLen,
        ballCY + Math.sin(a) * rayLen,
      );
      ctx.stroke();
    }
    ctx.restore();

    // Bright centre star — where every facet converges
    const ctr = ctx.createRadialGradient(ballCX, ballCY, 0, ballCX, ballCY, BALL_R * 0.45);
    ctr.addColorStop(0,   'rgba(255,252,230,0.90)');
    ctr.addColorStop(0.2, 'rgba(255,220,120,0.55)');
    ctr.addColorStop(0.6, 'rgba(210,150,40,0.12)');
    ctr.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = ctr;
    ctx.beginPath();
    ctx.arc(ballCX, ballCY, BALL_R * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cross sparkle at the centre
    drawSparkleStar(ctx, ballCX, ballCY, 12, 1, true);

    // Frame overlay deliberately skipped — a gold crescent on top of a full-
    // bleed gold kaleidoscope blends in and competes with the text.
    void frame;
  }

  // Ambient halo around the diamond
  const halo = ctx.createRadialGradient(
    ballCX, ballCY, BALL_R * 0.9,
    ballCX, ballCY, BALL_R * 2.1,
  );
  halo.addColorStop(0, 'rgba(230,170,40,0.12)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Bright facet sparkle dots on the diamond
  const nSparkles = 32 + Math.floor(rng() * 22);
  for (let i = 0; i < nSparkles; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = rng() * BALL_R * 0.9;
    const spx = ballCX + Math.cos(ang) * rad;
    const spy = ballCY + Math.sin(ang) * rad;
    const spSz = 1.2 + rng() * 4.5;
    const spAl = 0.45 + rng() * 0.55;
    const spGlo = ctx.createRadialGradient(spx, spy, 0, spx, spy, spSz * 4.5);
    spGlo.addColorStop(0,    `rgba(255,252,220,${spAl.toFixed(2)})`);
    spGlo.addColorStop(0.22, `rgba(255,218,70,${(spAl * 0.42).toFixed(2)})`);
    spGlo.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = spGlo;
    ctx.beginPath();
    ctx.arc(spx, spy, spSz * 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Primary lens flare burst ────────────────────────────────────────────
  const burst = ctx.createRadialGradient(lfx, lfy, 0, lfx, lfy, H * 1.15);
  burst.addColorStop(0,    'rgba(255,250,210,0.82)');
  burst.addColorStop(0.03, 'rgba(255,228,120,0.42)');
  burst.addColorStop(0.12, 'rgba(200,150,28,0.12)');
  burst.addColorStop(0.38, 'rgba(90,55,5,0.04)');
  burst.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = burst;
  ctx.fillRect(0, 0, W, H);

  // 8-point star rays
  const drawRay = (cx: number, cy: number, angle: number, len: number, w: number, al: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0,    `rgba(255,248,195,${al.toFixed(2)})`);
    g.addColorStop(0.12, `rgba(255,220,95,${(al * 0.55).toFixed(2)})`);
    g.addColorStop(0.55, `rgba(200,155,35,${(al * 0.15).toFixed(2)})`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -w / 2, len, w);
    ctx.restore();
  };

  // Cleaner 4-point star (cross + light diagonals), no extra noisy rays
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    drawRay(lfx, lfy, a,                H * 1.35, 3.2, 0.38);
    drawRay(lfx, lfy, a + Math.PI / 4,  H * 0.72, 1.2, 0.18);
  }

  // Anamorphic horizontal streak
  const stk = ctx.createLinearGradient(0, 0, W, 0);
  const t0  = Math.max(0, lfx / W - 0.20);
  const t1  = Math.min(1, lfx / W + 0.20);
  stk.addColorStop(0,       'rgba(255,220,80,0)');
  stk.addColorStop(t0,      'rgba(255,220,80,0.01)');
  stk.addColorStop(lfx / W, 'rgba(255,248,200,0.62)');
  stk.addColorStop(t1,      'rgba(255,220,80,0.01)');
  stk.addColorStop(1,       'rgba(255,220,80,0)');
  ctx.fillStyle = stk;
  ctx.fillRect(0, lfy - 2.8, W, 5.5);

  // ── Hexagonal aperture flares along flare axis ──────────────────────────
  const axX = W * 0.88 - lfx;
  const axY = H * 0.88 - lfy;
  // Refined — fewer, more widely spaced flares along the axis
  const flareConfigs = [
    { t: 0.30 + rng() * 0.06, r: 24 + rng() * 10, al: 0.22, hex: false },
    { t: 0.58 + rng() * 0.05, r: 14 + rng() * 10, al: 0.28, hex: true  },
    { t: 0.84 + rng() * 0.05, r: 38 + rng() * 20, al: 0.08, hex: false },
    { t: 1.02 + rng() * 0.05, r: 22 + rng() * 12, al: 0.16, hex: true  },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const fl of flareConfigs) {
    const fx = lfx + axX * fl.t;
    const fy = lfy + axY * fl.t;
    if (fl.hex) {
      fillHexFlare(
        ctx, fx, fy, fl.r,
        rng() * Math.PI,
        `rgba(255,240,175,${fl.al.toFixed(2)})`,
        `rgba(210,168,55,${(fl.al * 0.4).toFixed(2)})`,
      );
    } else {
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fl.r);
      fg.addColorStop(0,   `rgba(255,245,175,${fl.al.toFixed(2)})`);
      fg.addColorStop(0.4, `rgba(210,168,55,${(fl.al * 0.42).toFixed(2)})`);
      fg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, fy, fl.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ── Prismatic rainbow arc — DISABLED for cleaner composition ────────────
  if (false) {
    const rainbowAxis = 0.62 + rng() * 0.08;
    const rcx = lfx + axX * rainbowAxis;
    const rcy = lfy + axY * rainbowAxis;
    const rR  = 55 + rng() * 30;
    const rainbow: [string, number][] = [
      ['rgba(255,80,80,0.10)',   0],
      ['rgba(255,190,60,0.11)',  2],
      ['rgba(255,245,120,0.12)', 4],
      ['rgba(120,255,160,0.10)', 6],
      ['rgba(90,180,255,0.10)',  8],
      ['rgba(190,120,255,0.09)', 10],
    ];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const arcStart = Math.PI * 0.15;
    const arcEnd   = Math.PI * 0.85;
    for (const [color, off] of rainbow) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rcx, rcy, rR + off, arcStart, arcEnd);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Foreground bokeh — fewer, softer, concentrated in the left half ─────
  const nBokeh = Math.max(2, Math.floor((3 + rng() * 3) * density));
  for (let i = 0; i < nBokeh; i++) {
    // Weight position toward the diamond area (left two-thirds)
    const bx = rng() * W * 0.78;
    const by = rng() * H;
    const br = 50 + rng() * 70;
    const ba = 0.05 + rng() * 0.10;
    const bGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bGrad.addColorStop(0,   `rgba(255,225,130,${ba.toFixed(2)})`);
    bGrad.addColorStop(0.55,`rgba(220,170,55,${(ba * 0.5).toFixed(2)})`);
    bGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Floating gold confetti — sparse, clustered around the diamond ──────
  const nConfetti = Math.floor((32 + rng() * 22) * density);
  for (let i = 0; i < nConfetti; i++) {
    // 70% clustered around the left diamond area; 30% scattered anywhere
    const cluster = rng() < 0.70;
    const x    = cluster
      ? ballCX + (rng() - 0.5) * W * 0.55
      : rng() * W;
    const y    = cluster
      ? ballCY + (rng() - 0.5) * H * 0.95
      : rng() * H;
    const size = 3 + rng() * 10;
    const rotY = rng() * Math.PI;
    const rotZ = (rng() - 0.5) * Math.PI;
    const al   = 0.30 + rng() * 0.55;
    const br   = 0.75 + rng() * 0.25;
    const pick = rng();
    let color: string;
    if (pick > 0.40) {
      // Gold — most confetti
      color = `rgba(${Math.round(195 * br + 30)},${Math.round(145 * br + 25)},${Math.round(25 * br)},${al.toFixed(2)})`;
    } else {
      // Rose / coral — accent
      color = `rgba(${Math.round(230 * br)},${Math.round(140 * br + 10)},${Math.round(110 * br + 15)},${(al * 0.85).toFixed(2)})`;
    }
    drawConfetti(ctx, x, y, size, rotY, rotZ, color);
  }

  // ── Sparkle stars — fewer, concentrated near the diamond for emphasis ──
  const nSparkleStars = Math.max(6, Math.floor((18 + rng() * 10) * density * flareBoost));
  for (let i = 0; i < nSparkleStars; i++) {
    // 75% cluster near the diamond within an elliptical region
    const cluster = rng() < 0.75;
    const x = cluster
      ? ballCX + (rng() - 0.5) * BALL_R * 3.2
      : rng() * W;
    const y = cluster
      ? ballCY + (rng() - 0.5) * BALL_R * 2.6
      : rng() * H;
    const size = cluster ? 3 + rng() * 5.5 : 2 + rng() * 3;
    const al   = 0.55 + rng() * 0.45;
    const gold = rng() > 0.30;
    drawSparkleStar(ctx, x, y, size, al, gold);
  }

  // ── Foreground bright glints — fewer, weighted toward the diamond ──────
  const nGlints = Math.max(3, Math.floor((8 + rng() * 5) * flareBoost));
  for (let i = 0; i < nGlints; i++) {
    const cluster = rng() < 0.6;
    const x = cluster ? ballCX + (rng() - 0.5) * BALL_R * 2.4 : rng() * W;
    const y = cluster ? ballCY + (rng() - 0.5) * BALL_R * 2.2 : rng() * H;
    const r = 2.5 + rng() * 6;
    const al = 0.5 + rng() * 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    g.addColorStop(0,    `rgba(255,252,230,${al.toFixed(2)})`);
    g.addColorStop(0.22, `rgba(255,225,90,${(al * 0.5).toFixed(2)})`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 6, 0, Math.PI * 2);
    ctx.fill();

    // Tiny cross-ray on the brightest ones
    if (al > 0.85) {
      ctx.strokeStyle = `rgba(255,248,210,${(al * 0.7).toFixed(2)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - r * 4, y); ctx.lineTo(x + r * 4, y);
      ctx.moveTo(x, y - r * 4); ctx.lineTo(x, y + r * 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (includeText) {
    // ── Centred dark backdrop behind the text — radial for soft edges ──────
    const tbg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.38);
    tbg.addColorStop(0,   'rgba(22,10,0,0.55)');
    tbg.addColorStop(0.55,'rgba(22,10,0,0.28)');
    tbg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = tbg;
    ctx.fillRect(0, 0, W, H);

    // ── Centred "I am #SHINING" headline + website URL ─────────────────────
    const tx      = W * 0.5;
    const tCenter = H * 0.5;
    const serif   = '"DM Serif Display", "Playfair Display", Georgia, serif';
    const sans    = '"DM Sans", system-ui, sans-serif';

    const label  = 'I am ';
    const accent = '#SHINING';

    ctx.save();
    ctx.font = `italic 98px ${serif}`;
    ctx.textBaseline = 'middle';
    const labelW  = ctx.measureText(label).width;
    const accentW = ctx.measureText(accent).width;
    const totalW  = labelW + accentW;
    const startX  = tx - totalW / 2;

    ctx.textAlign = 'left';
    // No shadow — clean gold text

    // "I am" in gold gradient (matching #SHINING)
    const iamGrad = ctx.createLinearGradient(
      startX, tCenter - 40,
      startX + labelW, tCenter + 40,
    );
    iamGrad.addColorStop(0,    '#c9991e');
    iamGrad.addColorStop(0.3,  '#ffd866');
    iamGrad.addColorStop(0.5,  '#fff5c5');
    iamGrad.addColorStop(0.7,  '#ffd866');
    iamGrad.addColorStop(1,    '#c9991e');
    ctx.fillStyle = iamGrad;
    ctx.fillText(label, startX, tCenter - 10);

    // "#SHINING" in brighter gold gradient
    const shineGrad = ctx.createLinearGradient(
      startX + labelW, tCenter - 40,
      startX + totalW, tCenter + 40,
    );
    shineGrad.addColorStop(0,    '#c9991e');
    shineGrad.addColorStop(0.25, '#ffd866');
    shineGrad.addColorStop(0.5,  '#fff5c5');
    shineGrad.addColorStop(0.75, '#ffd866');
    shineGrad.addColorStop(1,    '#c9991e');
    ctx.fillStyle = shineGrad;
    ctx.fillText(accent, startX + labelW, tCenter - 10);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 16px ${sans}`;
    (ctx as unknown as { letterSpacing?: string }).letterSpacing = '0.14em';
    // No shadow — clean gold URL text
    const urlGrad = ctx.createLinearGradient(
      tx - 80, tCenter + 72,
      tx + 80, tCenter + 72,
    );
    urlGrad.addColorStop(0,   '#c9991e');
    urlGrad.addColorStop(0.5, '#ffd866');
    urlGrad.addColorStop(1,   '#c9991e');
    ctx.fillStyle = urlGrad;
    ctx.fillText('i-am-shining.com', tx, tCenter + 72);
    ctx.restore();

    const flankOff = (labelW + accentW) / 2 + 40;
    drawSparkleStar(ctx, tx - flankOff, tCenter - 6, 4.5, 0.9, true);
    drawSparkleStar(ctx, tx + flankOff, tCenter + 2, 4,   0.85, true);
  }

  // ── Film grain (very subtle, speckle approach) ──────────────────────────
  const nGrain = 1100;
  for (let i = 0; i < nGrain; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const v = Math.round(90 + rng() * 160);
    ctx.fillStyle = `rgba(${v},${v},${v},0.025)`;
    ctx.fillRect(x, y, 1, 1);
  }

  // ── Frame style tint pass ─────────────────────────────────────────────
  // Re-blits the canvas onto itself through a CSS filter so the entire
  // banner takes on the user's chosen accent (rose, silver, etc.). Done
  // last so every layer (kaleidoscope, sparkles, text, grain) is tinted
  // uniformly.
  if (tintFilter && tintFilter !== 'none') {
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    const tmp = document.createElement('canvas');
    tmp.width = cw;
    tmp.height = ch;
    const tctx = tmp.getContext('2d');
    if (tctx) {
      tctx.drawImage(ctx.canvas, 0, 0);
      ctx.save();
      // Reset transform so the blit lands in raw pixel coordinates,
      // independent of any DPR scale the caller applied.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.filter = tintFilter;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    }
  }
}
