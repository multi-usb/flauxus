// SOL (room=5): rendimiento en preludio (quieta / caminando) y juego, con CPU limitada. Uso:
//   BASE=http://localhost:5199 node it4_sol_perf.mjs <etiqueta> [w h touch cpu]...
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, DIR, BASE } from './lib.mjs';
const label = process.argv[2] || 'x';
const CASES = (process.argv[3] || '390x844x1x4,390x844x1x6,360x640x1x6,844x390x1x4,1366x768x0x4').split(',').map(s => s.split('x').map(Number));
const SECS = +(process.env.SECS || 8);

const measure = (secs) => new Promise((res) => {
  const ft = []; let last = performance.now(); const t0 = last;
  const f = (t) => { ft.push(t - last); last = t; (t - t0 < secs * 1000) ? requestAnimationFrame(f) : done(); };
  const done = () => { ft.shift(); const n = ft.length, sum = ft.reduce((a, b) => a + b, 0); const jank = ft.filter(x => x > 50).length; ft.sort((a, b) => a - b); const r = (x) => +x.toFixed(1); res({ fps: r(1000 * n / sum), p50: r(ft[n >> 1]), p95: r(ft[Math.floor(n * .95)]), p99: r(ft[Math.floor(n * .99)]), max: r(ft[n - 1]), 'n>50ms': jank }); };
  requestAnimationFrame(f);
});
const info = async () => { const R = await import('/juego/engine/renderer.js'); const i = R.renderer.info; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); let lights = 0; R.scene.traverseVisible(o => { if (o.isLight && o.intensity > 0) lights++; }); return { calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures, progs: i.programs?.length, luces: lights, pr: +R.renderer.getPixelRatio().toFixed(2), buf: R.renderer.domElement.width + 'x' + R.renderer.domElement.height, holo: window.__FLX?.cur?.dbg?.() ?? null, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; };
const toPlay = async (page) => {
  for (let k = 0; k < 14; k++) { const ph = await page.evaluate(async () => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; Pl.player.set(0, Pl.player.y, 0); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }); if (ph === 'brief') break; await sleep(600); }
  await sleep(900); await page.evaluate(async () => (await import('/juego/flow.js')).startRoom());
};

const browser = await launch();
const res = [];
for (const [w, h, touch, cpu] of CASES) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: touch ? 2 : 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await page.goto(`${BASE}/juego/?room=5&perf&debug${touch ? '&input=touch' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && window.S.room === 5 && window.S.ready; }, { timeout: 120000, polling: 100 });
  const c = await page.createCDPSession(); if (cpu > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const out = { label, w, h, touch, cpu };
  await sleep(6000);
  out.preludio_quieta = { ...(await page.evaluate(measure, SECS)), ...(await page.evaluate(info)) };
  // caminando (= tocando la flauta): tecla W mantenida en escritorio; en táctil, ruta automática de ida y vuelta
  await page.evaluate(async () => { const Pl = await import('/juego/player.js'); window.__walk = setInterval(() => { const far = Math.hypot(Pl.player.x, Pl.player.z - 4) < 1.2; if (!window.__leg || far !== window.__far) { window.__far = far; window.__leg = 1; } Pl.walkTo ? 0 : 0; }, 500); });
  await page.keyboard.down('KeyA'); await sleep(1200);
  out.preludio_caminando = { ...(await page.evaluate(measure, Math.min(SECS, 6))), ...(await page.evaluate(info)) };
  await page.keyboard.up('KeyA'); await page.evaluate(() => clearInterval(window.__walk));
  out.modo_caminando = await page.evaluate(async () => (await import('/juego/engine/avatar.js')).avatarObj.userData.mode);
  await toPlay(page); await sleep(5000);
  out.juego = { ...(await page.evaluate(measure, SECS)), ...(await page.evaluate(info)) };
  out.fase = await page.evaluate(() => window.S.phase); out.errs = errs;
  console.log(JSON.stringify(out)); res.push(out);
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(DIR, `it4_sol_perf_${label}.json`), JSON.stringify(res, null, 1));
