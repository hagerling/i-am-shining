import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Staging deploy lives at https://i-am-shining.com/staging/.
// Set STAGING=1 when building the staging branch so all generated URLs
// (assets, links, OG, sitemap) include the /staging/ prefix.
const isStaging = process.env.STAGING === '1';

export default defineConfig({
  site: 'https://i-am-shining.com',
  base: isStaging ? '/staging/' : '/',
  integrations: [react()],
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
