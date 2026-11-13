// Cámara: (a) sprint en el atrio de escritorio (el brazo no se acorta), (b) campo de visión al descubrir una sala en vertical,
// (c) giro del teléfono en preludio y juego. Uso: node it4_fix_cam.mjs
import { launch, open, sleep, gameReady } from './lib.mjs';
const browser = await launch();
const cam = (page) => page.evaluate(async () => { const Pl = await import('/juego/player.js'); const { camera } = await import('/juego/engine/renderer.js'); const { avatarObj } = await import('/juego/engine/avatar.js'); const p = avatarObj.position; return { fov: +camera.fov.toFixed(2), dist: +Math.hypot(camera.position.x - p.x, camera.position.z - p.z).toFixed(3), ...Pl.frameDebug() } });
const real = e => !/favicon/.test(e);

// (a) sprint
{
  const page = await open(browser, '/juego/?debug', { w: 1366, h: 768 });
  await gameReady(page, 0); await page.evaluate(() => document.getElementById('btnStart').click()); await sleep(3000);
  const run = async (shift) => page.evaluate(async (shift) => {
    const Pl = await import('/juego/player.js'); const { keys } = await import('/juego/core/inputState.js'); const { camera } = await import('/juego/engine/renderer.js'); const { avatarObj } = await import('/juego/engine/avatar.js');
    Pl.stopAuto(); keys.add('KeyW'); if (shift) keys.add('ShiftLeft'); const out = [];
    for (let k = 0; k < 14; k++) { await new Promise(r => setTimeout(r, 100)); const p = avatarObj.position; out.push([+camera.fov.toFixed(1), +Math.hypot(camera.position.x - p.x, camera.position.z - p.z).toFixed(2), +Math.hypot(Pl.vel.x, Pl.vel.z).toFixed(1)]) }
    keys.delete('KeyW'); keys.delete('ShiftLeft'); await new Promise(r => setTimeout(r, 900)); return out;
  }, shift);
  const a = await run(false), b = await run(true);
  console.log('(a) caminar  [fov, brazo, vel] fin:', JSON.stringify(a[a.length - 1]), '· brazo min/max', Math.min(...a.map(r => r[1])), Math.max(...a.map(r => r[1])));
  console.log('(a) sprint   [fov, brazo, vel] fin:', JSON.stringify(b[b.length - 1]), '· brazo min/max', Math.min(...b.map(r => r[1])), Math.max(...b.map(r => r[1])), '· fov máx', Math.max(...b.map(r => r[0])));
  console.log('    errores:', JSON.stringify(page.errors.filter(real))); await page.close();
}
// (b) campo al descubrir la sala (vertical): se muestrea desde antes de que caiga el preloader
for (const [w, h] of [[390, 844], [360, 640]]) {
  const page = await open(browser, '/juego/?room=3&debug&input=touch', { w, h, touch: true });
  await page.waitForFunction(() => window.S && window.S.room === 3, { timeout: 120000, polling: 100 });
  const log = await page.evaluate(async () => {
    const { camera } = await import('/juego/engine/renderer.js'); const Pl = await import('/juego/player.js'); const pre = document.getElementById('preloader'); const out = []; let seen = 0;
    for (let k = 0; k < 400 && seen < 12; k++) { await new Promise(r => setTimeout(r, 50)); const on = pre.classList.contains('on'), op = +getComputedStyle(pre).opacity; if (window.S.ready || !on) { seen++; out.push([+camera.fov.toFixed(2), Pl.frameDebug().fovK, +op.toFixed(2)]) } }
    return { esperado: +Pl.viewFov().toFixed(2), muestras: out };
  });
  console.log(`(b) ${w}x${h} campo esperado ${log.esperado} · [fov, fovK, opacidad del preloader]:`, JSON.stringify(log.muestras.slice(0, 6)), '· distintos del esperado:', log.muestras.filter(m => Math.abs(m[0] - log.esperado) > .05).length);
  await page.close();
}
// (c) giro en preludio y en juego (SOL y LA♯)
for (const room of [5, 6]) {
  const page = await open(browser, `/juego/?room=${room}&debug&input=touch`, { w: 390, h: 844, touch: true });
  await gameReady(page, room); await sleep(2500);
  const s0 = await cam(page);
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(2500); const s1 = await cam(page);
  for (let k = 0; k < 14; k++) { const ph = await page.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase }, room); if (ph === 'brief') break; await sleep(600) }
  await sleep(800); await page.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(4000); const s2 = await cam(page);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(4000); const s3 = await cam(page);
  await page.screenshot({ path: `shots/it4_fix_giro_r${room}_390x844_juego.jpg`, type: 'jpeg', quality: 78 });
  const f = s => `fov ${s.fov} fovK ${s.fovK} franja ${Math.round(s.top)}–${Math.round(s.bot)} shift ${s.shift} kz ${s.kz} fk ${s.fk}`;
  console.log(`(c) r${room} preludio vertical:   ${f(s0)}\n    r${room} preludio horizontal: ${f(s1)}\n    r${room} juego horizontal:    ${f(s2)}\n    r${room} juego vertical:      ${f(s3)}\n    errores: ${JSON.stringify(page.errors.filter(real))}`);
  await page.close();
}
await browser.close();
