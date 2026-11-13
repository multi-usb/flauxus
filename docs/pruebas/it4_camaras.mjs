// Auditoría de cámaras: atrio + 6 salas × preludio/juego × tamaños móviles. Capturas, métricas de encuadre y hojas de contacto.
// Uso: node it4_camaras.mjs <etiqueta> [salas "0,1,..."] [tamaños "360x640x1,..."]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, BASE, SHOTS, DIR } from './lib.mjs';
const label = process.argv[2] || 'antes';
const ROOMS = (process.argv[3] || '0,1,2,3,4,5,6').split(',').map(Number);
const SIZES = (process.argv[4] || '360x640x1,390x844x1,412x915x1,667x375x1,844x390x1').split(',').map(s => s.split('x').map(Number));
const browser = await launch(); const data = [];

// métricas del encuadre: cámara, caja de la avatar en pantalla y piezas de interfaz que la pisan
const metric = (page) => page.evaluate(async () => {
  const b = '/juego/'; const THREE = await import('three'); const { avatarObj } = await import(b + 'engine/avatar.js'); const { camera } = await import(b + 'engine/renderer.js');
  const W = innerWidth, H = innerHeight; camera.updateMatrixWorld();
  const s = avatarObj.scale.x, p = avatarObj.position, hh = 1.72 * s, hw = .34 * s; let l = 1e9, r = -1e9, t = 1e9, bt = -1e9, behind = false;
  for (const dx of [-hw, hw]) for (const dy of [0, hh]) for (const dz of [-hw, hw]) { const v = new THREE.Vector3(p.x + dx, p.y + dy, p.z + dz).project(camera); if (v.z > 1) behind = true; const x = (v.x * .5 + .5) * W, y = (-v.y * .5 + .5) * H; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); bt = Math.max(bt, y) }
  const box = [l, t, r, bt].map(Math.round), hit = [], small = [];
  const vis = e => { if (!e) return false; let q = e; while (q && q !== document.documentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < .05) return false; q = q.parentElement } const rc = e.getBoundingClientRect(); return rc.width > 2 && rc.height > 2 };
  for (const q of ['#btnExit', '#hud .brandwrap', '#progress', '#objective', '#hud .rightTop', '#btnBack', '#roomInfo', '#joy', '#roomHint', '#vo', '#coach', '#prompt', '#btnVoSkip', '#btnSkip', '#btnLook', '#btnWalk', '#sourceChip', '#miBtns', '#laUI', '#laFrame', '#tray', '#laBtns', '#handWrap', '#unlock']) { const e = document.querySelector(q); if (!vis(e)) continue; const rc = e.getBoundingClientRect(); const ix = Math.min(rc.right, r) - Math.max(rc.left, l), iy = Math.min(rc.bottom, bt) - Math.max(rc.top, t); if (ix > 2 && iy > 2) hit.push(`${q} ${Math.round(100 * ix * iy / Math.max(1, (r - l) * (bt - t)))}%`) }
  for (const e of document.querySelectorAll('button,a,[role=button],#joy,.ptab')) { if (!vis(e)) continue; const rc = e.getBoundingClientRect(); if (rc.width < 43.5 || rc.height < 43.5) small.push(`${e.id || e.className || e.tagName}:${Math.round(rc.width)}x${Math.round(rc.height)}`) }
  const vf = camera.fov, hf = 2 * Math.atan(Math.tan(vf * Math.PI / 360) * camera.aspect) * 180 / Math.PI;
  const { GX } = await import(b + 'GameContext.js'); const Pl = await import(b + 'player.js'); const fr = Pl.frameDebug ? Pl.frameDebug() : null;
  return { fase: window.S.phase, cam: camera.position.toArray().map(v => +v.toFixed(2)), fovV: +vf.toFixed(1), fovH: +hf.toFixed(1), dist: +camera.position.distanceTo(new THREE.Vector3(p.x, p.y + hh / 2, p.z)).toFixed(2), esc: s, caja: box, altoPct: Math.round(100 * (bt - t) / H), fuera: behind || l < 0 || r > W || t < 0 || bt > H, pisa: hit, chicos: small, uiTop: Math.round(GX.uiTop || 0), fr };
});

for (const [w, h, touch] of SIZES) for (const room of ROOMS) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const T = `${w}x${h}`, name = (st) => `it4_cam_${label}_r${room}_${T}_${st}.jpg`;
  const take = async (st) => { await page.screenshot({ path: path.join(SHOTS, name(st)), type: 'jpeg', quality: 78 }); const m = await metric(page); data.push({ room, T, st, ...m }); console.log(`r${room} ${T} ${st} ${JSON.stringify(m)}`) };
  try {
    await page.goto(`${BASE}/juego/?${room ? 'room=' + room + '&' : ''}debug${touch ? '&input=touch' : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true) }, { timeout: 120000, polling: 200 }, room);
    await sleep(1000);
    if (!room) {
      await page.evaluate(() => document.getElementById('btnStart').click()); await sleep(3200); await take('pre');
      await page.evaluate(() => window.walkNext()); await sleep(2000); await take('juego'); // «juego» del atrio = caminando hacia la escalera de DO
    } else {
      await sleep(3000); await take('pre');
      for (let k = 0; k < 14; k++) { const ph = await page.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase }, room); if (ph === 'brief') break; await sleep(600) }
      await sleep(800); await page.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(4200); await take('juego');
    }
  } catch (e) { console.log(`r${room} ${T} ERROR ${String(e.message).slice(0, 200)}`) }
  if (errs.length) console.log(`r${room} ${T} errores: ${errs.join(' | ')}`);
  await page.close();
}
fs.writeFileSync(path.join(DIR, `it4_camaras_${label}.json`), JSON.stringify(data, null, 1));

// hojas de contacto: una por sala (fila preludio, fila juego)
const sheet = await browser.newPage();
for (const room of ROOMS) {
  const cell = (st) => SIZES.map(([w, h]) => { const f = path.join(SHOTS, `it4_cam_${label}_r${room}_${w}x${h}_${st}.jpg`); if (!fs.existsSync(f)) return ''; const k = w < h ? 500 / h : 250 / h; return `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}" width="${Math.round(w * k)}" height="${Math.round(h * k)}"><figcaption>${w}×${h} ${st}</figcaption></figure>` }).join('');
  await sheet.setViewport({ width: 1560, height: 1200 });
  await sheet.setContent(`<body style="margin:0;background:#111;color:#eee;font:12px monospace"><div id="s" style="display:inline-block;padding:6px"><div style="display:flex;gap:6px;align-items:flex-start">${cell('pre')}</div><div style="display:flex;gap:6px;align-items:flex-start">${cell('juego')}</div></div><style>figure{margin:0 0 6px}figcaption{padding:2px}</style></body>`);
  const el = await sheet.$('#s'); await el.screenshot({ path: path.join(SHOTS, `it4_cam_${label}_hoja_r${room}.jpg`), type: 'jpeg', quality: 82 });
}
await browser.close(); console.log('FIN');
