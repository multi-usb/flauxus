import { defineConfig } from 'vite';

// Precarga la fuente de PRESS START (Pixelify Sans) — su nombre final lleva hash, así que se inyecta al generar el HTML.
const DISPLAY_FONT = '@fontsource-variable/pixelify-sans/files/pixelify-sans-latin-wght-normal.woff2';
function preloadDisplayFont() {
  return {
    name: 'preload-display-font',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        let href = `/node_modules/${DISPLAY_FONT}`;
        if (ctx.bundle) {
          const asset = Object.values(ctx.bundle).find((f) => f.fileName.includes('pixelify-sans-latin-wght-normal'));
          if (asset) href = `/${asset.fileName}`;
        }
        return [{ tag: 'link', attrs: { rel: 'preload', href, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  server: { port: 5173 },
  plugins: [preloadDisplayFont()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    // El chunk 3D (Three.js + GSAP + troika) se carga diferido, después de la pantalla de inicio.
    chunkSizeWarningLimit: 900,
  },
});
