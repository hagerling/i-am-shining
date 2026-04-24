import { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowsClockwise, DownloadSimple } from '@phosphor-icons/react';
import { renderLinkedInHeader, makeRandomHeaderOptions } from '../lib/headerCanvas';
import type { HeaderOptions } from '../lib/headerCanvas';
import { saveCanvasImage, isIOS } from '../lib/download';

// Display coords (the reference size everything in the renderer is written
// against — LinkedIn's recommended banner size).
const LI_W = 1584;
const LI_H = 396;
// Render-resolution multiplier. The canvas is actually 2× these dimensions
// (3168 × 792) and the context is scaled by this factor before the renderer
// runs, so every stroke and font gets high-DPI crispness, and the downloaded
// PNG is retina-sharp.
const SCALE = 2;

interface Props {
  photoSrc: string | null;
  /** Optional face centroid (normalised 0–1 photo coords) — when supplied
   *  the kaleidoscope anchors on the face so eyes/nose/mouth appear in every facet. */
  faceCenter?: { x: number; y: number } | null;
  /** Fired whenever a freshly rendered banner blob URL is ready. The parent
   *  uses this to gate the moment it reveals the profile picture, so the
   *  banner and profile picture fade in synchronously. */
  onReady?: () => void;
  /** Hands the parent a reference to the offscreen canvas, so a single
   *  "Download" action in the controls can save both the banner and the
   *  profile picture in one go. */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  /** Hands the parent a function it can call to render a fresh banner
   *  canvas with or without text. Used by the controls dropdown. */
  onRendererReady?: (
    renderBanner: (withText: boolean) => Promise<HTMLCanvasElement | null>,
  ) => void;
}

