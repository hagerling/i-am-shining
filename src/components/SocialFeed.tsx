import { useEffect, useRef } from 'react';
import { Sparkle } from '@phosphor-icons/react';

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

export function SocialFeed({ testimonials }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Stagger-reveal each card as it enters the viewport
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('.testimonial-card');
    if (!cards) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'none';
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(28px)';
      card.style.transitionDelay = `${i * 55}ms`;
      obs.observe(card);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <section className="community-section" style={{ width: '100%', maxWidth: '1080px', margin: '0 auto', padding: '5rem 1.5rem 5rem', position: 'relative' }}>
      {/* Soft golden glow behind the cards — gives backdrop-filter
          something to sample, so the frosted look reads on dark bg. */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: '-10% 5% 10% 5%',
        background:
          'radial-gradient(ellipse 70% 50% at 30% 30%, rgba(218,165,32,0.08) 0%, transparent 60%),' +
          'radial-gradient(ellipse 60% 40% at 75% 75%, rgba(255,180,80,0.06) 0%, transparent 60%)',
        filter: 'blur(40px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      {/* Section header */}
      <div style={{ marginBottom: '3.25rem', textAlign: 'center' }}>
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
          Community
        </div>
        <h2 className="heading-sparkle" style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.1,
          fontStyle: 'italic',
        }}>
          <span>
            Words to <em style={{
              fontStyle: 'italic',
              background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light), var(--color-magenta))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>live by</em>
          </span>
        </h2>
        <p style={{
          marginTop: '0.6rem',
          color: 'var(--color-text-muted)',
          fontSize: '0.92rem',
          letterSpacing: '0.02em',
        }}>
          From people choosing to <em style={{ fontStyle: 'italic', color: 'var(--color-magenta)' }}>shine</em>.
        </p>
      </div>

      {/* Bento testimonial grid — varied card widths cycle every 6 cards.
          The first card in each cycle (4-col) reads as the "featured" one
          with a slightly larger quote face. */}
      <div
        ref={gridRef}
        className="testimonial-grid"
      >
        {testimonials.map((t, i) => {
          const featured = i % 6 === 0;
          return (
          <figure
            key={i}
            className={featured ? 'testimonial-card testimonial-card--featured' : 'testimonial-card'}
            data-featured={featured ? 'true' : undefined}
            itemScope
            itemType="https://schema.org/Review"
            style={{
              padding: featured ? '2rem 2.25rem' : '1.5rem 1.75rem',
              minHeight: featured ? '11rem' : '9rem',
            }}
          >
            <meta itemProp="itemReviewed" content="I am Shining" />
            {t.date && <meta itemProp="datePublished" content={t.date} />}
            {/* Quote mark */}
            <Sparkle
              size={30}
              weight="fill"
              color="var(--color-gold)"
              style={{ marginBottom: '0.5rem', opacity: 0.7 }}
            />

            {/* Quote text — readable italic serif, up from the display face
                (DM Serif Display) which was cramping at body size. */}
            <blockquote
              itemProp="reviewBody"
              style={{
                color: 'var(--color-text)',
                fontSize: '1.08rem',
                lineHeight: 1.6,
                margin: '0 0 1.25rem',
                fontStyle: 'italic',
                fontFamily: '"Iowan Old Style", "Charter", "Source Serif Pro", Georgia, serif',
                letterSpacing: '0.005em',
              }}
            >
              &ldquo;{t.quote}&rdquo;
            </blockquote>

            {/* Author */}
            <figcaption
              itemProp="author"
              itemScope
              itemType="https://schema.org/Person"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              {/* Avatar with Shining frame overlay */}
              {t.avatar ? (
                <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
                  <img
                    src={t.avatar}
                    alt={`Portrait of ${t.name}, ${t.title}`}
                    width={44}
                    height={44}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <img
                    src={`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/shining-frame.png`}
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
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#000',
                }}>
                  {t.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                </div>
              )}
              <div>
                <div itemProp="name" style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.85rem' }}>
                  {t.name}
                </div>
                <div itemProp="jobTitle" style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                  {t.title}
                </div>
              </div>
            </figcaption>
          </figure>
        );
        })}
      </div>

      <style>{`
        .community-section { isolation: isolate; }
        .testimonial-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1.5rem;
        }
        /* ── Frosted-glass card ───────────────────────────────────────────
         * Layered effect:
         *   1. Translucent dark gradient base (the "glass body")
         *   2. backdrop-filter blur + saturate (lifts the disco-ball + radial
         *      behind into the glass for that real-translucency feel)
         *   3. ::before — soft warm sheen at the top-left (the "shine")
         *   4. ::after  — luminous gradient border via mask-composite: a
         *      bright golden highlight on the top-left edge that fades
         *      to a faint hairline on the bottom-right.
         *   5. box-shadow stack: specular top inset, gold ambient glow,
         *      depth shadow, contact shadow. */
        .testimonial-card {
          position: relative;
          isolation: isolate;
          margin: 0;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.25rem;
          border-radius: var(--radius-card);
          background:
            linear-gradient(168deg,
              rgba(48, 30, 10, 0.55) 0%,
              rgba(28, 18, 6, 0.40) 55%,
              rgba(20, 12, 3, 0.32) 100%);
          backdrop-filter: blur(30px) saturate(160%);
          -webkit-backdrop-filter: blur(30px) saturate(160%);
          /* Border drawn by ::after — keep this transparent so the
           * gradient ring sits flush with the rounded corners. */
          border: 1px solid transparent;
          box-shadow:
            inset 0 1px 0 rgba(255, 245, 210, 0.09),    /* specular top edge */
            inset 0 -1px 0 rgba(0, 0, 0, 0.20),         /* shadow under bottom edge */
            0 1px 2px rgba(0, 0, 0, 0.30),              /* contact shadow */
            0 14px 40px rgba(0, 0, 0, 0.34),            /* depth shadow */
            0 0 32px rgba(218, 165, 32, 0.06);          /* warm ambient glow */
          transition:
            opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* ── Sheen pseudo (::before) — warm light hitting top-left ──── */
        .testimonial-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(ellipse 90% 55% at 0% 0%, rgba(255, 232, 140, 0.16) 0%, rgba(255, 215, 0, 0.04) 30%, transparent 60%),
            linear-gradient(180deg, rgba(255, 240, 200, 0.05) 0%, transparent 25%);
          pointer-events: none;
          z-index: -1;
        }

        /* ── Luminous gradient border (::after) ────────────────────────
         * mask-composite trick paints a 1px ring with a brightness
         * gradient, so the border looks like glass catching light at
         * the top edge and fading into shadow at the bottom. */
        .testimonial-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(160deg,
            rgba(255, 232, 140, 0.55) 0%,
            rgba(218, 165, 32, 0.30) 25%,
            rgba(184, 134, 11, 0.18) 55%,
            rgba(184, 134, 11, 0.10) 80%,
            rgba(255, 215, 0, 0.18) 100%);
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Featured card — brighter glass, stronger glow ──────────── */
        .testimonial-card--featured {
          background:
            linear-gradient(160deg,
              rgba(64, 40, 12, 0.62) 0%,
              rgba(36, 22, 6, 0.45) 55%,
              rgba(20, 12, 3, 0.38) 100%);
          box-shadow:
            inset 0 1.5px 0 rgba(255, 245, 210, 0.14),
            inset 0 -1px 0 rgba(0, 0, 0, 0.22),
            0 1px 2px rgba(0, 0, 0, 0.32),
            0 22px 50px rgba(0, 0, 0, 0.40),
            0 0 60px rgba(218, 165, 32, 0.14);          /* bigger gold halo */
        }
        .testimonial-card--featured::before {
          background:
            radial-gradient(ellipse 100% 70% at 0% 0%,  rgba(255, 215, 0, 0.22) 0%, rgba(255, 215, 0, 0.06) 30%, transparent 60%),
            radial-gradient(ellipse 80% 60% at 100% 100%, rgba(255, 180, 80, 0.10) 0%, transparent 60%),
            linear-gradient(180deg, rgba(255, 240, 200, 0.08) 0%, transparent 28%);
        }
        .testimonial-card--featured::after {
          padding: 1.5px;  /* thicker border for the featured */
          background: linear-gradient(155deg,
            rgba(255, 240, 170, 0.85) 0%,
            rgba(255, 215, 0, 0.55) 18%,
            rgba(218, 165, 32, 0.28) 50%,
            rgba(184, 134, 11, 0.18) 80%,
            rgba(255, 215, 0, 0.32) 100%);
        }

        /* Bento width cycle: 4, 2, 3, 3, 2, 4 (sums to two rows of 6) */
        .testimonial-card:nth-child(6n + 1) { grid-column: span 4; }
        .testimonial-card:nth-child(6n + 2) { grid-column: span 2; }
        .testimonial-card:nth-child(6n + 3) { grid-column: span 3; }
        .testimonial-card:nth-child(6n + 4) { grid-column: span 3; }
        .testimonial-card:nth-child(6n + 5) { grid-column: span 2; }
        .testimonial-card:nth-child(6n + 6) { grid-column: span 4; }

        /* Featured cards get a slightly larger quote face for visual rhythm. */
        .testimonial-card--featured blockquote {
          font-size: 1.25rem !important;
          line-height: 1.55 !important;
        }

        @media (max-width: 720px) {
          .testimonial-grid { grid-template-columns: 1fr !important; gap: 1.25rem; }
          .testimonial-card,
          .testimonial-card:nth-child(6n + 1),
          .testimonial-card:nth-child(6n + 2),
          .testimonial-card:nth-child(6n + 3),
          .testimonial-card:nth-child(6n + 4),
          .testimonial-card:nth-child(6n + 5),
          .testimonial-card:nth-child(6n + 6) { grid-column: span 1; }
        }

        /* ── Light theme variant ───────────────────────────────────────
         * Inverted glass: bright translucent surface, darker gold border
         * gradient so the edge still glows on the warm cream background. */
        [data-theme="light"] .testimonial-card {
          background:
            linear-gradient(168deg,
              rgba(255, 250, 235, 0.72) 0%,
              rgba(252, 244, 225, 0.55) 60%,
              rgba(248, 238, 216, 0.45) 100%);
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.65),
            inset 0 -1px 0 rgba(120, 80, 20, 0.06),
            0 1px 2px rgba(120, 80, 20, 0.04),
            0 14px 40px rgba(120, 80, 20, 0.10),
            0 0 32px rgba(218, 165, 32, 0.10);
        }
        [data-theme="light"] .testimonial-card::before {
          background:
            radial-gradient(ellipse 90% 55% at 0% 0%, rgba(255, 232, 140, 0.30) 0%, rgba(255, 215, 0, 0.08) 30%, transparent 60%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.30) 0%, transparent 25%);
        }
        [data-theme="light"] .testimonial-card::after {
          background: linear-gradient(160deg,
            rgba(218, 165, 32, 0.55) 0%,
            rgba(184, 134, 11, 0.35) 30%,
            rgba(184, 134, 11, 0.18) 65%,
            rgba(184, 134, 11, 0.12) 90%,
            rgba(218, 165, 32, 0.30) 100%);
        }
        [data-theme="light"] .testimonial-card--featured {
          background:
            linear-gradient(160deg,
              rgba(255, 252, 240, 0.88) 0%,
              rgba(255, 245, 220, 0.62) 60%,
              rgba(250, 238, 210, 0.52) 100%);
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.85),
            inset 0 -1px 0 rgba(140, 90, 25, 0.08),
            0 22px 50px rgba(140, 90, 25, 0.14),
            0 0 50px rgba(218, 165, 32, 0.22);
        }
        [data-theme="light"] .testimonial-card--featured::after {
          background: linear-gradient(155deg,
            rgba(218, 165, 32, 0.85) 0%,
            rgba(184, 134, 11, 0.55) 25%,
            rgba(184, 134, 11, 0.30) 60%,
            rgba(184, 134, 11, 0.20) 85%,
            rgba(218, 165, 32, 0.45) 100%);
        }
      `}</style>
    </section>
  );
}
