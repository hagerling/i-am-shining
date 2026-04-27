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
    <section style={{ width: '100%', maxWidth: '1080px', margin: '0 auto', padding: '5rem 1.5rem 5rem' }}>
      {/* Section header */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
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
          marginBottom: '0.75rem',
        }}>
          Community
        </div>
        <h2 style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.1,
        }}>
          Who&apos;s{' '}
          <em style={{
            fontStyle: 'italic',
            background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>#Shining</em>
        </h2>
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
            className="testimonial-card"
            data-featured={featured ? 'true' : undefined}
            itemScope
            itemType="https://schema.org/Review"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid rgba(184, 134, 11, 0.12)',
              borderRadius: 'var(--radius-card)',
              padding: featured ? '2rem 2.25rem' : '1.5rem 1.75rem',
              boxSizing: 'border-box',
              transition: 'opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1)',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.25rem',
              minHeight: featured ? '11rem' : '9rem',
              ...(featured ? {
                background: 'linear-gradient(160deg, var(--color-surface-2) 0%, var(--color-surface) 100%)',
                borderColor: 'rgba(184, 134, 11, 0.28)',
              } : {}),
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
        .testimonial-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1.5rem;
        }
        /* Cycle of varied widths every 6 cards: 4, 2, 3, 3, 2, 4
         * Row 1: featured (4) + compact (2)
         * Row 2: half-width (3) + half-width (3)
         * Row 3: compact (2) + featured (4) */
        .testimonial-card:nth-child(6n + 1) { grid-column: span 4; }
        .testimonial-card:nth-child(6n + 2) { grid-column: span 2; }
        .testimonial-card:nth-child(6n + 3) { grid-column: span 3; }
        .testimonial-card:nth-child(6n + 4) { grid-column: span 3; }
        .testimonial-card:nth-child(6n + 5) { grid-column: span 2; }
        .testimonial-card:nth-child(6n + 6) { grid-column: span 4; }
        /* Featured cards get a slightly larger quote face for visual rhythm. */
        .testimonial-card[data-featured="true"] blockquote {
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
      `}</style>
    </section>
  );
}
