import { useEffect, useRef } from 'react';

interface SocialPost {
  platform: string;
  author: string;
  authorTitle?: string;
  content: string;
  url: string;
  date: string;
  avatar: string | null;
}

interface Props {
  linkedinPosts: SocialPost[];
}

export function SocialFeed({ linkedinPosts }: Props) {
  const twitterRef = useRef<HTMLDivElement>(null);

  // Inject Twitter widget script once
  useEffect(() => {
    if (!twitterRef.current) return;
    const existing = document.getElementById('twitter-wjs');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'twitter-wjs';
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      document.body.appendChild(script);
    } else {
      // If already loaded, re-parse widgets
      (window as any).twttr?.widgets?.load(twitterRef.current);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <section style={{ width: '100%', maxWidth: '700px', margin: '0 auto', padding: '0 1rem 4rem' }}>
      <div className="flex flex-col items-center gap-2" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
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
        }}>
          Community
        </div>
        <h2 style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.1,
        }}>
          Who&apos;s <em style={{
            fontStyle: 'italic',
            background: 'linear-gradient(135deg, var(--color-gold-dim), var(--color-gold-light))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>#Shining</em>
        </h2>
      </div>

      <div className="flex flex-col gap-8">
        {/* Twitter live widget */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--color-gold)' }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.845L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              Latest on X
            </span>
          </div>
          <div
            ref={twitterRef}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-gold-dim)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
            }}
          >
            <a
              className="twitter-timeline"
              data-theme="dark"
              data-chrome="noheader nofooter noborders"
              data-tweet-limit="5"
              data-height="500"
              href="https://twitter.com/hashtag/shining?src=hashtag_click&f=live"
            >
              #shining on X
            </a>
          </div>
        </div>

        {/* LinkedIn manual posts */}
        {linkedinPosts.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--color-gold)' }}>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                LinkedIn
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {linkedinPosts.map((post, i) => (
                <a
                  key={i}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-gold-dim)',
                    borderRadius: 'var(--radius-card)',
                    padding: '1.25rem 1.5rem',
                    textDecoration: 'none',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gold)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gold-dim)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)';
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.9rem' }}>
                          {post.author}
                        </div>
                        {post.authorTitle && (
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                            {post.authorTitle}
                          </div>
                        )}
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {formatDate(post.date)}
                      </div>
                    </div>
                    <p style={{ color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                      {post.content}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
