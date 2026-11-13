// Rendimiento antes/después: misma máquina, mismo Chrome, misma resolución. 5174 = antes · 5173 = después.
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, DIR } from './lib.mjs';

const W = +(process.argv[2] || 1920), H = +(process.argv[3] || 1080), DPR = +(process.argv[4] || 1.5);
const ROOMS = (process.argv[5] || '0,4,5,6').split(',').map(Number);
const VERS = (process.argv[6] || 'antes,despues').split(',');
const PORT = { antes: 5174, despues: 5173 };

const measure = (secs) => new Promise((res) => {
  const ft = []; let last = performance.now(); const t0 = last;
  const f = (t) => { ft.push(t - last); last = t; (t - t0 < secs * 1000) ? requestAnimationFrame(f) : done(); };
  const done = () => { ft.shift(); ft.sort((a, b) => a - b); const sum = ft.reduce((a, b) => a + b, 0); res({ fps: +(1000 * ft.length / sum).toFixed(1), ms50: +ft[ft.length >> 1].toFixed(1), ms95: +ft[Math.floor(ft.length * .95)].toFixed(1), ms99: +ft[Math.floor(ft.length * .99)].toFixed(1), max: +ft[ft.length - 1].toFixed(1) }); };
  requestAnimationFrame(f);
});
const info = async () => { const R = await import('/juego/engine/renderer.js'); const i = R.renderer.info; return { calls: i.render.calls, tris: Math.round(i.render.triangles / 1000) + 'k', geoms: i.memory.geometries, tex: i.memory.textures, progs: i.programs?.length, pr: +R.renderer.getPixelRatio().toFixed(2), buf: R.renderer.domElement.width + 'x' + R.renderer.domElement.height }; };

async function one(browser, ver, room) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT[ver]}/juego/${room ? '?room=' + room : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true); }, { timeout: 120000, polling: 100 }, room);
  const ready = Date.now() - t0;
  const out = { ver, room, readyMs: ready };
  const TH = +(process.env.CPU || 1); if (TH > 1) { const c = await page.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: TH }); }
  await sleep(5000); // deja que la resolución adaptativa se asiente
  if (!room) { await page.evaluate(() => document.getElementById('btnStart').click()); await sleep(3000); out.atrio = { ...(await page.evaluate(measure, 6)), ...(await page.evaluate(info)) }; }
  else {
    out.preludio = { ...(await page.evaluate(measure, 6)), ...(await page.evaluate(info)) };
    for (let k = 0; k < 12; k++) { const ph = await page.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }, room); if (ph === 'brief') break; await sleep(600); }
    await sleep(900); await page.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(5000);
    out.juego = { ...(await page.evaluate(measure, 6)), ...(await page.evaluate(info)) };
  }
  out.heapMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  await page.close();
  return out;
}

const browser = await launch();
const res = [];
for (const room of ROOMS) for (const ver of VERS) { const r = await one(browser, ver, room); res.push(r); console.log(JSON.stringify(r)); }
await browser.close();
fs.writeFileSync(path.join(DIR, `perf_${W}x${H}@${DPR}_cpu${process.env.CPU || 1}.json`), JSON.stringify(res, null, 1));
