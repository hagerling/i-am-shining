import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';

const PROFILES = [
  { name: 'Goldie Torrance', headline: 'Spreading radiance, one profile at a time | #Shining', location: 'Brightside, California' },
  { name: 'Aurora Gleam', headline: 'Brand strategist by day, golden hour chaser by night | #Shining', location: 'Sunnyvale, California' },
  { name: 'Ray Lustro', headline: 'Helping teams shine brighter together | #Shining', location: 'Stockholm, Sweden' },
  { name: 'Stella Goldwyn', headline: 'Product designer with a glow-up mindset | #Shining', location: 'Brooklyn, New York' },
  { name: 'Sol Brillante', headline: 'Turning ideas into golden opportunities | #Shining', location: 'Barcelona, Spain' },
  { name: 'Kira Solstice', headline: 'Engineering lead · building things that sparkle | #Shining', location: 'Austin, Texas' },
  { name: 'Blaze Aurum', headline: 'Creative director · obsessed with light and colour | #Shining', location: 'London, United Kingdom' },
  { name: 'Nova Shimmer', headline: 'Content creator · making the feed a little brighter | #Shining', location: 'Melbourne, Australia' },
  { name: 'Lux Radiance', headline: 'Startup founder · powered by optimism and coffee | #Shining', location: 'Berlin, Germany' },
  { name: 'Sunny Halo', headline: 'UX researcher · designing for delight | #Shining', location: 'Toronto, Canada' },
];

interface Props {
  profileImgUrl: string | null;
  bannerImgUrl: string | null;
  /** Frame style — determines LinkedIn logo colour.
   *  Silver = bright (blue logo), Gold/Rose = colourful (white logo). */
  frameStyle?: 'gold' | 'rose' | 'silver';
  /** Seed that changes on each photo drop — triggers profile randomization. */
  seed?: number;
}

/**
 * Displays a mock LinkedIn profile card using the user's generated
 * profile picture and banner, so they can preview how their #Shining
 * images will look on LinkedIn. All personal data is fictional and
 * inspired by the Shining brand theme.
 *
 * Responds to data-theme="light" / "dark" on <html> for full theme support.
 */
