import { useEffect, useRef } from 'react';

const N_PARTICLES    = 800;
const ROTATION_SPEED = 0.0015;

/**
 * Responsive CSS size of the disco-ball canvas.
 * Scales with viewport so phones get a smaller ball and big screens get a
 * dramatic one. Clamped so it never vanishes or overflows.
 */
function computeSize(vw: number): { cssSize: number; sphereR: number } {
  // Base on width, floored to the phone min, ceilinged for 4K monitors
  const cssSize = Math.max(380, Math.min(1000, Math.round(vw * 0.58)));
  const sphereR = Math.round(cssSize * 0.44);
  return { cssSize, sphereR };
}

// Light source direction (unit vector)
const LIGHT = { x: -0.45, y: -0.65, z: 0.62 };
const LIGHT_LEN = Math.hypot(LIGHT.x, LIGHT.y, LIGHT.z);

// Sparkle config
const MAX_SPARKLES   = 10;
const SPARKLE_LIFE   = 22;
const SPARKLE_CHANCE = 0.025;

// Scroll parallax config
const SCROLL_Y_FACTOR = 0.35;  // how fast the ball drifts down relative to scroll
const MAX_TILT        = 0.32;  // max extra X-axis tilt from scroll (radians)
const LERP            = 0.05;

interface Tile    { ox: number; oy: number; oz: number; }
interface Sparkle { index: number; life: number; }

function buildSphere(n: number): Tile[] {
  const tiles: Tile[] = [];
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    tiles.push({ ox: Math.cos(theta) * r, oy: y, oz: Math.sin(theta) * r });
  }
  return tiles;
}

const TILES = buildSphere(N_PARTICLES);

