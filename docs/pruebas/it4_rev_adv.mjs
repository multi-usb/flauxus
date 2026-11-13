// Revisión adversarial (solo lectura del proyecto): encuadre en escritorio y separación de sensores de SOL.
// Uso: node it4_rev_adv.mjs
import { launch, sleep, BASE } from './lib.mjs';
const browser = await launch(); const errs = [];
const ready = (page, room) => page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true) }, { timeout: 120000, polling: 200 }, room);
const fd = (page) => page.evaluate(async () => { const Pl = await import('/juego/player.js'); const { camera } = await import('/juego/engine/renderer.js'); const { avatarObj } = await import('/juego/engine/avatar.js'); const THREE = await import('three'); camera.updateMatrixWorld(); const p = avatarObj.position, hh = 1.78 * avatarObj.scale.y; const a = new THREE.Vector3(p.x, p.y, p.z).project(camera), b = new THREE.Vector3(p.x, p.y + hh, p.z).project(camera); return { fase: window.S.phase, ...Pl.frameDebug(), pies: Math.round((-a.y * .5 + .5) * innerHeight), cabeza: Math.round((-b.y * .5 + .5) * innerHeight), vis: avatarObj.visible } });
const toPlay = async (page, room) => {
  for (let k = 0; k < 14; k++) { const ph = await page.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase }, room); if (ph === 'brief') break; await sleep(600) }
  await sleep(800); await page.evaluate(async () => (await import('/juego/flow.js')).startRoom());
};
// A) escritorio 1366×768 sin táctil
for (const room of [0, 1, 2, 3, 4, 5, 6]) {
  const page = await browser.newPage(); page.on('pageerror', e => errs.push(room + ': ' + e.message)); await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/juego/?${room ? 'room=' + room + '&' : ''}debug`, { waitUntil: 'domcontentloaded' }); await ready(page, room); await sleep(800);
  if (!room) { await page.evaluate(() => document.getElementById('btnStart').click()); await sleep(3500); console.log('D r0 atrio  ', JSON.stringify(await fd(page))); await page.evaluate(() => window.walkNext()); await sleep(2500); console.log('D r0 andando', JSON.stringify(await fd(page))) }
  else { await sleep(3000); console.log(`D r${room} prelude`, JSON.stringify(await fd(page))); await toPlay(page, room); await sleep(5000); console.log(`D r${room} juego  `, JSON.stringify(await fd(page))) }
  await page.close();
}
// B) SOL: distancia mínima entre sensores frente al radio táctil
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [667, 375], [844, 390]]) {
  const page = await browser.newPage(); page.on('pageerror', e => errs.push('sol: ' + e.message)); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/juego/?room=5&debug&input=touch`, { waitUntil: 'domcontentloaded' }); await ready(page, 5); await sleep(2500); await toPlay(page, 5); await sleep(2000);
  let min = 1e9, hitR = 0, n = 0, bad = 0, last = null;
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => window.__FLX.cur.dbg()); hitR = d.hitR; const o = d.orbs; for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { const dd = Math.hypot(o[a].x - o[b].x, o[a].y - o[b].y); if (dd < min) { min = dd; last = o.map(q => [q.x, q.y]) } if (dd < 2 * hitR) bad++ } n++; await sleep(150) }
  console.log(`SOL ${w}x${h}: hitR ${hitR}, distancia mínima ${min.toFixed(0)} px (2·hitR = ${2 * hitR}), pares solapados ${bad}/${n * 3}`, JSON.stringify(last));
  await page.close();
}
console.log('errores:', JSON.stringify(errs)); await browser.close();