export function LinkedInPreview({ profileImgUrl, bannerImgUrl, frameStyle = 'gold', seed = 0 }: Props) {
  const profile = useMemo(() => PROFILES[Math.abs(seed) % PROFILES.length], [seed]);
  // Listen for theme changes on <html data-theme>
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const html = document.documentElement;
    const read = () => setTheme((html.getAttribute('data-theme') as 'dark' | 'light') || 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!profileImgUrl || !bannerImgUrl) return null;

  const isDark = theme === 'dark';

  // Theme-aware colours
  const cardBg = isDark ? '#1b1f23' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardShadow = isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.1)';
  const profileBorder = isDark ? '#1b1f23' : '#ffffff';
  const nameColor = isDark ? '#e8e8e8' : '#191919';
  const headlineColor = isDark ? '#b0b0b0' : '#666666';
  const locationColor = isDark ? '#7a7a7a' : '#999999';
  const moreColor = isDark ? '#b0b0b0' : '#666666';
  const moreBorder = isDark ? '#666' : '#ccc';
  const connectionsColor = '#0A66C2';
  const dotColor = isDark ? '#555' : '#bbb';

  // LinkedIn logo colour — sample the banner's top-right corner (where the
  // logo sits) to pick white or blue based on actual brightness.
  const [logoColor, setLogoColor] = useState('#ffffff');
  useEffect(() => {
    if (!bannerImgUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      // Sample a small region in the top-right corner
      const sampleW = Math.round(img.naturalWidth * 0.12);
      const sampleH = Math.round(img.naturalHeight * 0.25);
      const sx = img.naturalWidth - sampleW;
      c.width = sampleW;
      c.height = sampleH;
      const ctx2 = c.getContext('2d');
      if (!ctx2) return;
      ctx2.drawImage(img, sx, 0, sampleW, sampleH, 0, 0, sampleW, sampleH);
      const data = ctx2.getImageData(0, 0, sampleW, sampleH).data;
      let total = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        // Perceived brightness (rec. 709)
        total += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      }
      const avgBrightness = total / pixels;
      // Bright background → blue logo; dark/colourful → white logo
      setLogoColor(avgBrightness > 140 ? '#0A66C2' : '#ffffff');
    };
    img.src = bannerImgUrl;
  }, [bannerImgUrl]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      aria-label="LinkedIn profile preview"
      style={{
        width: '100%',
        maxWidth: 700,
        margin: '0 auto',
        padding: '0 1rem',
      }}
    >
      {/* Section label — uses glitter-text class for gold shimmer */}
      <p
        className="glitter-text"
        style={{
          textAlign: 'center',
          fontSize: '0.82rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginBottom: '1.25rem',
        }}
      >
        ✦ Preview on LinkedIn ✦
      </p>

      {/* Card */}
      <div style={{
        background: cardBg,
        borderRadius: '0.75rem',
        overflow: 'hidden',
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        position: 'relative',
        transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
      }}>
        {/* LinkedIn logo overlay */}
        <div style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          zIndex: 10,
          opacity: 0.7,
        }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="LinkedIn"
          >
            <path
              d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
              fill={logoColor}
            />
          </svg>
        </div>

        {/* Banner */}
        <div style={{
          width: '100%',
          height: 'clamp(96px, 25vw, 148px)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <img
            src={bannerImgUrl}
            alt=""
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Profile picture — overlapping the banner */}
        <div style={{
          marginTop: 'clamp(-40px, -8vw, -56px)',
          marginLeft: '1.25rem',
          width: 'clamp(72px, 16vw, 104px)',
          height: 'clamp(72px, 16vw, 104px)',
          borderRadius: '50%',
          overflow: 'hidden',
          border: `3px solid ${profileBorder}`,
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
          transition: 'border-color 0.3s',
        }}>
          <img
            src={profileImgUrl}
            alt=""
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Profile info */}
        <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
          {/* Name + headline */}
          <h3 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)',
            fontWeight: 700,
            color: nameColor,
            margin: '0 0 0.15rem',
            lineHeight: 1.3,
            transition: 'color 0.3s',
          }}>
            {profile.name}
          </h3>
          <p style={{
            fontSize: 'clamp(0.72rem, 1.8vw, 0.82rem)',
            color: headlineColor,
            margin: '0 0 0.35rem',
            lineHeight: 1.45,
            transition: 'color 0.3s',
          }}>
            {profile.headline}
          </p>
          <p style={{
            fontSize: 'clamp(0.65rem, 1.5vw, 0.72rem)',
            color: locationColor,
            margin: '0 0 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'color 0.3s',
          }}>
            {profile.location}
            <span style={{ color: dotColor }}>&middot;</span>
            <span style={{ color: connectionsColor, fontWeight: 500 }}>500+ connections</span>
          </p>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <div style={{
              padding: '0.35rem 1rem',
              borderRadius: '999px',
              background: '#0A66C2',
              color: '#fff',
              fontSize: 'clamp(0.68rem, 1.6vw, 0.78rem)',
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              Connect
            </div>
            <div style={{
              padding: '0.35rem 1rem',
              borderRadius: '999px',
              background: 'transparent',
              border: '1px solid #0A66C2',
              color: '#0A66C2',
              fontSize: 'clamp(0.68rem, 1.6vw, 0.78rem)',
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              Message
            </div>
            <div style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              background: 'transparent',
              border: `1px solid ${moreBorder}`,
              color: moreColor,
              fontSize: 'clamp(0.68rem, 1.6vw, 0.78rem)',
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              transition: 'color 0.3s, border-color 0.3s',
            }}>
              More
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
