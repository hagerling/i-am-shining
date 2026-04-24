# I am Shining

**Upload a photo. Apply the golden #Shining frame. Download your radiant profile picture.**

Live at [i-am-shining.com](https://i-am-shining.com) — free, browser-based, no uploads to any server.

## What it does

- Drag and drop (or click to browse) a profile photo
- The golden crescent frame is applied in real time on an HTML5 Canvas
- Drag to reposition, scroll/pinch to zoom your photo within the circular crop
- Adjust iridescent shine intensity
- Download as a 600×600 px PNG — ready for LinkedIn, X, Instagram, Slack, GitHub

## Tech stack

- [Astro](https://astro.build) — static site generator
- [React](https://react.dev) — interactive components
- [Framer Motion](https://www.framer.com/motion/) — animations
- [Tailwind CSS v4](https://tailwindcss.com) — utility styles
- TypeScript strict mode throughout

## Development

```sh
npm install
npm run dev       # localhost:4321
npm run build     # production build to dist/
npm run preview   # preview the build locally
npm test          # run unit tests
```

## Deploy

Deployed via FTP to [Loopia](https://loopia.se). After a successful build:

```sh
npm run build
npm run deploy
```

## Versioning

Follows [Semantic Versioning](https://semver.org). See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT — see [LICENSE](LICENSE).
