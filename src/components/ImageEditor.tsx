import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import { Sparkle, Camera, ArrowCounterClockwise, ArrowsClockwise, Info, X } from '@phosphor-icons/react';
import { HeaderGenerator } from './HeaderGenerator';
import { LinkedInPreview } from './LinkedInPreview';
import { saveCanvasImages, saveCanvasAsSVG, isIOS } from '../lib/download';
import {
  drawCircularImage,
  applyIridescentEffect,
  drawFrame,
  maskToCircle,
  clampTransform,
  type PhotoTransform,
  type SparkleExclusion,
} from '../lib/canvas';

const CANVAS_SIZE = 600;
const MIN_SCALE = 1.0;  // never smaller than cover-fit — prevents empty edges
const MAX_SCALE = 5;
const STATIC_HUE = 45;  // fixed golden hue offset for the iridescent sheen

/**
 * Project face zones from NORMALISED image coords (0–1 of the photo's natural
 * dimensions) into the canvas's pixel coord system, accounting for the
 * cover-fit base scale + user pan/zoom. Used to keep sparkles off eyes/mouth.
 */
function buildSparkleExclusion(
  zones:     import('../lib/faceDetection').FaceZones | null,
  img:       HTMLImageElement | null,
  transform: PhotoTransform,
): SparkleExclusion[] | undefined {
  if (!zones || !img) return undefined;
  const size = CANVAS_SIZE;
  const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const finalScale = baseScale * transform.scale;
  const sw = img.naturalWidth  * finalScale;
  const sh = img.naturalHeight * finalScale;
  const sx = size / 2 - sw / 2 + transform.x;
  const sy = size / 2 - sh / 2 + transform.y;
  const project = (n: { x: number; y: number; w: number; h: number }) => ({
    x: sx + n.x * sw,
    y: sy + n.y * sh,
    w: n.w * sw,
    h: n.h * sh,
  });
  return [project(zones.leftEye), project(zones.rightEye), project(zones.mouth)];
}

