import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const N_PARTICLES = 900;
const ROTATION_SPEED = 0.0012;
const SCROLL_Y_FACTOR = 0.35;
const MAX_TILT = 0.32;
const LERP = 0.05;

// Sparkle config
const MAX_SPARKLES = 14;
const SPARKLE_LIFE = 28;
const SPARKLE_CHANCE = 0.03;

/** Fibonacci sphere for even tile distribution */
function fibSphere(n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return pts;
}

interface BallState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: THREE.InstancedMesh;
  sparkleSet: Set<number>;
  sparkleTimers: Map<number, number>;
  basePositions: THREE.Vector3[];
  sphereGroup: THREE.Group;
  dummy: THREE.Object3D;
  color: THREE.Color;
}

function createBall(
  canvas: HTMLCanvasElement,
  size: number,
  lightDir: THREE.Vector3,
): BallState {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const scene = new THREE.Scene();

  // Camera far enough back to see the full sphere even at max scale
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0);

  // Group that holds everything — rotation + scale applied here
  const sphereGroup = new THREE.Group();
  scene.add(sphereGroup);

  const basePositions = fibSphere(N_PARTICLES);

  // Round particle geometry
  const tileGeo = new THREE.CircleGeometry(0.018, 12);

  // Gold material
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.95,
    roughness: 0.15,
    emissive: 0x3a2800,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  const particles = new THREE.InstancedMesh(tileGeo, tileMat, N_PARTICLES);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const up = new THREE.Vector3(0, 0, 1);
  const norm = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  for (let i = 0; i < N_PARTICLES; i++) {
    const p = basePositions[i];
    norm.copy(p).normalize();
    dummy.position.copy(norm);
    quat.setFromUnitVectors(up, norm);
    dummy.quaternion.copy(quat);
    dummy.updateMatrix();
    particles.setMatrixAt(i, dummy.matrix);
    color.set(0xffd700);
    particles.setColorAt(i, color);
  }
  particles.instanceMatrix.needsUpdate = true;
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
  sphereGroup.add(particles);

  // Lighting — stable, no randomness
  const ambient = new THREE.AmbientLight(0x4a3010, 0.6);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffeedd, 2.5);
  key.position.copy(lightDir).multiplyScalar(5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffcc66, 0.8);
  fill.position.set(lightDir.x * -3, lightDir.y * 0.5, lightDir.z * 2);
  scene.add(fill);

  const point = new THREE.PointLight(0xffaa00, 1.5, 10);
  point.position.copy(lightDir).multiplyScalar(2.5);
  scene.add(point);

  return {
    scene,
    camera,
    renderer,
    particles,
    sparkleSet: new Set(),
    sparkleTimers: new Map(),
    basePositions,
    sphereGroup,
    dummy,
    color,
  };
}

function updateBall(
  state: BallState,
  angle: number,
  tiltX: number,
  radiusScale: number,
  rotDir: number,
  lightDir: THREE.Vector3,
) {
  const { particles, sparkleSet, sparkleTimers, basePositions, sphereGroup, dummy, color } = state;
  const up = new THREE.Vector3(0, 0, 1);
  const norm = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  sphereGroup.rotation.y = angle * rotDir;
  sphereGroup.rotation.x = tiltX;
  sphereGroup.scale.setScalar(radiusScale);

  // Pull camera back as sphere grows so it's never clipped
  state.camera.position.z = 5 + (radiusScale - 1) * 1.5;

  // Spawn sparkle
  if (sparkleSet.size < MAX_SPARKLES && Math.random() < SPARKLE_CHANCE) {
    const candidates: number[] = [];
    for (let i = 0; i < N_PARTICLES; i++) {
      if (!sparkleSet.has(i)) candidates.push(i);
    }
    if (candidates.length > 0) {
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      sparkleSet.add(idx);
      sparkleTimers.set(idx, SPARKLE_LIFE);
    }
  }

  // Update colours + sparkle scales
  const lightDirNorm = lightDir.clone().normalize();
  for (let i = 0; i < N_PARTICLES; i++) {
    const p = basePositions[i];
    const dot = Math.max(0, p.dot(lightDirNorm));
    const sparkLife = sparkleTimers.get(i) ?? 0;

    if (sparkLife > 0) {
      const t = sparkLife / SPARKLE_LIFE;
      const intensity = Math.sin(t * Math.PI);
      color.setRGB(1, 0.85 + intensity * 0.15, 0.3 + intensity * 0.7);

      norm.copy(p).normalize();
      dummy.position.copy(norm);
      quat.setFromUnitVectors(up, norm);
      dummy.quaternion.copy(quat);
      const sparkScale = 1 + intensity * 1.8;
      dummy.scale.set(sparkScale, sparkScale, sparkScale);
      dummy.updateMatrix();
      particles.setMatrixAt(i, dummy.matrix);

      sparkleTimers.set(i, sparkLife - 1);
      if (sparkLife - 1 <= 0) {
        sparkleSet.delete(i);
        sparkleTimers.delete(i);
      }
    } else {
      if (dot > 0.82) {
        color.setRGB(1, 0.98, 0.86);
      } else if (dot > 0.45) {
        color.setRGB(1, 0.82, 0.12);
      } else {
        color.setRGB(0.55, 0.35, 0.04);
      }

      norm.copy(p).normalize();
      dummy.position.copy(norm);
      quat.setFromUnitVectors(up, norm);
      dummy.quaternion.copy(quat);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      particles.setMatrixAt(i, dummy.matrix);
    }

    particles.setColorAt(i, color);
  }

  particles.instanceMatrix.needsUpdate = true;
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
}

