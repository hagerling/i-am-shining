import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  drawCircularImage,
  applyIridescentEffect,
  drawFrame,
  clampTransform,
  type PhotoTransform,
} from '../lib/canvas';

const CANVAS_SIZE = 600;
const MIN_SCALE = 1.0;  // never smaller than cover-fit — prevents empty edges
const MAX_SCALE = 5;
const STATIC_HUE = 45;  // fixed golden hue offset for the iridescent sheen

export function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const photoImgRef = useRef<HTMLImageElement | null>(null);

  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(0.5);
  const intensityRef = useRef(0.5);
  const [dragging, setDragging] = useState(false);   // dropzone drag state
  const [isPanning, setIsPanning] = useState(false); // canvas pan state

  const transformRef = useRef<PhotoTransform>({ x: 0, y: 0, scale: 1 });
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastPinchDistRef = useRef<number | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const photo = photoImgRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawCircularImage(ctx, photo, CANVAS_SIZE, CANVAS_SIZE, transformRef.current);
    applyIridescentEffect(ctx, CANVAS_SIZE, CANVAS_SIZE, intensityRef.current, STATIC_HUE);
    if (frameImgRef.current) {
      drawFrame(ctx, frameImgRef.current, CANVAS_SIZE, CANVAS_SIZE);
    }
  }, []);

  // Load photo once on upload; reset transform
  useEffect(() => {
    if (!photoSrc) { photoImgRef.current = null; return; }
    transformRef.current = { x: 0, y: 0, scale: 1 };
    const img = new Image();
    img.onload = () => { photoImgRef.current = img; render(); };
    img.src = photoSrc;
  }, [photoSrc, render]);

  // Pre-load the Shining SVG frame
  useEffect(() => {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}shining-frame.svg`;
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

  // --- Mouse drag ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!photoSrc) return;
    setIsPanning(true);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const { dx, dy } = toCanvasDelta(
      e.clientX - lastPointerRef.current.x,
      e.clientY - lastPointerRef.current.y,
    );
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    transformRef.current = clamp({ ...transformRef.current, x: transformRef.current.x + dx, y: transformRef.current.y + dy });
    render();
  };
  const handleMouseUp = () => setIsPanning(false);

  // --- Scroll zoom ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!photoSrc) return;
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    const next = clamp({ ...transformRef.current, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, transformRef.current.scale * factor)) });
    transformRef.current = next;
    render();
  };

  // --- Touch drag + pinch zoom ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!photoSrc) return;
    if (e.touches.length === 1) {
      lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPinchDistRef.current = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastPinchDistRef.current = Math.hypot(dx, dy);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!photoSrc) return;
    if (e.touches.length === 1 && lastPinchDistRef.current === null) {
      const { dx, dy } = toCanvasDelta(
        e.touches[0].clientX - lastPointerRef.current.x,
        e.touches[0].clientY - lastPointerRef.current.y,
      );
      lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      transformRef.current = clamp({ ...transformRef.current, x: transformRef.current.x + dx, y: transformRef.current.y + dy });
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastPinchDistRef.current !== null) {
        const factor = dist / lastPinchDistRef.current;
        transformRef.current = clamp({ ...transformRef.current, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, transformRef.current.scale * factor)) });
      }
      lastPinchDistRef.current = dist;
    }
    render();
  };
  const handleTouchEnd = () => { lastPinchDistRef.current = null; };

  // --- File handling ---
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
      setTimeout(() => URL.revokeObjectURL(url), 0);
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
              role="button"
              tabIndex={0}
              aria-label="Upload profile photo — click or drag and drop"
              style={{
                border: `2px dashed ${dragging ? 'var(--color-gold-light)' : 'var(--color-gold-dim)'}`,
                borderRadius: 'var(--radius-card)',
                background: dragging ? 'rgba(218,165,32,0.08)' : 'var(--color-surface)',
                padding: '3rem 2rem',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
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

      {/* Canvas + controls */}
      <AnimatePresence>
        {photoSrc && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center gap-6 w-full"
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              aria-label="Profile photo preview with Shining frame"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                borderRadius: '50%',
                width: 'min(90vw, 400px)',
                height: 'min(90vw, 400px)',
                cursor: isPanning ? 'grabbing' : 'grab',
                boxShadow: '0 0 60px hsla(40, 90%, 55%, 0.35), 0 0 120px hsla(40, 80%, 40%, 0.2)',
                touchAction: 'none',
              }}
            />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '-0.5rem' }}>
              Drag to reposition · Scroll or pinch to zoom
            </p>

            {/* Controls card */}
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
                  value={Math.round(intensity * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setIntensity(v);
                    intensityRef.current = v;
                  }}
                  style={{ accentColor: 'var(--color-gold)', width: '100%' }}
                />
              </div>

              {/* Action buttons */}
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
