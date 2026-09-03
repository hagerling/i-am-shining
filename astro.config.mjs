import { readdir, readFile, rm } from 'node:fs/promises';

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// Staging deploy lives at https://i-am-shining.com/staging/.
// Set STAGING=1 when building the staging branch so all generated URLs
// (assets, links, OG, sitemap) include the /staging/ prefix.
const isStaging = process.env.STAGING === '1';

// Routes that exist for local reference only and must never be deployed.
// `src/pages/components/` is the internal component library: it documents
// local checkout paths and internals, so it stays a dev-only route.
//
// Astro has no config-level "don't build this page" switch, and renaming the
// directory to `_components/` would also kill the dev route. So the route is
// dropped from the build output here, in the build config itself, rather than
// by a manual `rm` someone has to remember. `astro dev` is untouched —
// http://localhost:4321/components/ still works.
const DEV_ONLY_ROUTES = ['/components'];

/** @returns {import('astro').AstroIntegration} */
function excludeDevOnlyRoutes() {
  return {
    name: 'exclude-dev-only-routes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        for (const route of DEV_ONLY_ROUTES) {
          await rm(new URL(`.${route}/`, dir), { recursive: true, force: true });
          logger.info(`Excluded dev-only route ${route}/ from the build output`);
        }

        // Deleting the HTML orphans that page's own stylesheet in dist/_astro/,
        // which still carries its markup's class names. Sweep any stylesheet
        // nothing in the remaining output links to or imports. Scoped to CSS
        // on purpose — JS chunks can be pulled in transitively, stylesheets
        // are always named outright by the HTML or JS that needs them.
        const assetsDir = new URL('./_astro/', dir);
        const orphanCandidates = (await readdir(assetsDir)).filter((f) => f.endsWith('.css'));
        if (orphanCandidates.length > 0) {
          const referenced = new Set();
          const scan = async (folder) => {
            for (const entry of await readdir(folder, { withFileTypes: true })) {
              const child = new URL(`./${entry.name}${entry.isDirectory() ? '/' : ''}`, folder);
              if (entry.isDirectory()) {
                await scan(child);
              } else if (/\.(html|js|css)$/.test(entry.name)) {
                const body = await readFile(child, 'utf8');
                for (const name of orphanCandidates) {
                  if (name !== entry.name && body.includes(name)) referenced.add(name);
                }
              }
            }
          };
          await scan(dir);
          for (const name of orphanCandidates) {
            if (referenced.has(name)) continue;
            await rm(new URL(`./${name}`, assetsDir), { force: true });
            logger.info(`Removed orphaned stylesheet _astro/${name}`);
          }
        }
      },
    },
  };
}

export default defineConfig({
  site: 'https://i-am-shining.com',
  base: isStaging ? '/staging/' : '/',
  integrations: [
    react(),
    // Keep the dev-only routes out of the sitemap too, not just out of dist/.
    sitemap({
      filter: (page) =>
        !DEV_ONLY_ROUTES.some((route) => new URL(page).pathname.replace(/\/$/, '').endsWith(route)),
    }),
    excludeDevOnlyRoutes(),
  ],
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
