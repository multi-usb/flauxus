import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// El videojuego es un proyecto aparte, sin compilación (Three.js por importmap). Vive en ../juego y se publica
// tal cual en /juego/: en desarrollo lo sirve este plugin y al compilar se copia a dist/juego/.
// Otra ubicación: FLAUXUS_GAME_DIR=/ruta/al/juego npm run dev
const GAME_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), process.env.FLAUXUS_GAME_DIR || '../juego');
const GAME_BASE = '/juego/';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.fbx': 'application/octet-stream', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.md': 'text/markdown; charset=utf-8',
};
const skipGameFile = (p) => /(^|[\\/])\.git(ignore)?($|[\\/])/.test(p);

// ../juego/.webignore: másters y herramientas que no se publican (ver el propio archivo).
function webIgnore() {
  const file = path.join(GAME_DIR, '.webignore');
  if (!fs.existsSync(file)) return () => false;
  const rules = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  return (rel) => {
    const p = rel.split(path.sep).join('/');
    return rules.some((r) => {
      if (r.endsWith('/')) return p === r.slice(0, -1) || p.startsWith(r);
      if (r.startsWith('**/')) return p.endsWith(r.slice(3));
      if (r.startsWith('*.')) return !p.includes('/') && p.toLowerCase().endsWith(r.slice(1).toLowerCase());
      return p === r;
    });
  };
}

function flauxusGame() {
  return {
    name: 'flauxus-game',
    configureServer(server) {
      if (!fs.existsSync(GAME_DIR)) {
        server.config.logger.warn(`[flauxus-game] No se encontró el juego en ${GAME_DIR}`);
        return;
      }
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        if (url === GAME_BASE.slice(0, -1)) { res.statusCode = 301; res.setHeader('Location', GAME_BASE); res.end(); return; }
        if (!url.startsWith(GAME_BASE)) return next();
        let file = path.join(GAME_DIR, url.slice(GAME_BASE.length));
        if (!file.startsWith(GAME_DIR) || skipGameFile(path.relative(GAME_DIR, file))) { res.statusCode = 403; res.end(); return; }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
        const { size } = fs.statSync(file);
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Content-Length', size);
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (!fs.existsSync(GAME_DIR)) { this.warn(`No se encontró el juego en ${GAME_DIR}; dist/ queda sin /juego/`); return; }
      const out = path.resolve('dist', GAME_BASE.slice(1, -1));
      const ignored = webIgnore();
      fs.rmSync(out, { recursive: true, force: true }); // dist/juego viejo con másters de una build anterior
      fs.cpSync(GAME_DIR, out, {
        recursive: true,
        filter: (src) => { const rel = path.relative(GAME_DIR, src); return !rel || (!skipGameFile(rel) && !ignored(rel)); },
      });
    },
  };
}

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
  plugins: [preloadDisplayFont(), flauxusGame()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    // El chunk 3D (Three.js + GSAP + troika) se carga diferido, después de la pantalla de inicio.
    chunkSizeWarningLimit: 900,
  },
});
