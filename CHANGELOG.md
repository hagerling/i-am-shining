# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-09-03

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
- `src/pages/components/` is a dev-only route: `astro dev` still serves it, but
  an `exclude-dev-only-routes` integration drops it (and its orphaned
  stylesheet) from `dist/` and from the sitemap at build time

### Fixed
- Rotating profile coin was inert — Astro scoped `.profile-canvas-wrapper` /
  `.profile-rotating` to the page, so the rules never matched the
  React-rendered node. Wrapped in `:global(...)`
- 100vh controls push-down was inert for the same reason: `.has-photo` sits on
  `<html>` and `[data-controls-block]` on a React node, neither of which carry
  the page scope attribute. Wrapped in `:global(...)`
- Restored the mobile URL-bar guard on the full-height banner. The 100vh
  banner and its mirrored reflection now carry `.banner-viewport-height`, which
  upgrades them to `100svh` where supported, so the retracting URL bar can no
  longer make the banner overflow the screen
- Hero stretch was still inert after globalising `.has-photo .hero`: the
  globalised rule and Astro's `.hero[data-astro-cid-…]` have identical
  specificity (0,2,0) and the scoped one is emitted later, so `height: 12rem`
  kept winning and the controls bar straddled the banner edge. Raised to
  `html.has-photo .hero`. Same latent loss fixed on `.has-photo .hero h1 em`,
  which was losing the white text fill to the gold-gradient scoped rule in dark
  theme
- Page no longer scrolls sideways. The decorative bleed (sunburst rays, cloud
  puffs, the 100vw banner, the carousel edge glow) is now contained by
  `overflow-x: clip` on `<html>` and `<main>`; the effects are unchanged, only
  the off-screen part is clipped
- Glass controls toolbar now wraps on narrow viewports. At 390px the
  non-shrinking row ran 69px past the viewport edge, taking the Download button
  with it; it now wraps to three rows and every control stays reachable

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
