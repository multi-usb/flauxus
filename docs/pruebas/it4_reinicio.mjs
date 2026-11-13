// Iteración 4 · reinicio completo y atrio limpio.
// Comprueba: clave antigua borrada, progreso solo en memoria, sin mementos en el atrio, desbloqueo de la escalera
// siguiente, ?room=N sin herencia, «volver a empezar» del epílogo, apagado al salir y recarga desde bfcache.
import { launch, open, gameReady, shot, sleep, BASE } from './lib.mjs';
const real = (e) => !/favicon|Voz_|404|Failed to load resource/.test(e);
const KEY = 'flauxus.progress.v1';
const res = [];
const ok = (name, cond, extra = '') => { res.push([cond ? 'OK ' : 'FALLA', name, extra]); console.log(cond ? 'OK   ' : 'FALLA', name, extra); };
const estado = (p) => p.evaluate(async (KEY) => {
  const st = await import('/juego/core/state.js'); const R = await import('/juego/engine/renderer.js'); const Pl = await import('/juego/player.js');
  let objs = 0; R.world.traverse(() => objs++);
  return {
    completed: [...st.S.completed], metrics: Object.keys(st.S.metrics).length, phase: st.S.phase, room: st.S.room, next: st.nextRoomId(), ls: localStorage.getItem(KEY),
    worldChildren: R.world.children.length, worldObjs: objs, pipsDone: document.querySelectorAll('#progress .pip.done').length,
    pipNext: document.querySelector('#progress .pip.next')?.dataset.room || null, pos: [Pl.player.x, Pl.player.y, Pl.player.z].map(v => +v.toFixed(2)),
    cam: [R.camera.position.x, R.camera.position.y, R.camera.position.z].map(v => +v.toFixed(1)), btnReset: !!document.getElementById('btnReset'),
  };
}, KEY);
const toBrief = async (p, room) => {
  for (let k = 0; k < 14; k++) {
    const ph = await p.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }, room);
    if (ph === 'brief') return; await sleep(600);
  }
};
const completar = async (p, room) => {
  await toBrief(p, room); await sleep(700);
  await p.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(1500);
  await p.evaluate(async () => (await import('/juego/flow.js')).finish({}, [['Prueba', 'ok']], false)); await sleep(1200);
};
const alAtrio = async (p) => {
  await p.evaluate(async () => (await import('/juego/flow.js')).leaveRoom());
  await p.waitForFunction(() => window.S.room === 0 && !document.getElementById('preloader').classList.contains('on') && !window.S.busy, { timeout: 120000, polling: 250 });
  await sleep(1500);
};
const b = await launch();
try {
  /* ---------- A · móvil 390×844: partida vieja en el navegador → no se hereda ---------- */
  let p = await open(b, '/juego/?raf=timer', { w: 390, h: 844, touch: true });
  await p.evaluate((KEY) => localStorage.setItem(KEY, JSON.stringify({ completed: [1, 2, 3, 4, 5, 6], metrics: { 1: { duration: 9 } } })), KEY);
  await p.reload({ waitUntil: 'domcontentloaded' }); await gameReady(p, 0);
  let e = await estado(p); console.log('menú', JSON.stringify(e));
  ok('A1 clave antigua borrada al cargar', e.ls === null);
  ok('A2 S.completed vacío con partida vieja sembrada', e.completed.length === 0 && e.metrics === 0 && e.pipsDone === 0);
  ok('A3 #btnReset eliminado', !e.btnReset);
  ok('A4 menú visible (fase intro)', e.phase === 'intro');
  await shot(p, 'it4_reinicio_menu_390.jpg');
  await p.evaluate(() => document.getElementById('btnStart').click()); await sleep(2500);
  const base = await estado(p); console.log('atrio inicial', JSON.stringify(base));
  ok('A5 atrio: siguiente sala = 1', base.phase === 'atrium' && base.next === 1 && base.pipNext === '1');
  await shot(p, 'it4_reinicio_atrio_inicial_390.jpg');
  /* completar DO por código y volver */
  await p.evaluate(async () => (await import('/juego/flow.js')).enterRoom(1)); await gameReady(p, 1, 120000);
  await completar(p, 1); await alAtrio(p);
  e = await estado(p); console.log('atrio tras DO', JSON.stringify(e));
  ok('A6 DO completado en memoria y escalera siguiente = 2', e.completed.join() === '1' && e.next === 2 && e.pipNext === '2' && e.pipsDone === 1);
  ok('A7 sin mementos: mismos objetos en el atrio que antes de completar', e.worldChildren === base.worldChildren && e.worldObjs === base.worldObjs, `hijos ${base.worldChildren}→${e.worldChildren} · objetos ${base.worldObjs}→${e.worldObjs}`);
  ok('A8 no se guarda nada al completar', e.ls === null);
  await p.evaluate(async () => { const Pl = await import('/juego/player.js'); Pl.rig.dist = 10; Pl.rig.pitch = .12; Pl.rig.hold = 30; }); await sleep(1500);
  await shot(p, 'it4_reinicio_atrio_trasDO_390_a.jpg');
  await p.evaluate(async () => { const Pl = await import('/juego/player.js'); Pl.rig.yaw += 2.2; Pl.rig.pitch = .25; Pl.rig.hold = 30; }); await sleep(1500);
  await shot(p, 'it4_reinicio_atrio_trasDO_390_b.jpg');
  /* segunda sala, para ver el caso de varias completadas */
  await p.evaluate(async () => (await import('/juego/flow.js')).enterRoom(2)); await gameReady(p, 2, 120000);
  await completar(p, 2); await alAtrio(p);
  e = await estado(p);
  ok('A9 DO+RE: siguiente = 3 y sin objetos nuevos', e.completed.join() === '1,2' && e.next === 3 && e.worldObjs === base.worldObjs, `objetos ${e.worldObjs}`);
  /* recargar */
  await p.reload({ waitUntil: 'domcontentloaded' }); await gameReady(p, 0);
  e = await estado(p); console.log('tras recargar', JSON.stringify(e));
  ok('A10 recarga: S.completed vacío, sin clave, fase intro, siguiente = 1', e.completed.length === 0 && e.ls === null && e.phase === 'intro' && e.next === 1 && e.pipsDone === 0);
  await p.evaluate(() => document.getElementById('btnStart').click()); await sleep(2500);
  e = await estado(p);
  ok('A11 recarga: jugador en la misma posición inicial del atrio', Math.hypot(e.pos[0] - base.pos[0], e.pos[2] - base.pos[2]) < .3 && e.worldObjs === base.worldObjs, `${base.pos} vs ${e.pos}`);
  ok('A   sin errores de consola', p.errors.filter(real).length === 0, JSON.stringify(p.errors.filter(real)));
  await p.close();

  /* ---------- B · acceso directo ?room=5 sin progreso heredado ---------- */
  p = await open(b, '/juego/?raf=timer', { w: 1366, h: 768 });
  await p.evaluate((KEY) => localStorage.setItem(KEY, JSON.stringify({ completed: [1, 2, 3], metrics: {} })), KEY);
  await p.goto(BASE + '/juego/?room=5&raf=timer', { waitUntil: 'domcontentloaded' }); await gameReady(p, 5, 120000);
  e = await estado(p); console.log('?room=5', JSON.stringify(e));
  ok('B1 ?room=5 abre SOL sin progreso heredado', e.room === 5 && e.completed.length === 0 && e.ls === null);
  await shot(p, 'it4_reinicio_room5_1366.jpg');
  ok('B   sin errores de consola', p.errors.filter(real).length === 0, JSON.stringify(p.errors.filter(real)));
  await p.close();

  /* ---------- C · epílogo → «volver a empezar» ---------- */
  p = await open(b, '/juego/?room=6&raf=timer', { w: 390, h: 844, touch: true });
  await gameReady(p, 6, 120000); await completar(p, 6);
  await p.evaluate(async () => (await import('/juego/flow.js')).afterDone()); await sleep(1500);
  e = await estado(p);
  ok('C1 epílogo abierto', e.phase === 'epilogue' && e.completed.join() === '6');
  await shot(p, 'it4_reinicio_epilogo_390.jpg');
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.evaluate(() => document.getElementById('restart').click())]);
  await gameReady(p, 0);
  e = await estado(p); console.log('tras restart', JSON.stringify(e), p.url());
  ok('C2 reinicio: portada, sin ?room, sin progreso', e.phase === 'intro' && e.room === 0 && e.completed.length === 0 && e.metrics === 0 && e.next === 1 && e.ls === null && !/room=/.test(p.url()) && /raf=timer/.test(p.url()), p.url());
  ok('C3 reinicio: epílogo y tarjetas cerrados', await p.evaluate(() => !document.getElementById('epilogue').classList.contains('show') && !document.getElementById('done').classList.contains('show') && getComputedStyle(document.getElementById('btnBack')).display === 'none'));
  await p.evaluate(() => document.getElementById('btnStart').click()); await sleep(2500);
  e = await estado(p);
  ok('C4 reinicio: atrio inicial (misma posición y objetos que una partida nueva)', e.phase === 'atrium' && Math.hypot(e.pos[0] - base.pos[0], e.pos[2] - base.pos[2]) < .3 && e.worldObjs === base.worldObjs && e.pipNext === '1', `${e.pos} · objetos ${e.worldObjs}`);
  await shot(p, 'it4_reinicio_tras_restart_390.jpg');
  ok('C   sin errores de consola', p.errors.filter(real).length === 0, JSON.stringify(p.errors.filter(real)));

  /* ---------- D · apagado en pagehide y recarga desde bfcache ---------- */
  await p.evaluate(async () => { const fl = await import('/juego/flow.js'); fl.enterRoom(3); }); await gameReady(p, 3, 120000);
  await completar(p, 3);
  const antes = await p.evaluate(async () => { const { A } = await import('/juego/AudioSystem.js'); return { stopped: window.__flauxusStopped(), ctx: A.ctx?.state }; });
  await p.evaluate(() => { window.__marca = 1; dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); });
  await sleep(600);
  const tras = await p.evaluate(async () => {
    const { A, Rec } = await import('/juego/AudioSystem.js'); const { VO } = await import('/juego/core/voiceState.js'); const R = await import('/juego/engine/renderer.js');
    const n0 = window.__n = 0; return { stopped: window.__flauxusStopped(), ctx: A.ctx?.state, voces: A.voices.size, nodos: A.nodes.length, vo: VO.active, sonando: [...Rec.el.values()].filter(x => !x.paused).length, glPerdido: R.renderer.getContext().isContextLost(), calls0: R.renderer.info.render.frame };
  });
  await sleep(700);
  const frame2 = await p.evaluate(async () => (await import('/juego/engine/renderer.js')).renderer.info.render.frame);
  console.log('apagado', JSON.stringify(antes), JSON.stringify(tras), 'frame después', frame2);
  ok('D1 pagehide: bucle detenido', antes.stopped === false && tras.stopped === true && frame2 === tras.calls0, `frames ${tras.calls0}→${frame2}`);
  ok('D2 pagehide: audio cerrado, sin voces ni locución', tras.ctx === 'closed' && tras.voces === 0 && tras.nodos === 0 && !tras.vo && tras.sonando === 0, `ctx ${antes.ctx}→${tras.ctx}`);
  ok('D3 pagehide: contexto WebGL liberado', tras.glPerdido === true);
  /* pageshow con persisted → recarga */
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))]);
  await gameReady(p, 0);
  e = await estado(p);
  ok('D4 pageshow(persisted) recarga y deja partida nueva', (await p.evaluate(() => window.__marca)) === undefined && e.completed.length === 0 && e.phase === 'intro');
  /* ida y vuelta real en el historial */
  await p.evaluate(async () => { const st = await import('/juego/core/state.js'); st.S.completed.add(1); window.__marca = 2; });
  await p.goto('about:blank'); await sleep(400);
  await p.goBack({ waitUntil: 'domcontentloaded' }); await sleep(1500);
  await gameReady(p, 0);
  e = await estado(p);
  ok('D5 atrás en el historial: partida nueva (sin página restaurada)', (await p.evaluate(() => window.__marca)) === undefined && e.completed.length === 0 && e.phase === 'intro' && !(await p.evaluate(() => window.__flauxusStopped())));
  await p.close();

  /* ---------- E · embebido: botón «Salir» apaga antes de avisar a la landing ---------- */
  p = await b.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', (x) => errs.push(x.message));
  await p.goto(BASE + '/humans.txt');
  await p.evaluate((url) => { document.body.innerHTML = ''; window.__msgs = []; addEventListener('message', (ev) => window.__msgs.push(ev.data?.type)); const f = document.createElement('iframe'); f.src = url; f.allow = 'autoplay'; f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0'; document.body.append(f); }, BASE + '/juego/?raf=timer');
  const fr = await (await p.waitForSelector('iframe')).contentFrame();
  await fr.waitForFunction(() => window.S && !document.getElementById('preloader').classList.contains('on'), { timeout: 90000, polling: 250 }); await sleep(900);
  await fr.evaluate(() => document.getElementById('btnStart').click()); await sleep(2500);
  const emb = await fr.evaluate(async () => { const { A } = await import('/juego/AudioSystem.js'); const pre = { stopped: window.__flauxusStopped(), ctx: A.ctx?.state, salirVisible: !document.getElementById('btnExit').hidden }; document.getElementById('btnExit').click(); return { pre, stopped: window.__flauxusStopped(), ctx: A.ctx?.state }; });
  await sleep(400);
  const msgs = await p.evaluate(() => window.__msgs);
  console.log('embebido', JSON.stringify(emb), msgs);
  ok('E1 «Salir» embebido: apaga y avisa flauxus:exit', emb.pre.salirVisible && emb.pre.stopped === false && emb.stopped === true && emb.ctx === 'closed' && msgs.includes('flauxus:ready') && msgs.includes('flauxus:exit'), `ctx ${emb.pre.ctx}→${emb.ctx}`);
  /* la landing descarta el iframe y crea otro: partida nueva */
  await p.evaluate((url) => { const f = document.querySelector('iframe'); f.src = 'about:blank'; f.remove(); const g = document.createElement('iframe'); g.src = url; g.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0'; document.body.append(g); }, BASE + '/juego/?raf=timer');
  await sleep(500);
  const fr2 = await (await p.waitForSelector('iframe')).contentFrame();
  await fr2.waitForFunction(() => window.S && !document.getElementById('preloader').classList.contains('on'), { timeout: 90000, polling: 250 });
  const e2 = await fr2.evaluate(async () => { const st = await import('/juego/core/state.js'); return { completed: [...st.S.completed], phase: st.S.phase, stopped: window.__flauxusStopped() }; });
  ok('E2 volver a abrir desde la landing: partida nueva', e2.completed.length === 0 && e2.phase === 'intro' && e2.stopped === false);
  ok('E   sin errores de página', errs.length === 0, JSON.stringify(errs));
} finally { await b.close(); }
const f = res.filter(r => r[0] === 'FALLA');
console.log(`\nRESUMEN: ${res.length - f.length}/${res.length} OK`); if (f.length) { console.log(f); process.exitCode = 1; }
