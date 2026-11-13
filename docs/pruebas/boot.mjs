// Preloader e inicio de la landing: rectángulos y capturas en varias resoluciones.
import path from 'node:path';
import { launch, sleep, SHOTS, BASE } from './lib.mjs';
const SIZES = [[320, 568, 1], [375, 667, 1], [390, 844, 1], [430, 932, 1], [844, 390, 1], [768, 1024, 1], [1024, 768, 0], [1366, 768, 0], [1920, 1080, 0], [2560, 1080, 0]];
const rects = () => { const W = innerWidth, H = innerHeight, o = {}, bad = []; for (const q of ['.boot-logo', '.boot-tape', '.tape-bar', '.tape-label', '.home-tagline', '.press-start', '.home-audio-caption']) { const el = document.querySelector('#boot ' + q); if (!el) continue; const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) continue; const r = el.getBoundingClientRect(); if (r.width < 2) continue; o[q] = [r.left, r.top, r.right, r.bottom].map(Math.round); if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) bad.push(q + ' fuera'); } const k = Object.keys(o).filter(q => q !== '.boot-tape'); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = o[k[i]], b = o[k[j]]; const ix = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), iy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (ix > 1 && iy > 1) bad.push(`${k[i]}×${k[j]} (${iy}px)`); } return { o, bad }; };
const b = await launch();
for (const [w, h, t] of SIZES) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!t, isMobile: !!t });
  // red lenta simulada para que el preloader se alcance a ver
  const c = await p.createCDPSession(); await c.send('Network.enable'); await c.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 400 * 1024 / 8 * 4, uploadThroughput: 1e6 });
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(1600);
  const a = await p.evaluate(rects); await p.screenshot({ path: path.join(SHOTS, `boot_${w}x${h}_carga.jpg`), type: 'jpeg', quality: 70 });
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000 });
  await sleep(2600);
  const z = await p.evaluate(rects); await p.screenshot({ path: path.join(SHOTS, `boot_${w}x${h}_inicio.jpg`), type: 'jpeg', quality: 70 });
  console.log(`${w}x${h}`, 'carga:', JSON.stringify(a.bad), 'inicio:', JSON.stringify(z.bad));
  await p.close();
}
await b.close();
