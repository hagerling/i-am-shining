import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://hagerling.se',
  base: '/shining',
  integrations: [react()],
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
