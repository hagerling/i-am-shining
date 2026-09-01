# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Retro-glam pass: sunburst rays behind the profile circle, a pure-CSS page
  glitter layer, cloud puffs, sunset arcs and a hand-drawn ribbon banner
- Glitter-textured display H1 — SVG sparkle noise blended over a multi-stop
  gold gradient and clipped to the text, with a slow shimmer pan
- Testimonial carousel with a centred rotating profile coin
- Dynamic kaleidoscope banner motion — three layered copies of the banner
  image counter-rotating at different rates, blended so the facets interfere
- FAQ label, sparkle heading flourish and subheading
- `scripts/release.sh` plus `release` / `release:patch` / `release:minor` /
  `release:major` npm scripts

### Changed
- Banner is now a 100vh above-the-fold hero with the profile centred; the hero
  stretches so the profile circle's centre lands at 50vh
- Testimonial section heading scaled up to `clamp(2.5rem, 6vw, 4.5rem)`

## [1.0.0] — 2026-04-24

### Added
- Profile photo editor with golden #Shining crescent frame
- Drag to reposition, scroll/pinch to zoom within circular crop
- Iridescent shine intensity slider
- PNG download at 600×600 px (iOS long-press to save to Photos)
- Social feed with testimonials
- FAQ section
- DiscoBall ambient background animation
- Theme toggle (dark / light)
- LinkedIn banner generator (in progress)
- Face detection for sparkle placement (in progress)
- Fade-only load animations — no slide or scale on entry
- About page
- Full SEO: Open Graph, Twitter Card, JSON-LD structured data, sitemap, robots.txt, llms.txt
- Accessible: skip link, ARIA labels, semantic HTML
