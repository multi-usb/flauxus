// Capturas de los escenarios intervenidos + errores de consola.
import { launch, open, gameReady, shot, sleep } from './lib.mjs';
const real = (e) => !/favicon|Voz_|404|Failed to load resource/.test(e);
const toBrief = (p, room) => p.evaluate(async (room) => {
  const base = '/juego/'; const V = await import(base + 'ui/voice.js'); const Pl = await import(base + 'player.js'); const Rm = await import(base + 'Rooms.js');
  V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z);
  await new Promise(r => setTimeout(r, 400)); (await import(base + 'ui/prelude.js')).enterZone();
}, room);
const start = (p) => p.evaluate(async () => (await import('/juego/flow.js')).startRoom());
const b = await launch();
const which = process.argv[2] || 'all';
try {
  if (which === 'all' || which === 'la') {
    const p = await open(b, '/juego/?room=6&perf', { w: 1280, h: 720 });
    await gameReady(p, 6); await sleep(3500); await shot(p, 'la_preludio.jpg');
    await toBrief(p, 6); await sleep(1300); await start(p); await sleep(2500); await shot(p, 'la_formando.jpg');
    await sleep(6000); await shot(p, 'la_formada.jpg');
    console.log('LA', await p.evaluate(() => document.querySelector('pre')?.textContent.replace(/\n/g, ' | ')), p.errors.filter(real));
    await p.close();
  }
  if (which === 'all' || which === 'fa') {
    const p = await open(b, '/juego/?room=4&perf', { w: 1280, h: 720 });
    await gameReady(p, 4); await sleep(1500); await toBrief(p, 4); await sleep(1300); await start(p); await sleep(800);
    for (const [k, ms] of [['KeyA', 1500], ['KeyW', 1100], ['KeyD', 1700], ['KeyS', 700]]) { await p.keyboard.down(k); await sleep(ms); await p.keyboard.up(k); }
    await shot(p, 'fa_cinta.jpg');
    console.log('FA', await p.evaluate(() => document.querySelector('pre')?.textContent.replace(/\n/g, ' | ')), p.errors.filter(real));
    await p.close();
  }
  if (which === 'all' || which === 'atrio') {
    // iteración 4: se siembra una partida vieja; el juego debe ignorarla, borrar la clave y mostrar el atrio limpio (sin objetos de memoria)
    const p = await open(b, '/juego/?perf', { w: 1280, h: 720 });
    await p.evaluate(() => localStorage.setItem('flauxus.progress.v1', JSON.stringify({ completed: [1, 2, 3, 4, 5, 6], metrics: {} })));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await gameReady(p, 0); await sleep(1200); await shot(p, 'atrio_menu_sin_progreso.jpg');
    await p.click('#btnStart'); await sleep(2500);
    await p.evaluate(async () => { const Pl = await import('/juego/player.js'); Pl.rig.dist = 10; Pl.rig.pitch = .12; Pl.rig.hold = 30; });
    await sleep(1500); await shot(p, 'atrio_limpio_a.jpg');
    await p.evaluate(async () => { const Pl = await import('/juego/player.js'); Pl.rig.yaw += 2.2; Pl.rig.pitch = .25; Pl.rig.hold = 30; });
    await sleep(1500); await shot(p, 'atrio_limpio_b.jpg');
    console.log('ATRIO', await p.evaluate(() => document.querySelector('pre')?.textContent.replace(/\n/g, ' | ')), p.errors.filter(real));
    console.log('ATRIO clave antigua', await p.evaluate(() => localStorage.getItem('flauxus.progress.v1')), 'completadas', await p.evaluate(() => [...window.S.completed]));
    await p.close();
  }
} finally { await b.close(); }
