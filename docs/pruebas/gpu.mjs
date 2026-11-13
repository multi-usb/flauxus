// Coste de GPU por cuadro, sin el tope de la pantalla: se dibuja la escena N veces seguidas y se fuerza a la GPU a
// terminar (readPixels) antes de parar el reloj. 5174 = antes · 5173 = después. Mismo tamaño de búfer en ambos.
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, DIR } from './lib.mjs';
const W = +(process.argv[2] || 1707), H = +(process.argv[3] || 960), DPR = +(process.argv[4] || 1.5);
const PORT = { antes: 5174, despues: 5173 };

const bench = async (opts = {}) => {
  const R = await import('/juego/engine/renderer.js');
  const gl = R.renderer.getContext(), px = new Uint8Array(4);
  const hide = (opts.hide || []);
  const restore = [];
  // ocultar por nombre de constructor/propiedades conocidas (solo para atribuir costes)
  R.roomGroup.traverse((o) => { for (const h of hide) { if ((h === 'holo' && o.isMesh && o.material?.uniforms?.uMap) || (h === 'holo' && o.isMesh && o.material?.uniforms?.uA && !o.material.uniforms.uMap && o.material.uniforms.uGain) || (h === 'sky' && (o.isPoints || (o.isMesh && o.geometry?.type === 'SphereGeometry' && o.material?.side === 1)))) { if (o.visible) { o.visible = false; restore.push(o); } } } });
  const sh = R.renderer.shadowMap.enabled; if (opts.noShadow) { R.renderer.shadowMap.enabled = false; }
  const bloomOn = R.bloom ? R.bloom.enabled : null; if (opts.noBloom && R.bloom) R.bloom.enabled = false;
  const N = 40, run = () => { const t0 = performance.now(); for (let i = 0; i < N; i++) { R.composer ? R.composer.render(0.016) : R.renderer.render(R.scene, R.camera); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / N; };
  run(); const a = [run(), run(), run()].sort((x, y) => x - y);
  for (const o of restore) o.visible = true; R.renderer.shadowMap.enabled = sh; if (R.bloom && bloomOn !== null) R.bloom.enabled = bloomOn;
  R.renderer.info.autoReset = false; R.renderer.info.reset(); R.composer ? R.composer.render(0.016) : R.renderer.render(R.scene, R.camera);
  const i = R.renderer.info, out = { ms: +a[1].toFixed(2), calls: i.render.calls, tris: Math.round(i.render.triangles / 1000), buf: R.renderer.domElement.width + 'x' + R.renderer.domElement.height };
  R.renderer.info.autoReset = true; return out;
};

async function scene(browser, ver, room, state) {
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
  await page.goto(`http://localhost:${PORT[ver]}/juego/${room ? '?room=' + room : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true); }, { timeout: 120000, polling: 100 }, room);
  await sleep(2500);
  if (!room) { await page.evaluate(() => document.getElementById('btnStart').click()); await sleep(2500); }
  else if (state === 'juego') {
    for (let k = 0; k < 12; k++) { const ph = await page.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }, room); if (ph === 'brief') break; await sleep(600); }
    await sleep(800); await page.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(3500);
  }
  // misma resolución de render en ambas versiones (sin la adaptativa)
  await page.evaluate(async (dpr) => { const R = await import('/juego/engine/renderer.js'); R.renderer.setPixelRatio(dpr); R.composer?.setPixelRatio(dpr); R.renderer.setSize(innerWidth, innerHeight); R.composer?.setSize(innerWidth, innerHeight); }, DPR);
  await sleep(400);
  const base = await page.evaluate(bench, {});
  const out = { ver, room, state, ...base };
  if (ver === 'despues' && room === 5) {
    out.sinHolograma = (await page.evaluate(bench, { hide: ['holo'] })).ms;
    out.sinGalaxia = (await page.evaluate(bench, { hide: ['sky'] })).ms;
    out.sinAmbos = (await page.evaluate(bench, { hide: ['holo', 'sky'] })).ms;
  }
  if (room === 5) { out.sinSombras = (await page.evaluate(bench, { noShadow: true })).ms; out.sinBloom = (await page.evaluate(bench, { noBloom: true })).ms; }
  await page.close(); return out;
}

const browser = await launch(); const res = [];
for (const [room, state] of [[0, 'atrio'], [4, 'juego'], [5, 'preludio'], [5, 'juego'], [6, 'preludio'], [6, 'juego'], [1, 'juego']]) for (const ver of ['antes', 'despues']) { const r = await scene(browser, ver, room, state); res.push(r); console.log(JSON.stringify(r)); }
await browser.close();
fs.writeFileSync(path.join(DIR, `gpu_${W}x${H}@${DPR}.json`), JSON.stringify(res, null, 1));