export function DiscoBall() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const angleRef    = useRef(0);
  const sparklesRef = useRef<Sparkle[]>([]);

  // Increase opacity in light mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isLight = theme === 'light' ||
        (!theme && window.matchMedia('(prefers-color-scheme: light)').matches);
      canvas.style.opacity = isLight ? '0.65' : '0.14';
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  // Scroll state — normalised 0…1 over page height
  const targetScrollRef  = useRef(0);
  const currentScrollRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
      targetScrollRef.current = window.scrollY / maxScroll; // 0 → 1
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect prefers-reduced-motion — render a single static frame and stop
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let { cssSize: CSS_SIZE, sphereR: SPHERE_R } = computeSize(window.innerWidth);
    let FOV = CSS_SIZE * 1.1;
    let CX = CSS_SIZE / 2;
    let CY = CSS_SIZE / 2;

    const ctx = canvas.getContext('2d')!;

    // Re-run canvas DPR + geometry whenever viewport size changes
    const applySize = () => {
      const { cssSize, sphereR } = computeSize(window.innerWidth);
      CSS_SIZE = cssSize;
      SPHERE_R = sphereR;
      FOV = CSS_SIZE * 1.1;
      CX = CSS_SIZE / 2;
      CY = CSS_SIZE / 2;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = CSS_SIZE * dpr;
      canvas.height = CSS_SIZE * dpr;
      canvas.style.width  = `${CSS_SIZE}px`;
      canvas.style.height = `${CSS_SIZE}px`;
      // Nudge fixed position up/right so it still peeks from the corner at
      // every size (the offset was -180 px at the old 860 px size → -21 %)
      canvas.style.top   = `${-Math.round(CSS_SIZE * 0.21)}px`;
      canvas.style.right = `${-Math.round(CSS_SIZE * 0.21)}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    applySize();

    let resizeDebounce = 0;
    const onResize = () => {
      window.clearTimeout(resizeDebounce);
      resizeDebounce = window.setTimeout(applySize, 150);
    };
    window.addEventListener('resize', onResize);

    function spawnSparkle() {
      const list = sparklesRef.current;
      if (list.length >= MAX_SPARKLES) return;
      if (Math.random() > SPARKLE_CHANCE) return;
      const existing = new Set(list.map(s => s.index));
      const candidates = Array.from({ length: N_PARTICLES }, (_, i) => i)
        .filter(i => !existing.has(i));
      if (!candidates.length) return;
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      list.push({ index: idx, life: SPARKLE_LIFE });
    }

    function draw() {
      ctx.clearRect(0, 0, CSS_SIZE, CSS_SIZE);

      const scroll = currentScrollRef.current; // 0…1
      // X-axis tilt increases as user scrolls down
      const tiltX  = (scroll - 0.5) * MAX_TILT * 2; // -MAX_TILT … +MAX_TILT

      const totalY = angleRef.current;
      const cosY = Math.cos(totalY), sinY = Math.sin(totalY);
      const cosX = Math.cos(tiltX),  sinX = Math.sin(tiltX);

      const sparkleMap = new Map<number, number>();
      for (const s of sparklesRef.current) sparkleMap.set(s.index, s.life);

      const projected = TILES.map((t, i) => {
        // Rotate Y (continuous spin)
        const x1 =  t.ox * cosY + t.oz * sinY;
        const y1 =  t.oy;
        const z1 = -t.ox * sinY + t.oz * cosY;

        // Rotate X (scroll tilt)
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        const scale    = FOV / (FOV + z2 * SPHERE_R);
        const sx       = CX + x2 * SPHERE_R * scale;
        const sy       = CY + y2 * SPHERE_R * scale;
        const dot      = Math.max(0, (x2 * LIGHT.x + y2 * LIGHT.y + z2 * LIGHT.z) / LIGHT_LEN);
        const tileSize = Math.max(1.5, 5.0 * scale);
        const sparkLife = sparkleMap.get(i) ?? 0;

        return { sx, sy, z: z2, dot, tileSize, sparkLife };
      });

      projected.sort((a, b) => a.z - b.z);

      for (const p of projected) {
        const { sx, sy, dot, tileSize, sparkLife } = p;

        if (sparkLife > 0) {
          // Subtle: just brighten the tile to gold/white and fade back, no halo
          const t         = sparkLife / SPARKLE_LIFE;
          const intensity = Math.sin(t * Math.PI); // bell curve 0→1→0
          // Blend from tile's normal gold toward bright gold-white
          const rr = Math.round(255);
          const gg = Math.round(210 + intensity * 42); // 210 → 252
          const bb = Math.round(30  + intensity * 160); // 30  → 190
          const aa = (0.45 + intensity * 0.45).toFixed(3);
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${aa})`;
          ctx.fillRect(sx - tileSize / 2, sy - tileSize / 2, tileSize, tileSize);
          continue;
        }

        let r: number, g: number, b: number, a: number;
        if (dot > 0.82) {
          r = 255; g = 252; b = 220; a = dot * 0.95;
        } else if (dot > 0.45) {
          r = 255; g = 210; b = 30;  a = 0.4 + dot * 0.45;
        } else {
          r = 160; g = 100; b = 10;  a = 0.08 + dot * 0.35;
        }

        ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
        ctx.fillRect(sx - tileSize / 2, sy - tileSize / 2, tileSize, tileSize);
      }
    }

    function loop() {
      // Lerp scroll value
      const cur = currentScrollRef.current;
      const tgt = targetScrollRef.current;
      currentScrollRef.current += (tgt - cur) * LERP;

      // Parallax: ball drifts down AND grows as page scrolls, so by the
      // bottom it fills the entire viewport like a slowly descending sun.
      const maxPageScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
      const scrollProgress = Math.min(1, window.scrollY / maxPageScroll);
      const shiftY = window.scrollY * SCROLL_Y_FACTOR;
      // 1× at top → ~3× at bottom (eased for natural feel)
      const eased = scrollProgress * scrollProgress * (3 - 2 * scrollProgress);
      const growScale = 1 + eased * 2.2;
      // As the ball grows, drift it left so it moves from the corner toward
      // the viewport centre, covering the whole page near the end
      const shiftX = -eased * CSS_SIZE * 0.45;
      if (canvas) {
        canvas.style.transformOrigin = 'center center';
        canvas.style.transform =
          `translate(${shiftX}px, ${shiftY}px) scale(${growScale.toFixed(3)})`;
      }

      angleRef.current += ROTATION_SPEED;

      sparklesRef.current = sparklesRef.current
        .map(s => ({ ...s, life: s.life - 1 }))
        .filter(s => s.life > 0);
      spawnSparkle();

      draw();
      if (!prefersReducedMotion) {
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    if (prefersReducedMotion) {
      // Draw one static frame — no rotation, no sparkles refreshing
      draw();
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeDebounce);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '-180px',
        right: '-180px',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.14,
        willChange: 'transform',
      }}
    />
  );
}