export function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const photoImgRef = useRef<HTMLImageElement | null>(null);
  // Normalised (0–1) face zones detected in the uploaded photo — stored in
  // IMAGE-space so they stay correct regardless of the current pan/zoom.
  const faceZonesRef = useRef<import('../lib/faceDetection').FaceZones | null>(null);
  // Face centroid (normalised 0–1 photo coords) — passed down so the banner
  // generator can anchor the kaleidoscope centre on the user's face.
  const [faceCenter, setFaceCenter] = useState<{ x: number; y: number } | null>(null);

  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  // Seed for randomizing LinkedIn preview placeholder text — changes on each drop
  const [previewSeed, setPreviewSeed] = useState(0);
  const [intensity, setIntensity] = useState(0.5);
  const intensityRef = useRef(0.5);
  // Visual slider value — tracks drag position without triggering header
  // re-render on every tick. Committed to `intensity` on pointer-up.
  const [sliderValue, setSliderValue] = useState(50);
  // Info modal toggle
  const [infoOpen, setInfoOpen] = useState(false);
  // Spin animation for the randomize button
  const [spinning, setSpinning] = useState(false);
  // Glow pulse on the profile circle after any action completes
  const [glowPulse, setGlowPulse] = useState(false);
  const triggerGlowPulse = useCallback(() => {
    setGlowPulse(true);
    window.setTimeout(() => setGlowPulse(false), 600);
  }, []);
  const [dragging, setDragging] = useState(false);     // upload-zone drag state
  const [dragOver, setDragOver] = useState(false);     // canvas drag-over state
  const [hoveringDrop, setHoveringDrop] = useState(false); // upload-zone hover state
  // Ref for the canvas wrapper — useGesture attaches listeners to this node
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bannerRegenerateRef = useRef<(() => void) | null>(null);
  const [onIOS, setOnIOS] = useState(false);
  useEffect(() => { setOnIOS(isIOS()); }, []);

  // Portal target at the very top of the page (<div id="banner-slot"> in
  // index.astro). We mount the banner there so it renders above the hero,
  // while all the state (photoSrc, faceCenter, options) still lives here.
  const [bannerPortalTarget, setBannerPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setBannerPortalTarget(document.getElementById('banner-slot'));
  }, []);

  // Three-stage reveal: (1) dropzone → (2) pulsating glow while computing →
  // (3) synchronised fade-in of profile + banner. `has-photo` class drives
  // CSS transitions (hero collapse, banner slot grow).
  const [profileReady, setProfileReady] = useState(false);
  const [bannerReady, setBannerReady] = useState(false);
  const [pulseMinDone, setPulseMinDone] = useState(false);
  const pulseTimerRef = useRef<number>(0);
  useEffect(() => {
    // New photo → reset all three gates.
    setProfileReady(false);
    setBannerReady(false);
    setPulseMinDone(false);
    window.clearTimeout(pulseTimerRef.current);
    if (!photoSrc) return;
    // Pulse must run for at least one full breathing cycle (1.6 s) so the
    // animation feels intentional, even when face detection is instant.
    const PULSE_MIN_MS = 1600;
    pulseTimerRef.current = window.setTimeout(() => setPulseMinDone(true), PULSE_MIN_MS);
    return () => window.clearTimeout(pulseTimerRef.current);
  }, [photoSrc]);
  // Derived: everything is ready for the synchronised reveal.
  const revealReady = !!(photoSrc && profileReady && bannerReady && pulseMinDone);
  // `has-photo` drives hero collapse + banner slot. Only add it once the
  // reveal is ready so both profile + banner appear at the exact same moment.
  useEffect(() => {
    const root = document.documentElement;
    if (revealReady) root.classList.add('has-photo');
    else root.classList.remove('has-photo');
    return () => root.classList.remove('has-photo');
  }, [revealReady]);

  // File-upload error feedback
  const MAX_FILE_MB = 25;
  const [fileError, setFileError] = useState<string | null>(null);

  // Long-press-to-save overlay: after each render settles, we capture the
  // canvas as a blob URL and show it as an <img>. iOS users can then
  // long-press → "Save to Photos". During active interaction the <img> is
  // hidden so the live canvas stays responsive.
  const [idleImgUrl, setIdleImgUrl] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const idleTimerRef = useRef<number>(0);

  const refreshIdleImage = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (!blob) return;
        setIdleImgUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      }, 'image/png');
    }, 260);
  }, []);

  // Immediate (non-debounced) snapshot — called on drag/pinch end so the
  // idle <img> overlay is already showing the CURRENT position the moment
  // we fade it back in. Without this the viewer sees the pre-drag snapshot
  // for ~260 ms after release ("jump back" illusion).
  const commitIdleImage = useCallback(() => {
    if (typeof window === 'undefined') { setIsInteracting(false); return; }
    window.clearTimeout(idleTimerRef.current);
    const canvas = canvasRef.current;
    if (!canvas) { setIsInteracting(false); return; }
    canvas.toBlob((blob) => {
      if (blob) {
        setIdleImgUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      }
      setIsInteracting(false);
    }, 'image/png');
  }, []);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (idleImgUrl) URL.revokeObjectURL(idleImgUrl);
      window.clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const transformRef = useRef<PhotoTransform>({ x: 0, y: 0, scale: 1 });

  // ── Frame style ─────────────────────────────────────────────────────────
  // Three colour variants of the same Shining frame. Each picks a hue shift
  // (rotates the gold palette) + a CSS `filter` applied when drawing the
  // frame PNG, so the metallic ring matches the iridescent shine.
  type FrameStyle = 'gold' | 'rose' | 'silver';
  const FRAME_STYLES: Record<FrameStyle, {
    label: string;
    swatch: string;
    filter: string;
    hueShift: number;
    satScale: number;
  }> = {
    gold:   { label: 'Gold',   swatch: 'linear-gradient(135deg,#daa520,#ffd700)', filter: 'none',                                       hueShift:   0, satScale: 1   },
    rose:   { label: 'Rose',   swatch: 'linear-gradient(135deg,#c2735a,#ffb7a3)', filter: 'hue-rotate(-25deg) saturate(0.95)',          hueShift: -25, satScale: 0.95 },
    silver: { label: 'Silver', swatch: 'linear-gradient(135deg,#9ea0a6,#e9ecf1)', filter: 'saturate(0.18) brightness(1.1)',             hueShift:   0, satScale: 0.18 },
  };
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('gold');
  const frameStyleRef = useRef<FrameStyle>('gold');
  useEffect(() => { frameStyleRef.current = frameStyle; }, [frameStyle]);

  // ── Toast ───────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  // ── Banner-sync ─────────────────────────────────────────────────────────
  // After the user finishes panning/zooming the profile photo, mirror the
  // same sample point and zoom into the kaleidoscope banner so the two
  // visuals stay in lock-step. Debounced — we don't regenerate the banner
  // mid-drag, only when the user pauses.
  interface BannerSampling { offsetX: number; offsetY: number; scale: number; }
  const [bannerSampling, setBannerSampling] = useState<BannerSampling | null>(null);
  const bannerSettleTimerRef = useRef<number | null>(null);

  const computeBannerSampling = useCallback((): BannerSampling | null => {
    const photo = photoImgRef.current;
    if (!photo || !photo.naturalWidth || !photo.naturalHeight) return null;
    const t = transformRef.current;
    const baseScale = Math.max(CANVAS_SIZE / photo.naturalWidth, CANVAS_SIZE / photo.naturalHeight);
    const displayedW = photo.naturalWidth  * baseScale * t.scale;
    const displayedH = photo.naturalHeight * baseScale * t.scale;
    const c = (n: number) => Math.max(0.05, Math.min(0.95, n));
    return {
      offsetX: c(0.5 - t.x / displayedW),
      offsetY: c(0.5 - t.y / displayedH),
      scale:   t.scale,
    };
  }, []);

  const settleBannerSampling = useCallback(() => {
    if (bannerSettleTimerRef.current !== null) {
      clearTimeout(bannerSettleTimerRef.current);
    }
    bannerSettleTimerRef.current = window.setTimeout(() => {
      bannerSettleTimerRef.current = null;
      const s = computeBannerSampling();
      if (s) setBannerSampling(s);
    }, 250);
  }, [computeBannerSampling]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const photo = photoImgRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawCircularImage(ctx, photo, CANVAS_SIZE, CANVAS_SIZE, transformRef.current);

    // Translate normalised face zones → current canvas-space pixel rects,
    // so the sparkle layer can avoid covering eyes and mouth.
    const exclusion = buildSparkleExclusion(
      faceZonesRef.current,
      photo,
      transformRef.current,
    );

    const fs = FRAME_STYLES[frameStyleRef.current];
    applyIridescentEffect(
      ctx, CANVAS_SIZE, CANVAS_SIZE,
      intensityRef.current, STATIC_HUE,
      exclusion,
      { hue: fs.hueShift, sat: fs.satScale },
    );
    if (frameImgRef.current) {
      drawFrame(ctx, frameImgRef.current, CANVAS_SIZE, CANVAS_SIZE, fs.filter);
    }
    maskToCircle(ctx, CANVAS_SIZE, CANVAS_SIZE);

    // Debounced: sync idle <img> with the current canvas state
    refreshIdleImage();
  }, [refreshIdleImage]);

  // ── Instant edit sync ───────────────────────────────────────────────────
  // When a visual edit occurs AFTER the initial reveal (frame style change,
  // intensity change, randomize), BOTH profile and banner must update at the
  // exact same moment — no fade, no delay. The profile canvas renders
  // synchronously but the idle <img> overlay hides it. The banner blob is
  // async. We hold the old overlay visible until the banner signals ready,
  // then swap both at once.
  const editPendingRef = useRef(false);

  // Start an edit: render the new profile frame on the canvas (hidden under
  // the overlay). The banner regeneration is triggered by its own useEffect
  // or an explicit call. When banner fires onReady, both reveal instantly.
  const startEditTransition = useCallback(() => {
    if (!revealReady) return;
    editPendingRef.current = true;
    render();
  }, [revealReady, render]);

  // Called by banner's onReady — if an edit is pending, immediately commit
  // the new profile overlay so both surfaces update in the same frame.
  const handleBannerReady = useCallback(() => {
    setBannerReady(true);
    if (editPendingRef.current) {
      editPendingRef.current = false;
      // Hide stale overlay → live canvas visible, then snap a fresh overlay
      setIsInteracting(true);
      requestAnimationFrame(() => commitIdleImage());
    }
  }, [commitIdleImage]);

  // Ref callback so we can run DPR setup + an initial render the moment the
  // <canvas> mounts. Needed because AnimatePresence mode="wait" delays the
  // canvas's mount until the dropzone has finished exiting — by then the
  // photo-load useEffect has already called render() against a null canvas.
  const canvasRefCallback = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (!el) return;
    // Only set the canvas's internal pixel buffer — NOT its CSS size. React's
    // inline style ({ width: 'min(75vw, 380px)' }) already handles display size,
    // and overriding it here made the canvas render at 600 px while the idle
    // <img> overlay stayed at 400 px, causing a duplicate offset image.
    const dpr = window.devicePixelRatio || 1;
    if (el.width !== CANVAS_SIZE * dpr) {
      el.width  = CANVAS_SIZE * dpr;
      el.height = CANVAS_SIZE * dpr;
      const ctx = el.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    }
    // Re-render if the photo already loaded while canvas was unmounted
    if (photoImgRef.current) render();
  }, [render]);

  // Keyboard shortcuts (active only while a photo is loaded):
  //   R or 0   reset the crop
  //   + / =    zoom in     (Shift = bigger step)
  //   - / _    zoom out
  //   ←↑→↓     pan         (Shift = bigger step)
  // Skipped when the user is typing in an input or contentEditable,
  // so the shine slider's native arrow-key value-change still works.
  useEffect(() => {
    if (!photoSrc) return;
    const ZOOM_STEP = 1.15;
    const PAN_STEP  = 24;
    const PAN_STEP_BIG = 80;

    const isFormField = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (isFormField(e.target)) return;
      const t = transformRef.current;
      let next: PhotoTransform | null = null;

      switch (e.key) {
        case 'r':
        case 'R':
        case '0':
          next = { x: 0, y: 0, scale: 1 };
          break;
        case '+':
        case '=':
          next = { ...t, scale: Math.min(MAX_SCALE, t.scale * (e.shiftKey ? ZOOM_STEP * ZOOM_STEP : ZOOM_STEP)) };
          break;
        case '-':
        case '_':
          next = { ...t, scale: Math.max(MIN_SCALE, t.scale / (e.shiftKey ? ZOOM_STEP * ZOOM_STEP : ZOOM_STEP)) };
          break;
        case 'ArrowLeft':
          next = { ...t, x: t.x + (e.shiftKey ? PAN_STEP_BIG : PAN_STEP) };
          break;
        case 'ArrowRight':
          next = { ...t, x: t.x - (e.shiftKey ? PAN_STEP_BIG : PAN_STEP) };
          break;
        case 'ArrowUp':
          next = { ...t, y: t.y + (e.shiftKey ? PAN_STEP_BIG : PAN_STEP) };
          break;
        case 'ArrowDown':
          next = { ...t, y: t.y - (e.shiftKey ? PAN_STEP_BIG : PAN_STEP) };
          break;
        default:
          return;
      }

      if (!next) return;
      e.preventDefault();
      transformRef.current = clamp(next);
      render();
      // Reset shortcuts also clear banner sampling so the kaleidoscope
      // returns to its face-anchored default. Pan/zoom keys defer to
      // the existing debounced settle so the banner refreshes once
      // the user pauses keypresses.
      if (e.key === 'r' || e.key === 'R' || e.key === '0') {
        setBannerSampling({ offsetX: 0.5, offsetY: 0.5, scale: 1 });
      } else {
        settleBannerSampling();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoSrc, render, settleBannerSampling]);

  // Load photo once on upload; reset transform. Downscale huge photos to a
  // max 2400 px longest side so we don't waste memory on 48-megapixel phone
  // shots — the output canvas is only 600 × 600 anyway.
  useEffect(() => {
    if (!photoSrc) {
      photoImgRef.current = null;
      faceZonesRef.current = null;
      setFaceCenter(null);
      setBannerSampling(null);
      setIdleImgUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      return;
    }
    transformRef.current = { x: 0, y: 0, scale: 1 };
    faceZonesRef.current = null;   // new photo — discard old landmarks
    setFaceCenter(null);
    setBannerSampling(null);
    const MAX_SIDE = 2400;

    // Helper: once the final image is ready, run face detection FIRST,
    // apply auto-framing, and only THEN show the image. This avoids the
    // visible jump that occurred when the image rendered at default
    // position and then snapped into the face-framed crop.
    const prepareAndShow = async (finalImg: HTMLImageElement) => {
      photoImgRef.current = finalImg;
      try {
        const { detectFaceZones } = await import('../lib/faceDetection');
        const zones = await detectFaceZones(finalImg);
        if (zones && photoImgRef.current === finalImg) {
          faceZonesRef.current = zones;
          const centre = (k: 'leftEye' | 'rightEye' | 'mouth', axis: 'x' | 'y') =>
            axis === 'x'
              ? zones[k].x + zones[k].w / 2
              : zones[k].y + zones[k].h / 2;
          const fcx =
            (centre('leftEye', 'x') + centre('rightEye', 'x') + centre('mouth', 'x')) / 3;
          const fcy =
            (centre('leftEye', 'y') + centre('rightEye', 'y') + centre('mouth', 'y')) / 3;
          setFaceCenter({ x: fcx, y: fcy });

          // Auto-frame only if user hasn't manually adjusted
          const t0 = transformRef.current;
          const userTouched = !(t0.x === 0 && t0.y === 0 && t0.scale === 1);
          if (!userTouched && finalImg.naturalWidth && finalImg.naturalHeight) {
            const eyeTop = Math.min(zones.leftEye.y, zones.rightEye.y);
            const mouthBottom = zones.mouth.y + zones.mouth.h;
            const eyesToMouth = mouthBottom - eyeTop;
            if (eyesToMouth > 0) {
              const TARGET_FACE_FRAC = 0.62;
              const faceHeightNorm = eyesToMouth * 2.0;
              const baseScale = Math.max(
                CANVAS_SIZE / finalImg.naturalWidth,
                CANVAS_SIZE / finalImg.naturalHeight,
              );
              const faceHeightAt1 = faceHeightNorm * finalImg.naturalHeight * baseScale;
              let targetScale = (TARGET_FACE_FRAC * CANVAS_SIZE) / faceHeightAt1;
              targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE * 0.8, targetScale));
              const finalScale = baseScale * targetScale;
              const sw = finalImg.naturalWidth  * finalScale;
              const sh = finalImg.naturalHeight * finalScale;
              const tx = sw * (0.5 - fcx);
              const ty = sh * (0.5 - fcy);
              transformRef.current = clamp({ x: tx, y: ty, scale: targetScale });
            }
          }
        }
      } catch { /* detection failed — render at default position */ }
      render();
      // Profile canvas is now fully rendered with correct positioning —
      // signal that it's ready to fade in.
      setProfileReady(true);
    };

    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest > MAX_SIDE) {
        const scale = MAX_SIDE / longest;
        const tmp = document.createElement('canvas');
        tmp.width  = Math.round(img.naturalWidth  * scale);
        tmp.height = Math.round(img.naturalHeight * scale);
        const tctx = tmp.getContext('2d');
        if (tctx) {
          tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
          const small = new Image();
          small.onload = () => prepareAndShow(small);
          small.src = tmp.toDataURL('image/jpeg', 0.92);
          return;
        }
      }
      prepareAndShow(img);
    };
    img.onerror = () => setFileError('That image could not be decoded. Try another.');
    img.src = photoSrc;
  }, [photoSrc, render]);

  // Pre-load the Shining SVG frame
  useEffect(() => {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/shining-frame.png`;
    img.onload = () => { frameImgRef.current = img; render(); };
  }, [render]);

  // Re-render when intensity slider changes — uses crossfade so profile
  // and banner update at the same time with matching fade transitions.
  useEffect(() => { startEditTransition(); }, [intensity, startEditTransition]);

  // Re-render when frame style changes
  useEffect(() => { startEditTransition(); }, [frameStyle, startEditTransition]);

  // Clamp helper — reads current photo natural dimensions
  const clamp = (t: PhotoTransform) => {
    const img = photoImgRef.current;
    if (!img) return t;
    return clampTransform(t, img.naturalWidth, img.naturalHeight, CANVAS_SIZE);
  };

  // Convert display-space delta → canvas-space delta
  const toCanvasDelta = (dx: number, dy: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { dx, dy };
    return { dx: (dx * CANVAS_SIZE) / rect.width, dy: (dy * CANVAS_SIZE) / rect.height };
  };

  // --- Double-tap / double-click: toggle zoom between 1× and DOUBLE_ZOOM×,
  //     anchored at the tap point so the image zooms into where the user
  //     tapped. Same helper used by both desktop and mobile via useGesture. ---
  const DOUBLE_ZOOM = 2.5;
  const handleDoubleZoom = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((clientX - rect.left) * CANVAS_SIZE) / rect.width;
    const cy = ((clientY - rect.top)  * CANVAS_SIZE) / rect.height;

    const t = transformRef.current;
    const targetScale = t.scale > 1.5 ? 1 : DOUBLE_ZOOM;

    if (targetScale === 1) {
      transformRef.current = { x: 0, y: 0, scale: 1 };
    } else {
      // Keep the tapped canvas point fixed while scaling up
      const a = cx - CANVAS_SIZE / 2;
      const b = cy - CANVAS_SIZE / 2;
      const ratio = targetScale / t.scale;
      transformRef.current = clamp({
        x: a * (1 - ratio) + t.x * ratio,
        y: b * (1 - ratio) + t.y * ratio,
        scale: targetScale,
      });
    }
    render();
    settleBannerSampling();
  }, [render, settleBannerSampling]);

  // ─────────────────────────────────────────────────────────────────────────
  //  All gesture plumbing is delegated to @use-gesture/react.
  //  One hook, bound to the wrapper div, handles:
  //    • Mouse drag (onDrag, pointer type = mouse)
  //    • One-finger touch drag (onDrag, pointer type = touch)
  //    • Two-finger touch pinch zoom (onPinch)
  //    • Trackpad pinch zoom via ctrl+wheel (onPinch — routed automatically)
  //    • Trackpad two-finger swipe / mouse wheel scroll (onWheel — only fires
  //      when not pinching, so it's safe to treat as pan)
  //    • Double-click + double-tap (onDoubleClick — unified)
  //  Gesture starts/ends drive `isInteracting`, which fades the idle <img>.
  // ─────────────────────────────────────────────────────────────────────────
  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching, cancel }) => {
        if (!photoSrc) return;
        if (pinching) {
          cancel();
          return;
        }
        const { dx: cdx, dy: cdy } = toCanvasDelta(dx, dy);
        transformRef.current = clamp({
          ...transformRef.current,
          x: transformRef.current.x + cdx,
          y: transformRef.current.y + cdy,
        });
        render();
        settleBannerSampling();
      },
      onDragStart: () => { if (photoSrc) setIsInteracting(true); },
      onDragEnd:   () => { commitIdleImage(); settleBannerSampling(); },

      onPinch: ({ origin: [ox, oy], offset: [nextScale], first, memo }) => {
        if (!photoSrc) return memo;
        const canvas = canvasRef.current;
        if (!canvas) return memo;

        // Capture the pinch's anchor point (in canvas space) + starting
        // transform on the first event — scale from there.
        if (first) {
          const rect = canvas.getBoundingClientRect();
          const cx = ((ox - rect.left) * CANVAS_SIZE) / rect.width;
          const cy = ((oy - rect.top)  * CANVAS_SIZE) / rect.height;
          memo = { cx, cy, start: { ...transformRef.current } };
        }

        const start = memo.start as PhotoTransform;
        const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
        const ratio = clampedScale / start.scale;
        const a = memo.cx - CANVAS_SIZE / 2;
        const b = memo.cy - CANVAS_SIZE / 2;
        transformRef.current = clamp({
          x: a * (1 - ratio) + start.x * ratio,
          y: b * (1 - ratio) + start.y * ratio,
          scale: clampedScale,
        });
        render();
        settleBannerSampling();
        return memo;
      },
      onPinchStart: () => { if (photoSrc) setIsInteracting(true); },
      onPinchEnd:   () => { commitIdleImage(); settleBannerSampling(); },

      onWheel: ({ event, delta: [dx, dy], pinching }) => {
        if (!photoSrc || pinching) return;
        // Page scroll is already suppressed by `eventOptions.passive: false`
        // plus touch-action: none. No need to preventDefault here.
        const { dx: cdx, dy: cdy } = toCanvasDelta(-dx, -dy);
        transformRef.current = clamp({
          ...transformRef.current,
          x: transformRef.current.x + cdx,
          y: transformRef.current.y + cdy,
        });
        render();
        settleBannerSampling();
      },
    },
    {
      target: wrapperRef,
      eventOptions: { passive: false },
      drag: {
        filterTaps: true,             // suppress drag on short taps (lets double-tap fire)
        pointer: { touch: true },     // prefer Pointer Events where available
        from: () => [0, 0],           // deltas are per-event, so start at 0
      },
      pinch: {
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        rubberband: true,
        from: () => [transformRef.current.scale, 0],
      },
      wheel: { preventDefault: true },
    },
  );

  // Native dblclick on the canvas/img → double-zoom via our helper.
  // useGesture's onDrag with filterTaps suppresses synthetic onClick from
  // drag-ended-at-rest, so we catch double-clicks at the DOM level.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onDbl = (e: MouseEvent) => {
      if (!photoSrc) return;
      handleDoubleZoom(e.clientX, e.clientY);
    };
    el.addEventListener('dblclick', onDbl);
    return () => el.removeEventListener('dblclick', onDbl);
  }, [photoSrc, handleDoubleZoom]);

  // --- File handling ---
  const handleFile = (file: File) => {
    setFileError(null);
    if (!file.type.startsWith('image/')) {
      setFileError('Please choose an image file (JPG, PNG, HEIC, or WebP).');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`That photo is over ${MAX_FILE_MB} MB — try a smaller version.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFileError('Could not read that file. Try another.');
    reader.onload = (e) => {
      const result = e.target?.result as string | undefined;
      if (!result) {
        setFileError('Could not read that file. Try another.');
        return;
      }
      setPhotoSrc(result);
      setPreviewSeed(Date.now());
    };
    reader.readAsDataURL(file);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Banner canvas reference, kept up to date by HeaderGenerator's onCanvasReady.
  const bannerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Renderer that can produce a fresh banner canvas with/without text on demand.
  const bannerRendererRef = useRef<((withText: boolean) => Promise<HTMLCanvasElement | null>) | null>(null);
  // Banner blob URL — exposed by HeaderGenerator so the LinkedIn preview
  // can display the banner without re-rendering.
  const [bannerImgUrl, setBannerImgUrl] = useState<string | null>(null);
  // Banner with "#Shining" text — used in the LinkedIn preview.
  const [bannerTextImgUrl, setBannerTextImgUrl] = useState<string | null>(null);
  const bannerTextUrlRef = useRef<string | null>(null);

  // Generate a banner-with-text blob URL whenever the plain banner updates
  useEffect(() => {
    if (!bannerImgUrl || !bannerRendererRef.current) return;
    let cancelled = false;
    (async () => {
      const canvas = await bannerRendererRef.current!(true);
      if (!canvas || cancelled) return;
      canvas.toBlob((blob) => {
        if (!blob || cancelled) return;
        if (bannerTextUrlRef.current) URL.revokeObjectURL(bannerTextUrlRef.current);
        const url = URL.createObjectURL(blob);
        bannerTextUrlRef.current = url;
        setBannerTextImgUrl(url);
      }, 'image/png');
    })();
    return () => { cancelled = true; };
  }, [bannerImgUrl]);

  const downloadToastLabel = onIOS ? 'Saved' : 'Downloaded';

  const handleDownloadAll = async () => {
    const items: { canvas: HTMLCanvasElement; filename: string }[] = [];
    // 1. Profile picture
    if (canvasRef.current) {
      items.push({ canvas: canvasRef.current, filename: 'shining-profile.png' });
    }
    // 2. Banner without text
    if (bannerRendererRef.current) {
      const plain = await bannerRendererRef.current(false);
      if (plain) items.push({ canvas: plain, filename: 'shining-banner.png' });
    } else if (bannerCanvasRef.current) {
      items.push({ canvas: bannerCanvasRef.current, filename: 'shining-banner.png' });
    }
    // 3. Banner with text
    if (bannerRendererRef.current) {
      const withText = await bannerRendererRef.current(true);
      if (withText) items.push({ canvas: withText, filename: 'shining-banner-with-text.png' });
    }
    if (items.length) {
      await saveCanvasImages(items);
      showToast(downloadToastLabel);
    }
  };

  const handleDownloadSVG = () => {
    if (canvasRef.current) {
      saveCanvasAsSVG(canvasRef.current, 'shining-profile.svg');
      showToast(downloadToastLabel);
    }
  };

  // Whether the user has moved/zoomed away from the default crop. Drives
  // visibility of the "Reset crop" link.
  const isDefaultCrop = (() => {
    const t = transformRef.current;
    return t.x === 0 && t.y === 0 && t.scale === 1;
  })();

  const handleResetCrop = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    render();
    setBannerSampling({ offsetX: 0.5, offsetY: 0.5, scale: 1 });
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto px-4">

      {/* Fixed-size slot — dropzone → pulsating glow → canvas reveal */}
      <div style={{ width: 'min(75vw, 380px)', height: 'min(75vw, 380px)', position: 'relative', flexShrink: 0 }}>
      <AnimatePresence mode="wait" initial={false}>
        {!photoSrc ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="glow-ring-wrapper"
            style={{ position: 'absolute', inset: 0 }}
          >
            <div className="glow-ring-blur" />
            <div className="glow-ring" />
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload profile photo — click or drag and drop"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 2,
                border: `2px dashed ${dragging ? 'var(--color-gold-light)' : hoveringDrop ? 'rgba(218,165,32,0.7)' : 'rgba(184,134,11,0.35)'}`,
                background: dragging
                  ? 'rgba(218,165,32,0.10)'
                  : hoveringDrop
                  ? 'rgba(218,165,32,0.06)'
                  : 'var(--color-bg)',
                cursor: 'pointer',
                transform: hoveringDrop && !dragging ? 'scale(1.03)' : 'scale(1)',
                transition: 'border-color 0.25s, background 0.25s, transform 0.3s cubic-bezier(0.22,1,0.36,1)',
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
              onMouseEnter={() => setHoveringDrop(true)}
              onMouseLeave={() => setHoveringDrop(false)}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {/* Text overlay */}
              <div
                className="flex flex-col items-center gap-2 text-center"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  pointerEvents: 'none',
                }}
              >
                <Sparkle size={32} weight="fill" color="var(--color-gold)" style={{ marginBottom: '0.25rem' }} />
                <p style={{
                  color: 'var(--color-text)',
                  fontFamily: 'DM Serif Display, serif',
                  fontSize: '1.25rem',
                  margin: 0,
                }}>
                  Drop your photo here
                </p>
                <p style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.875rem',
                  margin: 0,
                }}>
                  or click to browse
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Processing / editor container — stays mounted for the whole
             photo lifecycle. Internally cross-fades between the pulsating
             glow placeholder and the live canvas. */
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* ── Layer 1: Pulsating glow placeholder ──────────────────────
                Visible while face detection + banner render are in flight.
                Fades out when revealReady, giving way to the canvas below. */}
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: revealReady ? 0 : 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: revealReady ? 0 : 10,
                pointerEvents: 'none',
              }}
            >
              <div
                className="profile-glow-breathe"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid rgba(218,165,32,0.35)',
                  background: 'radial-gradient(circle at 50% 45%, rgba(218,165,32,0.08) 0%, rgba(184,134,11,0.03) 50%, transparent 70%)',
                }}
              />
            </motion.div>

            {/* ── Layer 2: Live canvas (+ gesture target) ─────────────────
                Always mounted so face detection + render can draw to it
                while the glow pulses. Fades in when revealReady. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: revealReady ? 1 : 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <div
                ref={wrapperRef}
                className="profile-canvas-wrapper"
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  zIndex: 5,
                  touchAction: 'none',
                  userSelect: 'none',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
              >
                <canvas
                  ref={canvasRefCallback}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  aria-label="Profile photo preview with Shining frame"
                  style={{
                    borderRadius: '50%',
                    width: '100%',
                    height: '100%',
                    cursor: dragOver ? 'copy' : isInteracting ? 'grabbing' : 'grab',
                    boxShadow: dragOver
                      ? '0 0 60px hsla(40, 90%, 65%, 0.7), 0 0 120px hsla(40, 80%, 50%, 0.4)'
                      : glowPulse
                      ? '0 0 80px hsla(40, 95%, 60%, 0.6), 0 0 140px hsla(40, 85%, 50%, 0.35), 0 0 200px hsla(40, 80%, 45%, 0.15)'
                      : '0 0 60px hsla(40, 90%, 55%, 0.35), 0 0 120px hsla(40, 80%, 40%, 0.2)',
                    touchAction: 'none',
                    transition: 'box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                    display: 'block',
                  }}
                />
                {/* Idle snapshot <img> overlay — enables iOS long-press → Save to Photos.
                    Hidden while the user pans/pinches so the live canvas stays responsive. */}
                {idleImgUrl && (
                  <img
                    src={idleImgUrl}
                    alt="Your Shining profile — long-press on mobile to save"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      pointerEvents: isInteracting ? 'none' : 'auto',
                      opacity: isInteracting ? 0 : 1,
                      transition: 'opacity 0.12s',
                      WebkitTouchCallout: 'default',
                      userSelect: 'none',
                      cursor: 'grab',
                      touchAction: 'none',
                    }}
                  />
                )}

                {/* Drop overlay */}
                {dragOver && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: 'rgba(218,165,32,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <span style={{
                      color: 'var(--color-gold-light)',
                      fontFamily: 'DM Serif Display, serif',
                      fontSize: '1rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}>
                      Drop to replace
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>{/* end fixed-size slot */}

      {/* File input — always rendered, hidden */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {/* Error message */}
      {fileError && (
        <p role="alert" style={{ color: '#ff6b6b', fontSize: '0.875rem', textAlign: 'center', maxWidth: '320px' }}>
          {fileError}
        </p>
      )}

      {/* Hint + controls — appear below the fixed circle */}
      <AnimatePresence>
        {revealReady && (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-5 w-full"
          >
            <div
              style={{
                padding: '0.5rem 0',
                width: '100%',
              }}
              className="flex flex-col gap-4"
            >
              {/* ── Floating glass toolbar ─────────────────────────────────── */}
              <div
                style={{
                  background: 'rgba(26,15,2,0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(218,165,32,0.25)',
                  borderRadius: '1.25rem',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,215,0,0.08)',
                }}
              >
                {/* Info button */}
                <button
                  type="button"
                  className="shining-btn"
                  aria-label="Controls help"
                  onClick={() => setInfoOpen(v => !v)}
                  style={{
                    display: 'flex',
                    flexShrink: 0,
                    color: infoOpen ? 'var(--color-gold-light)' : 'var(--color-text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'color 0.15s',
                  }}
                >
                  <Info size={18} weight="bold" />
                </button>

                {/* Intensity slider */}
                <input
                  id="intensity-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={sliderValue}
                  onChange={(e) => {
                    // Move the slider thumb visually but defer ALL canvas
                    // re-renders (profile sparkles + header) to pointer-up /
                    // touch-end so the glitter doesn't shift mid-drag.
                    setSliderValue(Number(e.target.value));
                  }}
                  onPointerUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value) / 100;
                    intensityRef.current = v;
                    setIntensity(v);
                    triggerGlowPulse();
                  }}
                  onTouchEnd={(e) => {
                    const v = Number((e.target as HTMLInputElement).value) / 100;
                    intensityRef.current = v;
                    setIntensity(v);
                    triggerGlowPulse();
                  }}
                  className="shine-slider"
                  aria-label="Shine intensity"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={sliderValue}
                  style={{
                    accentColor: 'var(--color-gold)',
                    width: '100%',
                    flex: 1,
                    touchAction: 'pan-y',
                  }}
                />

                {/* Divider */}
                <div aria-hidden style={{
                  width: '1px',
                  height: '1.75rem',
                  background: 'rgba(218,165,32,0.2)',
                  flexShrink: 0,
                }} />

                {/* Frame style dots */}
                <div role="radiogroup" aria-label="Frame style" style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {(Object.keys(FRAME_STYLES) as FrameStyle[]).map((key) => {
                    const s = FRAME_STYLES[key];
                    const active = key === frameStyle;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="shining-btn"
                        role="radio"
                        aria-checked={active}
                        aria-label={s.label}
                        onClick={() => { setFrameStyle(key); triggerGlowPulse(); }}
                        style={{
                          width: '1.75rem',
                          height: '1.75rem',
                          borderRadius: '50%',
                          background: s.swatch,
                          border: active ? '2px solid var(--color-gold-light)' : '2px solid transparent',
                          boxShadow: active ? '0 0 10px rgba(255,215,0,0.4)' : 'none',
                          opacity: active ? 1 : 0.55,
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'opacity 0.15s, box-shadow 0.15s, border-color 0.15s',
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Divider — frame dots | kaleidoscope */}
                <div aria-hidden style={{
                  width: '1px',
                  height: '1.75rem',
                  background: 'rgba(218,165,32,0.2)',
                  flexShrink: 0,
                }} />

                {/* Kaleidoscope pattern randomize */}
                <button
                  type="button"
                  className="shining-btn"
                  aria-label="Randomize kaleidoscope pattern"
                  title="Randomize pattern"
                  onClick={() => {
                    if (bannerRegenerateRef.current) bannerRegenerateRef.current();
                    triggerGlowPulse();
                  }}
                  style={{
                    width: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '1.5px solid rgba(218,165,32,0.4)',
                    color: 'var(--color-gold-light)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 14 14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="m 4.94,12.71 c -0.04,-0.06 -1.32,-2.18 -1.48,-2.46 -0.06,-0.1 -0.11,-0.19 -0.11,-0.2 0,-0.01 0.05,-0.02 0.1,-0.01 0.06,0.01 0.42,0.04 0.8,0.07 0.49,0.04 0.72,0.07 0.75,0.09 0.03,0.02 0.29,0.23 0.57,0.46 0.29,0.24 0.69,0.57 0.89,0.73 l 0.37,0.3 -0.21,0.13 c -0.66,0.39 -1.61,0.93 -1.63,0.93 -0.01,0 -0.04,-0.02 -0.05,-0.05 z m 2.87,-1.02 c 0,-0.01 0.21,-0.31 0.46,-0.68 l 0.46,-0.66 1.11,-0.42 c 0.61,-0.23 1.12,-0.42 1.14,-0.42 0.02,0 0.03,0.26 0.02,1.06 l -0.01,1.06 -0.5,0.02 c -0.95,0.03 -2.69,0.05 -2.69,0.04 z m -1.71,-0.98 c -0.28,-0.23 -0.66,-0.54 -0.85,-0.7 -0.19,-0.15 -0.34,-0.29 -0.33,-0.3 0.01,-0.01 0.26,-0.08 0.55,-0.15 l 0.53,-0.14 0.74,0.27 c 0.88,0.32 0.82,0.3 0.82,0.32 0,0.02 -0.92,1.1 -0.94,1.11 -0.01,0 -0.25,-0.18 -0.53,-0.41 z m 2.2,-0.53 c 0,-0.01 0.04,-0.15 0.08,-0.31 0.05,-0.16 0.11,-0.4 0.15,-0.54 l 0.07,-0.25 0.63,-0.53 c 0.35,-0.29 0.64,-0.53 0.65,-0.53 0.02,0 0.08,0.17 0.34,0.91 0.09,0.26 0.17,0.48 0.16,0.49 0,0 -0.17,0.07 -0.37,0.14 -0.48,0.18 -1.5,0.57 -1.62,0.61 -0.05,0.02 -0.09,0.03 -0.09,0.02 z M 2.65,9.1 c -0.1,-0.06 -0.51,-0.29 -0.91,-0.52 -0.4,-0.23 -0.73,-0.42 -0.74,-0.43 -0.01,0 0.11,-0.22 0.26,-0.49 1.02,-1.85 1.28,-2.31 1.29,-2.31 0.01,0 0.17,0.34 0.36,0.75 l 0.34,0.74 -0.09,0.57 c -0.05,0.31 -0.12,0.69 -0.14,0.84 -0.03,0.15 -0.07,0.42 -0.1,0.61 -0.03,0.19 -0.06,0.35 -0.07,0.35 -0.01,0 -0.09,-0.05 -0.19,-0.1 z m 1.96,-0.11 c -0.05,-0.01 -0.37,-0.07 -0.72,-0.13 -0.54,-0.1 -0.64,-0.12 -0.64,-0.16 0,-0.02 0.05,-0.33 0.11,-0.69 0.06,-0.36 0.14,-0.83 0.17,-1.06 0.04,-0.22 0.07,-0.41 0.08,-0.41 0.01,0 0.19,0.18 0.39,0.39 0.21,0.22 0.39,0.4 0.39,0.41 0.02,0.02 0.31,1.62 0.3,1.65 0,0.01 -0.04,0.01 -0.09,0 z m 6.75,-0.54 c -0.06,-0.12 -0.21,-0.45 -0.35,-0.74 l -0.24,-0.52 0.19,-1.17 c 0.11,-0.65 0.19,-1.18 0.19,-1.19 0,-0.01 0.01,-0.01 0.02,-0.01 0.02,0 1.55,0.88 1.82,1.04 0.02,0.01 -0.06,0.18 -0.34,0.69 -0.2,0.37 -0.54,0.98 -0.76,1.37 -0.21,0.39 -0.4,0.72 -0.41,0.73 -0.02,0.02 -0.05,-0.03 -0.13,-0.19 z m -1.07,-1.08 c -0.06,-0.06 -0.24,-0.25 -0.4,-0.42 -0.27,-0.28 -0.3,-0.31 -0.31,-0.41 -0.01,-0.06 -0.07,-0.42 -0.14,-0.81 -0.07,-0.38 -0.12,-0.7 -0.11,-0.71 0.01,-0.01 1.43,0.25 1.45,0.26 0.01,0.01 -0.07,0.48 -0.16,1.06 -0.09,0.58 -0.17,1.07 -0.17,1.09 0,0.07 -0.03,0.06 -0.14,-0.07 z m -6.17,-1.39 c -0.01,-0.02 -0.09,-0.25 -0.18,-0.52 -0.26,-0.71 -0.3,-0.84 -0.28,-0.85 0.02,-0.02 2.06,-0.79 2.07,-0.78 0,0 -0.03,0.12 -0.06,0.26 -0.04,0.14 -0.11,0.38 -0.15,0.54 -0.06,0.24 -0.09,0.3 -0.15,0.35 -0.04,0.04 -0.12,0.1 -0.17,0.15 -0.23,0.2 -1.03,0.87 -1.04,0.87 -0.01,0 -0.02,-0.01 -0.02,-0.03 z m 3.14,-1.65 c -0.41,-0.15 -0.76,-0.28 -0.78,-0.29 -0.04,-0.01 -0.02,-0.04 0.12,-0.21 0.09,-0.1 0.3,-0.35 0.48,-0.56 0.17,-0.2 0.32,-0.37 0.34,-0.37 0.01,0 0.12,0.08 0.25,0.18 0.12,0.1 0.5,0.41 0.85,0.7 0.34,0.28 0.62,0.52 0.62,0.52 -0.01,0.01 -0.13,0.04 -0.27,0.08 -0.14,0.04 -0.39,0.1 -0.55,0.14 -0.16,0.04 -0.29,0.07 -0.29,0.07 0,0 -0.34,-0.12 -0.75,-0.27 z m -4.24,-0.89 0,-1.06 0.36,-0.02 c 0.2,-0.01 0.83,-0.02 1.41,-0.03 0.58,-0.01 1.14,-0.02 1.25,-0.03 0.22,-0.01 0.22,-0.03 0.04,0.24 -0.7,1.01 -0.78,1.11 -0.89,1.16 -0.19,0.08 -2.12,0.8 -2.14,0.8 -0.01,0 -0.02,-0.48 -0.02,-1.06 z m 6.79,0.47 c -0.33,-0.03 -0.63,-0.06 -0.67,-0.06 -0.06,0 -0.14,-0.06 -0.39,-0.26 -0.17,-0.14 -0.59,-0.49 -0.94,-0.77 -0.34,-0.28 -0.62,-0.52 -0.61,-0.53 0.03,-0.03 1.83,-1.07 1.84,-1.06 0.02,0.02 1.63,2.71 1.63,2.72 0,0.02 -0.29,0 -0.87,-0.05 z" />
                  </svg>
                </button>

                {/* Divider */}
                <div aria-hidden style={{
                  width: '1px',
                  height: '1.75rem',
                  background: 'rgba(218,165,32,0.2)',
                  flexShrink: 0,
                }} />

                {/* Randomize everything — header, glow, frame colour */}
                <button
                  type="button"
                  className="shining-btn"
                  aria-label="Randomize style"
                  title="Randomize"
                  onClick={() => {
                    // Spin the icon
                    setSpinning(true);
                    window.setTimeout(() => setSpinning(false), 500);
                    // Pick a random frame style
                    const keys = Object.keys(FRAME_STYLES) as FrameStyle[];
                    const randomFrame = keys[Math.floor(Math.random() * keys.length)];
                    setFrameStyle(randomFrame);
                    // Pick a random intensity (30–100%)
                    const randomIntensity = 0.3 + Math.random() * 0.7;
                    setSliderValue(Math.round(randomIntensity * 100));
                    setIntensity(randomIntensity);
                    intensityRef.current = randomIntensity;

                    // Randomize crop position — jitter around the face if
                    // detected, otherwise random offset. Always ensures
                    // eyes+mouth stay inside the visible circle.
                    const img = photoImgRef.current;
                    const zones = faceZonesRef.current;
                    if (img) {
                      const r = (min: number, max: number) => min + Math.random() * (max - min);
                      const baseScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
                      if (zones) {
                        // Compute face bounding box in normalised coords
                        const eyeTop = Math.min(zones.leftEye.y, zones.rightEye.y);
                        const mouthBottom = zones.mouth.y + zones.mouth.h;
                        const eyeLeft = Math.min(zones.leftEye.x, zones.rightEye.x);
                        const eyeRight = Math.max(zones.leftEye.x + zones.leftEye.w, zones.rightEye.x + zones.rightEye.w);
                        const faceCx = (eyeLeft + eyeRight) / 2;
                        const faceCy = (eyeTop + mouthBottom) / 2;
                        const faceH = (mouthBottom - eyeTop) * 2.0;
                        // Random scale that keeps the face between 45–75% of canvas
                        const targetFrac = r(0.45, 0.75);
                        const faceHPx = faceH * img.naturalHeight * baseScale;
                        let newScale = (targetFrac * CANVAS_SIZE) / faceHPx;
                        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE * 0.8, newScale));
                        const fs = baseScale * newScale;
                        const sw = img.naturalWidth * fs;
                        const sh = img.naturalHeight * fs;
                        // Jitter the face position within a safe margin
                        const jitterX = r(-0.08, 0.08);
                        const jitterY = r(-0.06, 0.06);
                        const tx = sw * (0.5 - faceCx + jitterX);
                        const ty = sh * (0.5 - faceCy + jitterY);
                        transformRef.current = clamp({ x: tx, y: ty, scale: newScale });
                      } else {
                        // No face — random pan within safe bounds
                        const newScale = r(MIN_SCALE, 2.0);
                        const tx = r(-60, 60);
                        const ty = r(-60, 60);
                        transformRef.current = clamp({ x: tx, y: ty, scale: newScale });
                      }
                    }

                    // Regenerate the header kaleidoscope
                    if (bannerRegenerateRef.current) bannerRegenerateRef.current();
                    startEditTransition();
                    triggerGlowPulse();
                  }}
                  style={{
                    width: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '1.5px solid rgba(218,165,32,0.4)',
                    color: 'var(--color-gold-light)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <ArrowsClockwise
                    size={14}
                    weight="bold"
                    style={{
                      transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                      transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>

                {/* Divider — randomize | download */}
                <div aria-hidden style={{
                  width: '1px',
                  height: '1.75rem',
                  background: 'rgba(218,165,32,0.2)',
                  flexShrink: 0,
                }} />

                {/* Download — toolbar button */}
                <button
                  type="button"
                  className="shining-btn"
                  onClick={handleDownloadAll}
                  style={{
                    background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light))',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#000',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  Download
                </button>
              </div>

              {/* ── Info modal ─────────────────────────────────────────────── */}
              <AnimatePresence initial={false}>
                {infoOpen && (
                  <motion.div
                    key="info-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                  <div
                    style={{
                      background: 'rgba(26,15,2,0.92)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(218,165,32,0.2)',
                      borderRadius: '1rem',
                      padding: '1.25rem 1.25rem 1rem',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      position: 'relative',
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Close info"
                      onClick={() => setInfoOpen(false)}
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                      }}
                    >
                      <X size={14} weight="bold" />
                    </button>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div><strong style={{ color: 'var(--color-text)' }}>Photo</strong> — Drag or scroll to pan. Pinch or ⌘/Ctrl + scroll to zoom. Drop a new photo to replace.</div>
                      <div><strong style={{ color: 'var(--color-text)' }}>Shine</strong> — Slide to adjust glow intensity on both your profile picture and header banner.</div>
                      <div><strong style={{ color: 'var(--color-text)' }}>Frame</strong> — Tap a colour dot to switch between Gold, Rose, and Silver frame styles.</div>
                      <div><strong style={{ color: 'var(--color-text)' }}>Kaleidoscope</strong> — Re-rolls just the header banner pattern without changing anything else.</div>
                      <div><strong style={{ color: 'var(--color-text)' }}>Randomize</strong> — Shuffles everything: kaleidoscope pattern, intensity, frame colour, and crop position.</div>
                      <div style={{ color: 'rgba(184,134,11,0.6)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Keyboard: R = reset crop · +/- = zoom · Arrow keys = pan</div>
                    </div>
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Utility links ──────────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', margin: '0.15rem 0 0' }}>
                <button
                  onClick={() => setPhotoSrc(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: '0.25rem 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Camera size={15} weight="bold" />
                  Change photo
                </button>
                {!isDefaultCrop && (
                  <button
                    onClick={handleResetCrop}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: '0.25rem 0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <ArrowCounterClockwise size={15} weight="bold" />
                    Reset
                  </button>
                )}
              </div>

              {onIOS && (
                <p style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.72rem',
                  margin: '-0.25rem 0 0',
                  textAlign: 'center',
                  lineHeight: 1.55,
                }}>
                  On iPhone you can also <strong style={{ color: 'var(--color-gold)' }}>long-press the image</strong> and tap <strong style={{ color: 'var(--color-gold)' }}>Save to Photos</strong>.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LinkedIn preview — shows how the profile + banner look in context */}
      {revealReady && idleImgUrl && (bannerTextImgUrl || bannerImgUrl) && (
        <LinkedInPreview
          profileImgUrl={idleImgUrl}
          bannerImgUrl={bannerTextImgUrl || bannerImgUrl}
          frameStyle={frameStyle}
          seed={previewSeed}
        />
      )}

      {/* Banner at the very top of the page, via portal — only when a photo
          is loaded. Lives in <div id="banner-slot"> (index.astro). The
          onReady callback flips bannerReady true when the first blob URL
          arrives, so the profile picture reveal syncs with the banner. */}
      {bannerPortalTarget && photoSrc && createPortal(
        <HeaderGenerator
          photoSrc={photoSrc}
          faceCenter={faceCenter}
          sampling={bannerSampling}
          tintFilter={FRAME_STYLES[frameStyle].filter}
          intensity={intensity}
          visible={revealReady}
          onReady={handleBannerReady}
          onCanvasReady={(c) => { bannerCanvasRef.current = c; }}
          onRendererReady={(fn) => { bannerRendererRef.current = fn; }}
          onRegenerateReady={(fn) => { bannerRegenerateRef.current = fn; }}
          onImgUrl={setBannerImgUrl}
        />,
        bannerPortalTarget,
      )}

      {/* Toast — confirmation after a download */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: '50%',
              bottom: '1.5rem',
              transform: 'translateX(-50%)',
              background: 'rgba(20, 12, 2, 0.92)',
              border: '1px solid rgba(184, 134, 11, 0.5)',
              color: 'var(--color-gold-light)',
              padding: '0.7rem 1.2rem',
              borderRadius: '999px',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
