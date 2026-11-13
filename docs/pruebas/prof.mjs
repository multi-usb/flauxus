// Perfil de CPU (muestreo) de una sala en juego: funciones con más tiempo propio.
import { launch, sleep } from './lib.mjs';
const room = +(process.argv[2] || 5), port = process.argv[3] || 5173, state = process.argv[4] || 'juego';
const b = await launch(); const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
await p.goto(`http://localhost:${port}/juego/?room=${room}`);
await p.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && window.S.room === room && window.S.ready; }, { timeout: 120000 }, room);
await sleep(2000);
if (state === 'juego') {
  for (let k = 0; k < 12; k++) { const ph = await p.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }, room); if (ph === 'brief') break; await sleep(600); }
  await sleep(800); await p.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(3000);
}
const c = await p.createCDPSession(); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 200 }); await c.send('Profiler.start');
await sleep(5000);
const { profile } = await c.send('Profiler.stop');
const self = new Map(); const dt = profile.timeDeltas, ids = profile.samples; const byId = new Map(profile.nodes.map(n => [n.id, n]));
let total = 0; ids.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ' @' + n.callFrame.url.split('/').slice(-2).join('/') + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + dt[i]); total += dt[i]; });
const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22);
console.log(`sala ${room} · ${state} · puerto ${port} · total ${(total / 1000).toFixed(0)} ms`);
for (const [k, v] of rows) console.log((v / total * 100).toFixed(1).padStart(5) + '%  ' + (v / 1000).toFixed(0).padStart(5) + ' ms  ' + k);
await b.close();
