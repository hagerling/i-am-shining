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
    <section style={{ width: '100%', maxWidth: '860px', margin: '0 auto', padding: '5rem 1rem 5rem' }}>
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

      {/* Masonry testimonial grid */}
      <div
        ref={gridRef}
        style={{ columns: '2', columnGap: '1.25rem' }}
        className="testimonial-grid"
      >
        {testimonials.map((t, i) => (
          <figure
            key={i}
            className="testimonial-card"
            itemScope
            itemType="https://schema.org/Review"
            style={{
              breakInside: 'avoid',
              marginBottom: '1.25rem',
              background: 'var(--color-surface)',
              border: '1px solid rgba(184, 134, 11, 0.12)',
              borderRadius: 'var(--radius-card)',
              padding: '1.5rem',
              display: 'inline-block',
              width: '100%',
              boxSizing: 'border-box',
              transition: 'opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1), border-color 0.25s, box-shadow 0.25s',
              margin: 0,
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
        ))}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .testimonial-grid { columns: 1 !important; }
        }
        .testimonial-card:hover {
          border-color: rgba(184, 134, 11, 0.35) !important;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
        }
      `}</style>
    </section>
  );
}
