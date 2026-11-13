// Giro en caliente, baliza del atrio y transición atrio→sala. Uso: node it4_cam_giro.mjs
import { launch, sleep, BASE, SHOTS } from './lib.mjs';
import path from 'node:path';
const browser = await launch(); const errs = [];
const st = (page) => page.evaluate(async () => { const Pl = await import('/juego/player.js'); const { camera } = await import('/juego/engine/renderer.js'); const { avatarObj } = await import('/juego/engine/avatar.js'); const THREE = await import('three'); camera.updateMatrixWorld(); const p = avatarObj.position, hh = 1.72 * avatarObj.scale.y; const a = new THREE.Vector3(p.x, p.y, p.z).project(camera), b = new THREE.Vector3(p.x, p.y + hh, p.z).project(camera); const f = Pl.frameDebug(); const c = document.getElementById('compass'), l = document.getElementById('cmpLabel'), ri = document.getElementById('roomInfo'); const rr = e => { if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round) }; return { fase: window.S.phase, W: innerWidth, H: innerHeight, asp: +camera.aspect.toFixed(3), fovV: f.fov, fovH: +(2 * Math.atan(Math.tan(f.fov * Math.PI / 360) * camera.aspect) * 180 / Math.PI).toFixed(1), camK: f.camK, cabeza: Math.round((-b.y * .5 + .5) * innerHeight), pies: Math.round((-a.y * .5 + .5) * innerHeight), x: Math.round((a.x * .5 + .5) * innerWidth), banda: [Math.round(f.top), Math.round(f.bot)], lbl: c.style.display !== 'none' ? rr(l) : null, info: rr(ri) } });
const ready = (page, room) => page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true) }, { timeout: 120000, polling: 200 }, room);
// 1) giro en caliente en LA♯ preludio y en el atrio
for (const room of [6, 0]) {
  const page = await browser.newPage(); page.on('pageerror', e => errs.push(e.message)); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/juego/?${room ? 'room=' + room + '&' : ''}debug&input=touch`, { waitUntil: 'domcontentloaded' }); await ready(page, room); await sleep(800);
  if (!room) { await page.evaluate(() => document.getElementById('btnStart').click()); await sleep(3000) } else await sleep(2500);
  console.log(`r${room} vertical  `, JSON.stringify(await st(page)));
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(2500);
  console.log(`r${room} → horizontal`, JSON.stringify(await st(page))); await page.screenshot({ path: path.join(SHOTS, `it4_cam_giro_r${room}_a_844x390.jpg`), type: 'jpeg', quality: 78 });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(2500);
  console.log(`r${room} → vertical  `, JSON.stringify(await st(page))); await page.screenshot({ path: path.join(SHOTS, `it4_cam_giro_r${room}_b_390x844.jpg`), type: 'jpeg', quality: 78 });
  if (!room) {
    // 2) baliza: caminar hacia la escalera de DO y vigilar que el rótulo no pise la ficha ni el HUD
    await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(800);
    await page.evaluate(() => window.walkNext()); let pisa = 0, n = 0, fases = [];
    for (let i = 0; i < 40; i++) { await sleep(250); const s = await st(page); if (s.fase !== 'atrium') { fases.push(`${i}:${s.fase} camK ${s.camK} cabeza ${s.cabeza} pies ${s.pies}`); if (fases.length > 10) break; continue } n++; if (s.lbl && s.lbl[1] < s.banda[0]) { pisa++; console.log('  rótulo bajo el HUD', JSON.stringify(s.lbl), s.banda) } if (i === 7) await page.screenshot({ path: path.join(SHOTS, 'it4_cam_giro_baliza_360x640.jpg'), type: 'jpeg', quality: 78 }) }
    console.log(`baliza: ${n} muestras caminando, rótulo sobre el HUD en ${pisa}`); console.log('transición atrio→sala:\n  ' + fases.join('\n  '));
    await page.screenshot({ path: path.join(SHOTS, 'it4_cam_giro_entrada_360x640.jpg'), type: 'jpeg', quality: 78 });
  }
  await page.close();
}
console.log('errores de página:', JSON.stringify(errs)); await browser.close();
