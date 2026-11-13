// SOL: entrar y salir de la sala varias veces; geometrías, texturas, programas y heap no deben crecer de ciclo en ciclo.
import { launch, sleep, BASE } from './lib.mjs';
const touch = +(process.argv[2] ?? 1), N = +(process.argv[3] || 5);
const b = await launch(); const p = await b.newPage(); await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1366, height: 768 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/juego/?debug${touch ? '&input=touch' : ''}`);
await p.waitForFunction(() => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on'); }, { timeout: 120000 });
await sleep(1000); await p.evaluate(() => document.getElementById('btnStart').click()); await sleep(2500);
const c = await p.createCDPSession(); await c.send('HeapProfiler.enable');
const mem = async (tag) => { await c.send('HeapProfiler.collectGarbage'); return p.evaluate(async (tag) => { const R = await import('/juego/engine/renderer.js'); const i = R.renderer.info; let objs = 0; R.scene.traverse(() => objs++); return { tag, geoms: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length, objs, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) }; }, tag); };
const rows = [await mem('atrio 0')];
for (let k = 1; k <= N; k++) {
  await p.evaluate(() => window.__FLX.enterRoom(5));
  await p.waitForFunction(() => window.S.room === 5 && window.S.ready && window.S.phase === 'prelude', { timeout: 60000 }); await sleep(2500);
  rows.push(await mem('SOL ' + k));
  await p.evaluate(async () => (await import('/juego/flow.js')).leaveRoom());
  await p.waitForFunction(() => window.S.room === 0 && window.S.phase === 'atrium', { timeout: 60000 }); await sleep(2000);
  rows.push(await mem('atrio ' + k));
}
for (const r of rows) console.log(JSON.stringify(r));
const sol = rows.filter(r => r.tag.startsWith('SOL')), at = rows.filter(r => r.tag.startsWith('atrio'));
const stable = (a, k) => a[a.length - 1][k] - a[1][k];
console.log('crecimiento del 2.º al último ciclo · SOL:', JSON.stringify({ geoms: stable(sol, 'geoms'), tex: stable(sol, 'tex'), progs: stable(sol, 'progs'), objs: stable(sol, 'objs'), heapMB: +stable(sol, 'heapMB').toFixed(1) }), '· atrio:', JSON.stringify({ geoms: stable(at, 'geoms'), tex: stable(at, 'tex'), progs: stable(at, 'progs'), objs: stable(at, 'objs'), heapMB: +stable(at, 'heapMB').toFixed(1) }), errs);
await b.close();
