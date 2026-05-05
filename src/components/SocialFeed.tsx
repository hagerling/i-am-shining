import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface Testimonial {
  name: string;
  title: string;
  quote: string;
  date: string;
  avatar?: string;
}

interface Props {
  testimonials: Testimonial[];
}

const AUTO_ADVANCE_MS = 8000;
const RESUME_AFTER_MS = 20000;

export function SocialFeed({ testimonials }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hovering, setHovering] = useState(false);
  const [recentlyTouched, setRecentlyTouched] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const total = testimonials.length;

  const goTo = useCallback(
    (next: number, dir: 1 | -1) => {
      setDirection(dir);
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  const next = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1, -1), [goTo, index]);

  const markTouched = useCallback(() => {
    setRecentlyTouched(true);
    window.setTimeout(() => setRecentlyTouched(false), RESUME_AFTER_MS);
  }, []);

  // Auto-advance — paused on hover/focus, and for RESUME_AFTER_MS after
  // any manual interaction. Respects prefers-reduced-motion.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || hovering || recentlyTouched) return;
    const id = window.setTimeout(() => goTo(index + 1, 1), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [index, hovering, recentlyTouched, goTo]);

  // Keyboard navigation — only when carousel section has focus or focus is
  // inside it. ←/→ cycle.
  useEffect(() => {
    const sec = sectionRef.current;
    if (!sec) return;
    const onKey = (e: KeyboardEvent) => {
      if (!sec.contains(document.activeElement)) return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); markTouched(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); markTouched(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, markTouched]);

  // Swipe — horizontal drag past 60px in either direction triggers nav.
  useGesture(
    {
      onDragEnd: ({ movement: [mx], cancel: _cancel }) => {
        if (Math.abs(mx) < 60) return;
        if (mx < 0) next(); else prev();
        markTouched();
      },
    },
    { target: wrapRef, drag: { axis: 'x', filterTaps: true, pointer: { touch: true } } },
  );

  const variants = {
    enter:  (dir: 1 | -1) => ({ opacity: 0, x: dir === 1 ? 24 : -24 }),
    center:                 ({ opacity: 1, x: 0 }),
    exit:   (dir: 1 | -1) => ({ opacity: 0, x: dir === 1 ? -24 : 24 }),
  };

  const t = testimonials[index];
  const frameSrc = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/shining-frame.png`;

  return (
    <section
      ref={sectionRef}
      className="community-section"
      style={{
        width: '100%',
        maxWidth: '1080px',
        margin: '0 auto',
        padding: '5rem 1.5rem 5rem',
        position: 'relative',
        overflow: 'visible',
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      aria-roledescription="carousel"
      aria-label="Community testimonials"
    >
      {/* Soft golden glow behind the carousel. */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: '-10% -10% 10% -10%',
        background:
          'radial-gradient(ellipse 70% 50% at 30% 30%, rgba(218,165,32,0.08) 0%, transparent 60%),' +
          'radial-gradient(ellipse 60% 50% at 80% 70%, rgba(255,95,141,0.05) 0%, transparent 60%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Heading + subhead */}
      <div style={{
        marginBottom: '3rem',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(90deg, var(--color-gold-dim), var(--color-gold-light))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontSize: '0.8rem',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: '0.85rem',
        }}>
          <span aria-hidden style={{ marginRight: '0.4em' }}>✦</span>
          Community
          <span aria-hidden style={{ marginLeft: '0.4em' }}>✦</span>
        </div>
        <h2 style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.05,
          letterSpacing: '-0.012em',
        }}>
          Who&apos;s{' '}
          <em className="glitter-text" style={{ fontStyle: 'italic' }}>#Shining</em>
        </h2>
        <p style={{
          margin: '1rem auto 0',
          maxWidth: '440px',
          color: 'var(--color-text-muted)',
          fontSize: '0.95rem',
          letterSpacing: '0.01em',
          lineHeight: 1.55,
        }}>
          A few golden voices from the movement. Real people. Real radiance. Real LinkedIn frames.
        </p>
      </div>

      {/* Carousel viewport */}
      <div
        ref={wrapRef}
        className="carousel-viewport"
        style={{
          position: 'relative',
          minHeight: '22rem',
          padding: '0 1rem',
          touchAction: 'pan-y',
          userSelect: 'none',
          zIndex: 1,
        }}
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.figure
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              opacity: { duration: 0.35, ease: 'easeOut' },
              x:       { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
            }}
            itemScope
            itemType="https://schema.org/Review"
            style={{
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '2rem',
              maxWidth: '880px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
            aria-label={`Testimonial ${index + 1} of ${total}`}
          >
            <meta itemProp="itemReviewed" content="I am Shining" />
            {t.date && <meta itemProp="datePublished" content={t.date} />}

            <blockquote
              itemProp="reviewBody"
              style={{
                margin: 0,
                fontFamily: '"Iowan Old Style", "Charter", "Source Serif Pro", Georgia, serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.4rem, 3.2vw, 2.4rem)',
                lineHeight: 1.45,
                color: 'var(--color-text)',
                position: 'relative',
                padding: '0 0.5rem',
              }}
            >
              <span aria-hidden style={{
                color: 'var(--color-gold)',
                fontFamily: 'inherit',
                fontSize: '1.15em',
                marginRight: '0.18em',
                verticalAlign: '-0.05em',
              }}>&ldquo;</span>
              {t.quote}
              <span aria-hidden style={{
                color: 'var(--color-gold)',
                fontFamily: 'inherit',
                fontSize: '1.15em',
                marginLeft: '0.05em',
                verticalAlign: '-0.05em',
              }}>&rdquo;</span>
            </blockquote>

            <figcaption
              itemProp="author"
              itemScope
              itemType="https://schema.org/Person"
              style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}
            >
              {t.avatar ? (
                <div style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0 }}>
                  <img
                    src={t.avatar}
                    alt={`Portrait of ${t.name}, ${t.title}`}
                    width={52}
                    height={52}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <img
                    src={frameSrc}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#000',
                }}>
                  {t.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                </div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div itemProp="name" style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                  {t.name}
                </div>
                <div itemProp="jobTitle" style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.7rem',
                  marginTop: '0.2rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}>
                  {t.title}
                </div>
              </div>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div
        role="group"
        aria-label="Testimonial navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          marginTop: '2.5rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <button
          type="button"
          aria-label="Previous testimonial"
          onClick={() => { prev(); markTouched(); }}
          className="carousel-arrow"
        >
          <CaretLeft size={18} weight="bold" />
        </button>

        <div role="tablist" aria-label="Choose testimonial" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {testimonials.map((_, i) => {
            const active = i === index;
            return (
              <button
                key={i}
                role="tab"
                type="button"
                aria-selected={active}
                aria-label={`Show testimonial ${i + 1} of ${total}`}
                onClick={() => { goTo(i, i > index ? 1 : -1); markTouched(); }}
                className={`carousel-dot${active ? ' carousel-dot--active' : ''}`}
              />
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Next testimonial"
          onClick={() => { next(); markTouched(); }}
          className="carousel-arrow"
        >
          <CaretRight size={18} weight="bold" />
        </button>
      </div>

      {/* Hidden full list — keeps the Review microdata for crawlers since
          only the active card is mounted at a time above. */}
      <div className="sr-only" aria-hidden="true">
        {testimonials.map((tm, i) => (
          <figure
            key={`seo-${i}`}
            itemScope
            itemType="https://schema.org/Review"
          >
            <meta itemProp="itemReviewed" content="I am Shining" />
            {tm.date && <meta itemProp="datePublished" content={tm.date} />}
            <blockquote itemProp="reviewBody">{tm.quote}</blockquote>
            <figcaption
              itemProp="author"
              itemScope
              itemType="https://schema.org/Person"
            >
              <span itemProp="name">{tm.name}</span>{' '}
              <span itemProp="jobTitle">{tm.title}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <style>{`
        .carousel-arrow {
          width: 3rem;
          height: 3rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: transparent;
          border: 1.5px solid rgba(218, 165, 32, 0.55);
          color: var(--color-gold-light);
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
        }
        .carousel-arrow:hover {
          background: rgba(218, 165, 32, 0.12);
          border-color: rgba(255, 215, 0, 0.85);
        }
        .carousel-arrow:active { transform: scale(0.94); }

        .carousel-dot {
          width: 0.55rem;
          height: 0.55rem;
          border-radius: 999px;
          background: rgba(184, 134, 11, 0.45);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: background 0.25s, width 0.25s ease;
        }
        .carousel-dot:hover { background: rgba(218, 165, 32, 0.85); }
        .carousel-dot--active {
          width: 1.6rem;
          background: linear-gradient(90deg, var(--color-gold-dim), var(--color-gold-light));
          box-shadow: 0 0 12px rgba(255, 215, 0, 0.45);
        }

        [data-theme="light"] .carousel-arrow {
          color: var(--color-gold-dim);
          border-color: rgba(184, 134, 11, 0.55);
        }
        [data-theme="light"] .carousel-arrow:hover {
          background: rgba(184, 134, 11, 0.10);
        }
      `}</style>
    </section>
  );
}