export function HeaderGenerator({ photoSrc, faceCenter, onReady, onCanvasReady, onRendererReady }: Props) {
  // Canvas lives offscreen — we display the rendered result as an <img>
  // (via a blob URL) so iOS users can long-press → "Save to Photos".
  const canvasRef    = useRef<HTMLCanvasElement>(
    typeof document !== 'undefined' ? document.createElement('canvas') : null as unknown as HTMLCanvasElement,
  );
  const photoRef     = useRef<HTMLImageElement | null>(null);
  const frameRef     = useRef<HTMLImageElement | null>(null);
  const optionsRef   = useRef<HeaderOptions>(makeRandomHeaderOptions());
  const [imgUrl,     setImgUrl]     = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Fire onReady once imgUrl is populated for the current generation
  useEffect(() => {
    if (imgUrl && onReady) onReady();
    if (imgUrl && onCanvasReady && canvasRef.current) onCanvasReady(canvasRef.current);
  }, [imgUrl, onReady, onCanvasReady]);

  // Hand the parent a renderer it can call to produce a banner canvas
  // (with or without text) on demand.
  useEffect(() => {
    if (!onRendererReady) return;
    onRendererReady(async (withText: boolean) => {
      if (!photoRef.current) return null;
      if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
          await document.fonts.load('italic 98px "DM Serif Display"');
          await document.fonts.load('500 16px "DM Sans"');
        } catch { /* fall back */ }
      }
      const tmp = document.createElement('canvas');
      tmp.width = LI_W * SCALE;
      tmp.height = LI_H * SCALE;
      const tmpCtx = tmp.getContext('2d');
      if (!tmpCtx) return null;
      tmpCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      renderLinkedInHeader(tmpCtx, LI_W, LI_H, photoRef.current, frameRef.current, optionsRef.current, withText);
      return tmp;
    });
  }, [onRendererReady, imgUrl]);
  const [rendered,   setRendered]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [onIOS, setOnIOS] = useState(false);
  useEffect(() => { setOnIOS(isIOS()); }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [dropdownOpen]);

  // Keep canvas sized at SCALE × the LinkedIn reference size for retina crispness
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = LI_W * SCALE;
    canvas.height = LI_H * SCALE;
  }, []);


  const generate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setGenerating(true);

    // Wait until the custom serif font is loaded before drawing —
    // otherwise canvas falls back to a generic serif and the text looks wrong.
    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        await document.fonts.load('italic 110px "DM Serif Display"');
        await document.fonts.load('italic 60px "DM Serif Display"');
        await document.fonts.load('600 15px "DM Sans"');
      } catch { /* fall back silently */ }
    }

    requestAnimationFrame(() => {
      // Scale the context once so all renderer math stays in LinkedIn's
      // 1584 × 396 coord system; the physical canvas is 2× larger (3168 × 792).
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      renderLinkedInHeader(ctx, LI_W, LI_H, photoRef.current, frameRef.current, optionsRef.current, false);
      // Convert canvas to a blob URL so long-press → Save to Photos works
      canvas.toBlob((blob) => {
        if (!blob) {
          setRendered(true);
          setGenerating(false);
          return;
        }
        setImgUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setRendered(true);
        setGenerating(false);
      }, 'image/png');
    });
  }, []);

  // Pre-load the golden #SHINING crescent frame
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      frameRef.current = img;
      // Re-render if the photo was already ready before the frame finished
      if (photoRef.current) generate();
    };
    img.src = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/shining-frame.png`;
  }, [generate]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = () => {
    optionsRef.current = makeRandomHeaderOptions(faceCenter ?? undefined);
    generate();
  };

  // When face detection results arrive (or change), re-run one generation
  // anchored on the face so the very first banner the user sees features
  // their eyes/nose/mouth prominently.
  useEffect(() => {
    if (!faceCenter || !photoRef.current) return;
    optionsRef.current = makeRandomHeaderOptions(faceCenter);
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceCenter]);

  // Load photo and auto-generate
  useEffect(() => {
    if (!photoSrc) {
      photoRef.current = null;
      setRendered(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      photoRef.current = img;
      generate();
    };
    img.src = photoSrc;
  }, [photoSrc, generate]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    saveCanvasImage(canvas, 'shining-linkedin-header.png');
  };

  const handleDownloadWithText = useCallback(async () => {
    if (!photoRef.current) return;
    setGenerating(true);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        await document.fonts.load('italic 98px "DM Serif Display"');
        await document.fonts.load('500 16px "DM Sans"');
      } catch { /* fall back */ }
    }
    const tmp = document.createElement('canvas');
    tmp.width  = LI_W * SCALE;
    tmp.height = LI_H * SCALE;
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) { setGenerating(false); return; }
    requestAnimationFrame(() => {
      tmpCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      renderLinkedInHeader(tmpCtx, LI_W, LI_H, photoRef.current, frameRef.current, optionsRef.current, true);
      saveCanvasImage(tmp, 'shining-linkedin-header-with-text.png');
      setGenerating(false);
    });
  }, []);

  if (!photoSrc) return null;

  const downloadLabel = onIOS ? 'Save to Photos' : 'Download banner';

  return (
    <div style={{ width: '100%' }}>

      {/* Full-bleed banner — breaks out of any max-width parent so it spans
          the viewport at the very top of the page. */}
      <div
        className="banner-preview"
        style={{
          position: 'relative',
          width: '100vw',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '100vw',
          // Height is taller than the banner's native 4:1 to make room for the
          // profile picture overlap. The img uses object-fit: cover so the
          // kaleidoscope fills the slot without distortion — excess width crops.
          height: 'calc(8rem + min(45vw, 200px))',
          overflow: 'hidden',
          boxShadow: '0 4px 32px rgba(0,0,0,0.45)',
          background: '#0e0902',
          zIndex: 1,
        }}
      >
        {/* <img> rather than <canvas> so iOS users can long-press → Save to Photos */}
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Your Shining LinkedIn header — long-press on mobile to save"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              WebkitTouchCallout: 'default',
              userSelect: 'none',
            }}
            draggable={false}
          />
        ) : null}

        {/* Icon-only action buttons, top-right corner of the banner. */}
        <div style={{
          position: 'absolute',
          top: 'clamp(0.6rem, 1.4vw, 1.25rem)',
          right: 'clamp(0.6rem, 1.4vw, 1.25rem)',
          display: 'flex',
          gap: '0.6rem',
          zIndex: 3,
        }}>
          <button
            type="button"
            onClick={regenerate}
            disabled={generating}
            className="banner-icon-btn"
            aria-label="Regenerate banner"
            data-tooltip="Regenerate"
            title="Regenerate banner"
          >
            <ArrowsClockwise size={18} weight="bold" />
          </button>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setDropdownOpen(o => !o)}
              disabled={!rendered || generating}
              className="banner-icon-btn banner-icon-btn--primary"
              aria-label={downloadLabel}
              aria-expanded={dropdownOpen}
              data-tooltip={dropdownOpen ? undefined : downloadLabel}
              title={downloadLabel}
            >
              <DownloadSimple size={18} weight="bold" />
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: 'rgba(14, 8, 0, 0.94)',
                border: '1px solid rgba(184, 134, 11, 0.5)',
                borderRadius: '10px',
                padding: '0.35rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
                minWidth: '172px',
                zIndex: 10,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
              }}>
                <button
                  type="button"
                  className="banner-dd-item"
                  onClick={() => { handleDownload(); setDropdownOpen(false); }}
                >
                  Without text
                </button>
                <button
                  type="button"
                  className="banner-dd-item"
                  onClick={() => { handleDownloadWithText(); setDropdownOpen(false); }}
                >
                  With text
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Banner-specific component styles (tooltip + icon buttons). Scoped by
          class name so they don't bleed into the rest of the page. */}
      <style>{`
        .banner-icon-btn {
          position: relative;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 240, 200, 0.35);
          background: rgba(20, 12, 2, 0.55);
          color: #fef8ed;
          cursor: pointer;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
        }
        .banner-icon-btn:hover:not(:disabled),
        .banner-icon-btn:focus-visible:not(:disabled) {
          background: rgba(30, 18, 2, 0.80);
          border-color: rgba(255, 230, 140, 0.75);
          transform: scale(1.05);
        }
        .banner-icon-btn:active:not(:disabled) { transform: scale(0.95); }
        .banner-icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .banner-icon-btn--primary {
          background: linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light));
          color: #000;
          border-color: rgba(255, 230, 140, 0.8);
        }
        .banner-icon-btn--primary:hover:not(:disabled),
        .banner-icon-btn--primary:focus-visible:not(:disabled) {
          background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
          border-color: #fff1b8;
        }
        /* Tooltip via data-tooltip — appears below the button on hover/focus */
        .banner-icon-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          padding: 0.4rem 0.65rem;
          background: rgba(14, 8, 0, 0.92);
          color: #fef8ed;
          border: 1px solid rgba(184, 134, 11, 0.5);
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-3px);
          transition: opacity 0.18s, transform 0.18s;
          z-index: 4;
        }
        .banner-icon-btn:hover:not(:disabled)::after,
        .banner-icon-btn:focus-visible:not(:disabled)::after {
          opacity: 1;
          transform: translateY(0);
        }
        /* Hide tooltips on touch devices — the native long-press title is enough */
        @media (hover: none) {
          .banner-icon-btn::after { display: none; }
        }
        .banner-dd-item {
          display: block;
          width: 100%;
          padding: 0.55rem 0.85rem;
          background: transparent;
          border: none;
          border-radius: 7px;
          color: #fef8ed;
          font-size: 0.82rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, color 0.15s;
        }
        .banner-dd-item:hover,
        .banner-dd-item:focus-visible {
          background: rgba(184, 134, 11, 0.22);
          color: var(--color-gold-light);
          outline: none;
        }
      `}</style>
    </div>
  );
}
