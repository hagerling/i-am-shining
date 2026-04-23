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
      if (t - last > 30) {
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

  // Static re-render when not animating
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
                  boxShadow: '0 0 60px hsla(40, 90%, 55%, 0.35), 0 0 120px hsla(40, 80%, 40%, 0.2)',
                }}
              />
            </div>

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
