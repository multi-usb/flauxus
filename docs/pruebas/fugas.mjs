// ¿Se acumulan recursos al navegar? Entra y sale de SOL♯, LA♯ y FA♯ varias veces y compara geometrías, texturas,
// programas, objetos en escena, nodos del DOM y memoria JS entre la 1.ª y la última vuelta. También comprueba que
// el progreso guardado enciende la memoria del atrio y que reiniciar lo apaga.
import { launch, open, gameReady, sleep } from './lib.mjs';
const b = await launch();
const snap = async (p) => p.evaluate(async () => {
  const R = await import('/juego/engine/renderer.js'); let objs = 0; R.scene.traverse(() => objs++);
  const i = R.renderer.info;
  return { geoms: i.memory.geometries, tex: i.memory.textures, progs: i.programs?.length, objs, dom: document.getElementsByTagName('*').length, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
});
try {
  const p = await open(b, '/juego/', { w: 1280, h: 720 });
  await gameReady(p, 0); await p.click('#btnStart'); await sleep(2000);
  console.log('atrio inicial', JSON.stringify(await snap(p)));
  const rows = [];
  for (let lap = 1; lap <= 4; lap++) {
    for (const room of [5, 6, 4]) {
      await p.evaluate(async (room) => (await import('/juego/flow.js')).enterRoom(room), room);
      await gameReady(p, room, 120000); await sleep(1200);
      for (let k = 0; k < 12; k++) { const ph = await p.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }, room); if (ph === 'brief') break; await sleep(600); }
      await sleep(700); await p.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(1500);
      if (lap === 1) await p.evaluate(async () => (await import('/juego/flow.js')).finish({}, [['Prueba', 'ok']], false));
      await sleep(900);
      await p.evaluate(async () => (await import('/juego/flow.js')).leaveRoom());
      await p.waitForFunction(() => window.S.room === 0 && !document.getElementById('preloader').classList.contains('on') && !window.S.busy, { timeout: 120000, polling: 250 });
      await sleep(1500);
    }
    await p.evaluate(() => window.gc && window.gc());
    const s = await snap(p); rows.push(s); console.log('vuelta', lap, JSON.stringify(s));
  }
  const a = rows[0], z = rows[rows.length - 1];
  console.log('diferencia 1→4:', JSON.stringify(Object.fromEntries(Object.keys(a).map(k => [k, z[k] - a[k]]))));
  // progreso guardado y memoria del atrio
  const saved = await p.evaluate(() => localStorage.getItem('flauxus.progress.v1'));
  console.log('guardado:', saved && saved.slice(0, 60));
  await p.reload({ waitUntil: 'domcontentloaded' }); await gameReady(p, 0);
  const afterReload = await p.evaluate(async () => { const st = await import('/juego/core/state.js'); return [...st.S.completed]; });
  console.log('tras recargar, completadas:', afterReload);
  // (iteración 4: core/state.js ya no guarda ni exporta resetProgress; se comprueba que la clave antigua no queda)
  console.log('clave antigua tras recargar:', await p.evaluate(() => localStorage.getItem('flauxus.progress.v1')), 'errores:', p.errors.filter(e => !/favicon|Voz_|404|Failed to load/.test(e)));
} finally { await b.close(); }
