import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import { Sparkle, DownloadSimple } from '@phosphor-icons/react';
import { HeaderGenerator } from './HeaderGenerator';
import { saveCanvasImages, isIOS } from '../lib/download';
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
  const [intensity, setIntensity] = useState(0.5);
  const intensityRef = useRef(0.5);
  const [dragging, setDragging] = useState(false);     // upload-zone drag state
  const [dragOver, setDragOver] = useState(false);     // canvas drag-over state
  const [hoveringDrop, setHoveringDrop] = useState(false); // upload-zone hover state
  // Ref for the canvas wrapper — useGesture attaches listeners to this node
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [onIOS, setOnIOS] = useState(false);
  useEffect(() => { setOnIOS(isIOS()); }, []);

  // Portal target at the very top of the page (<div id="banner-slot"> in
  // index.astro). We mount the banner there so it renders above the hero,
  // while all the state (photoSrc, faceCenter, options) still lives here.
  const [bannerPortalTarget, setBannerPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setBannerPortalTarget(document.getElementById('banner-slot'));
  }, []);

  // Gate visual transition on BOTH having a photo AND the banner being
  // rendered — so the banner and profile picture fade in together, no
  // staggering. The `has-photo` class drives every CSS transition (hero
  // collapse, banner slot grow, profile-pic pull-up) from this single flag.
  const [bannerReady, setBannerReady] = useState(false);
  useEffect(() => {
    // New photo → reset readiness; HeaderGenerator will set it back to true
    // when its blob URL is ready.
    setBannerReady(false);
  }, [photoSrc]);
  useEffect(() => {
    const root = document.documentElement;
    if (photoSrc && bannerReady) root.classList.add('has-photo');
    else root.classList.remove('has-photo');
    return () => root.classList.remove('has-photo');
  }, [photoSrc, bannerReady]);

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

    applyIridescentEffect(
      ctx, CANVAS_SIZE, CANVAS_SIZE,
      intensityRef.current, STATIC_HUE,
      exclusion,
    );
    if (frameImgRef.current) {
      drawFrame(ctx, frameImgRef.current, CANVAS_SIZE, CANVAS_SIZE);
    }
    maskToCircle(ctx, CANVAS_SIZE, CANVAS_SIZE);

    // Debounced: sync idle <img> with the current canvas state
    refreshIdleImage();
  }, [refreshIdleImage]);

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

  // Keyboard shortcut: "R" resets the photo pan/zoom when editing
  useEffect(() => {
    if (!photoSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        transformRef.current = { x: 0, y: 0, scale: 1 };
        render();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoSrc, render]);

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

    // Kick off face landmark detection in the background. The sparkle layer
    // will avoid eyes and mouth once detection completes. Graceful fallback
    // if MediaPipe fails to load / finds no face — we just render without
    // exclusion zones.
    const kickOffFaceDetection = (targetImg: HTMLImageElement) => {
      import('../lib/faceDetection')
        .then(({ detectFaceZones }) => detectFaceZones(targetImg))
        .then((zones) => {
          if (!zones) return;
          // Ignore stale results if the user has already swapped photos
          if (photoImgRef.current !== targetImg) return;
          faceZonesRef.current = zones;
          // Centroid of both eyes + mouth, in normalised photo coords.
          // Used by HeaderGenerator to anchor the kaleidoscope on the face.
          const centre = (k: 'leftEye' | 'rightEye' | 'mouth', axis: 'x' | 'y') =>
            axis === 'x'
              ? zones[k].x + zones[k].w / 2
              : zones[k].y + zones[k].h / 2;
          setFaceCenter({
            x: (centre('leftEye', 'x') + centre('rightEye', 'x') + centre('mouth', 'x')) / 3,
            y: (centre('leftEye', 'y') + centre('rightEye', 'y') + centre('mouth', 'y')) / 3,
          });
          render();
        })
        .catch(() => { /* already logged inside faceDetection */ });
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
          small.onload = () => {
            photoImgRef.current = small;
            render();
            kickOffFaceDetection(small);
          };
          small.src = tmp.toDataURL('image/jpeg', 0.92);
          return;
        }
      }
      photoImgRef.current = img;
      render();
      kickOffFaceDetection(img);
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

  // Re-render when intensity slider changes
  useEffect(() => { render(); }, [intensity, render]);

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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Close the header menu on outside click
  useEffect(() => {
    if (!headerMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [headerMenuOpen]);

  const handleDownloadProfile = () => {
    if (canvasRef.current) {
      saveCanvasImages([{ canvas: canvasRef.current, filename: 'shining-profile.png' }]);
    }
  };

  const handleDownloadHeader = async (withText: boolean) => {
    setHeaderMenuOpen(false);
    if (bannerRendererRef.current) {
      const c = await bannerRendererRef.current(withText);
      if (c) {
        saveCanvasImages([
          { canvas: c, filename: withText ? 'shining-banner-with-text.png' : 'shining-banner.png' },
        ]);
        return;
      }
    }
    // Fallback: use the live preview canvas (no-text version)
    if (!withText && bannerCanvasRef.current) {
      saveCanvasImages([{ canvas: bannerCanvasRef.current, filename: 'shining-banner.png' }]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto px-4">

      {/* Fixed-size slot — dropzone and canvas always occupy this exact space */}
      <div style={{ width: 'min(75vw, 380px)', height: 'min(75vw, 380px)', position: 'relative', flexShrink: 0 }}>
      <AnimatePresence mode="wait" initial={false}>
        {!(photoSrc && bannerReady) && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0 }}
          >
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
                border: `2px dashed ${dragging ? 'var(--color-gold-light)' : hoveringDrop ? 'rgba(218,165,32,0.7)' : 'rgba(184,134,11,0.35)'}`,
                background: dragging
                  ? 'rgba(218,165,32,0.10)'
                  : hoveringDrop
                  ? 'rgba(218,165,32,0.06)'
                  : 'transparent',
                cursor: 'pointer',
                transform: hoveringDrop && !dragging ? 'scale(1.03)' : 'scale(1)',
                transition: 'border-color 0.25s, background 0.25s, box-shadow 0.25s, transform 0.3s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: dragging
                  ? '0 0 60px hsla(40,90%,55%,0.35), 0 0 120px hsla(40,80%,40%,0.18)'
                  : hoveringDrop
                  ? '0 0 60px hsla(40,90%,55%,0.22), 0 0 120px hsla(40,80%,40%,0.10)'
                  : '0 0 60px hsla(40,90%,55%,0.12), 0 0 120px hsla(40,80%,40%,0.06)',
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
        )}

        {/* Canvas — same fixed slot, position: absolute fills it exactly */}
        {photoSrc && bannerReady && (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
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
                    : '0 0 60px hsla(40, 90%, 55%, 0.35), 0 0 120px hsla(40, 80%, 40%, 0.2)',
                  touchAction: 'none',
                  transition: 'box-shadow 0.2s',
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
        {photoSrc && bannerReady && (
          <motion.div
            key="controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="flex flex-col items-center gap-5 w-full"
          >
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
              Drag or scroll to pan · Pinch or ⌘/Ctrl + scroll to zoom · Drop a new photo to replace
            </p>
            <div
              style={{
                background: 'transparent',
                padding: '0.5rem 0',
                width: '100%',
              }}
              className="flex flex-col gap-5"
            >
              {/* Intensity slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="intensity-slider" style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 500 }}>
                    Shine Intensity
                  </label>
                  <span style={{ color: 'var(--color-gold)', fontSize: '0.875rem' }}>
                    {Math.round(intensity * 100)}%
                  </span>
                </div>
                <input
                  id="intensity-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(intensity * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setIntensity(v);
                    intensityRef.current = v;
                  }}
                  className="shine-slider"
                  aria-label="Shine intensity"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(intensity * 100)}
                  style={{
                    accentColor: 'var(--color-gold)',
                    width: '100%',
                    touchAction: 'pan-y',
                  }}
                />
              </div>

              {/* Primary action — download the profile picture */}
              <button
                onClick={handleDownloadProfile}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light))',
                  border: 'none',
                  borderRadius: '0.85rem',
                  color: '#000',
                  padding: '1rem 1.1rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  boxShadow: '0 8px 28px hsla(45, 90%, 55%, 0.25)',
                }}
              >
                <DownloadSimple size={20} weight="bold" />
                <span>Download profile picture</span>
              </button>

              {/* Secondary action — header download with a dropdown for
                  "with text" / "without text". */}
              <div ref={headerMenuRef} style={{ position: 'relative', width: '100%' }}>
                <button
                  onClick={() => setHeaderMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={headerMenuOpen}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: '1px solid rgba(184,134,11,0.5)',
                    borderRadius: '0.85rem',
                    color: 'var(--color-gold-light)',
                    padding: '1rem 1.1rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}
                >
                  <DownloadSimple size={20} weight="bold" />
                  <span>Download header image</span>
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-block',
                      width: '0.45rem',
                      height: '0.45rem',
                      borderRight: '2px solid currentColor',
                      borderBottom: '2px solid currentColor',
                      transform: headerMenuOpen ? 'rotate(-135deg) translate(-2px, -2px)' : 'rotate(45deg)',
                      transition: 'transform 0.2s',
                      marginLeft: '0.25rem',
                    }}
                  />
                </button>
                {headerMenuOpen && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 0.4rem)',
                      left: 0,
                      right: 0,
                      background: 'var(--color-surface)',
                      border: '1px solid rgba(184,134,11,0.35)',
                      borderRadius: '0.75rem',
                      padding: '0.35rem',
                      zIndex: 20,
                      boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <button
                      role="menuitem"
                      onClick={() => handleDownloadHeader(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text)',
                        padding: '0.65rem 0.85rem',
                        fontSize: '0.85rem',
                        textAlign: 'left',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(218,165,32,0.12)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      Without text
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleDownloadHeader(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text)',
                        padding: '0.65rem 0.85rem',
                        fontSize: '0.85rem',
                        textAlign: 'left',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(218,165,32,0.12)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      With “I am #Shining” text
                    </button>
                  </div>
                )}
              </div>

              {/* Subtle text link to swap the photo */}
              <button
                onClick={() => setPhotoSrc(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                  margin: '0.25rem auto 0',
                  padding: '0.25rem 0.5rem',
                }}
              >
                Change photo
              </button>

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

      {/* Banner at the very top of the page, via portal — only when a photo
          is loaded. Lives in <div id="banner-slot"> (index.astro). The
          onReady callback flips bannerReady true when the first blob URL
          arrives, so the profile picture reveal syncs with the banner. */}
      {bannerPortalTarget && photoSrc && createPortal(
        <HeaderGenerator
          photoSrc={photoSrc}
          faceCenter={faceCenter}
          sampling={bannerSampling}
          onReady={() => setBannerReady(true)}
          onCanvasReady={(c) => { bannerCanvasRef.current = c; }}
          onRendererReady={(fn) => { bannerRendererRef.current = fn; }}
        />,
        bannerPortalTarget,
      )}
    </div>
  );
}
