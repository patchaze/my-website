import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://www.duriantravel.com',
  output: 'static',
  integrations: [
    mdx(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      cssMinify: true,
      minify: 'esbuild',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Keep each page's CSS separate to avoid cross-page CSS loading
            if (id.includes('src/pages/')) {
              const match = id.match(/src\/pages\/([^/]+)/);
              if (match) return `page-${match[1].replace(/\./g, '_')}`;
            }
          }
        }
      }
    },
  },
});