export function DiscoBall() {
  const containerRef = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(0);
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);

  // Theme-aware opacity
  useEffect(() => {
    const c1 = containerRef.current;
    const c2 = container2Ref.current;
    if (!c1 || !c2) return;
    const update = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isLight = theme === 'light' ||
        (!theme && window.matchMedia('(prefers-color-scheme: light)').matches);
      const op = isLight ? '0.55' : '0.14';
      c1.style.opacity = op;
      c2.style.opacity = op;
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  // Scroll tracking
  useEffect(() => {
    const onScroll = () => {
      const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
      targetScrollRef.current = window.scrollY / maxScroll;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const c1 = containerRef.current;
    const c2 = container2Ref.current;
    if (!c1 || !c2) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Each ball gets half the viewport width so they sit side by side
    const halfW = Math.round(window.innerWidth / 2);
    const canvasSize = Math.max(halfW, window.innerHeight);

    // Create canvases
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    canvas1.style.width = '100%';
    canvas1.style.height = '100%';
    canvas2.style.width = '100%';
    canvas2.style.height = '100%';
    c1.appendChild(canvas1);
    c2.appendChild(canvas2);

    const LIGHT1 = new THREE.Vector3(-0.45, -0.65, 0.62).normalize();
    const LIGHT2 = new THREE.Vector3(0.45, 0.65, 0.62).normalize();

    const ball1 = createBall(canvas1, canvasSize, LIGHT1);
    const ball2 = createBall(canvas2, canvasSize, LIGHT2);

    // Resize handler
    let resizeDebounce = 0;
    const applySize = () => {
      const newHalf = Math.round(window.innerWidth / 2);
      const newSize = Math.max(newHalf, window.innerHeight);

      for (const ball of [ball1, ball2]) {
        ball.renderer.setSize(newSize, newSize);
        ball.camera.aspect = 1;
        ball.camera.updateProjectionMatrix();
      }

      c1.style.width = `${newSize}px`;
      c1.style.height = `${newSize}px`;
      c2.style.width = `${newSize}px`;
      c2.style.height = `${newSize}px`;
    };
    applySize();

    const onResize = () => {
      window.clearTimeout(resizeDebounce);
      resizeDebounce = window.setTimeout(applySize, 150);
    };
    window.addEventListener('resize', onResize);

    function loop() {
      // Lerp scroll
      const cur = currentScrollRef.current;
      const tgt = targetScrollRef.current;
      currentScrollRef.current += (tgt - cur) * LERP;

      const scroll = currentScrollRef.current;
      const tiltX = (scroll - 0.5) * MAX_TILT * 2;

      // Start big, shrink as user scrolls down
      const maxPageScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
      const scrollProgress = Math.min(1, window.scrollY / maxPageScroll);
      const eased = scrollProgress * scrollProgress * (3 - 2 * scrollProgress);
      const radiusScale = 3.2 - eased * 2.2;

      // Drift balls toward centre as they grow
      const shiftY = window.scrollY * SCROLL_Y_FACTOR;

      if (c1) c1.style.transform = `translateY(calc(-50% + ${shiftY}px))`;
      if (c2) c2.style.transform = `translateY(calc(-50% + ${shiftY}px))`;

      angleRef.current += ROTATION_SPEED;

      updateBall(ball1, angleRef.current, tiltX, radiusScale, 1, LIGHT1);
      updateBall(ball2, angleRef.current, -tiltX, radiusScale, -1, LIGHT2);

      ball1.renderer.render(ball1.scene, ball1.camera);
      ball2.renderer.render(ball2.scene, ball2.camera);

      if (!prefersReducedMotion) {
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    if (prefersReducedMotion) {
      updateBall(ball1, 0, 0, 1, 1, LIGHT1);
      updateBall(ball2, 0, 0, 1, -1, LIGHT2);
      ball1.renderer.render(ball1.scene, ball1.camera);
      ball2.renderer.render(ball2.scene, ball2.camera);
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeDebounce);
      ball1.renderer.dispose();
      ball2.renderer.dispose();
      canvas1.remove();
      canvas2.remove();
    };
  }, []);

  return (
    <>
      {/* Primary disco ball — right side */}
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '50%',
          right: '-15%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.14,
          willChange: 'transform',
          overflow: 'visible',
        }}
      />
      {/* Mirrored disco ball — left side */}
      <div
        ref={container2Ref}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '-15%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.14,
          willChange: 'transform',
          overflow: 'visible',
        }}
      />
    </>
  );
}
