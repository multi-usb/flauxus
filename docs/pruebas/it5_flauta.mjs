// Ajuste 4: María Clara caminando con la flauta. Tiras de fotogramas del inicio (atrio) y de FA♯, con medidas del rig.
// Uso: [BASE=http://localhost:5198] node it5_flauta.mjs <etiqueta> [escenas "inicio,fa,pre4,fa5,fa0"] [tamaños "390x844x1,844x390x1,1366x768x0"] [cpu]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, BASE, SHOTS, DIR } from './lib.mjs';
const label = process.argv[2] || 'despues';
const ESC = (process.argv[3] || 'inicio,fa').split(',');
const SIZES = (process.argv[4] || '390x844x1,844x390x1,1366x768x0').split(',').map(s => s.split('x').map(Number));
const CPU = +(process.argv[5] || 1);
const browser = await launch(); const data = [];

// estado del rig: modo, fundido de flauta, pesos del mixer, manos↔flauta, pies↔suelo, caja en pantalla
const medir = (page) => page.evaluate(async () => {
  const b = '/juego/'; const THREE = await import('three'); const { avatarObj } = await import(b + 'engine/avatar.js'); const { camera } = await import(b + 'engine/renderer.js');
  const u = avatarObj.userData, V = THREE.Vector3, W = innerWidth, H = innerHeight; camera.updateMatrixWorld(); avatarObj.updateMatrixWorld(true);
  const s = avatarObj.scale.x, p = avatarObj.position, hh = 1.9 * s * (u.visual?.scale.y || 1), hw = .75 * s; let l = 1e9, r = -1e9, t = 1e9, bt = -1e9;
  for (const dx of [-hw, hw]) for (const dy of [-.05, 2.6 * s]) for (const dz of [-hw, hw]) { const v = new V(p.x + dx, p.y + dy, p.z + dz).project(camera); const x = (v.x * .5 + .5) * W, y = (-v.y * .5 + .5) * H; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); bt = Math.max(bt, y) }
  const o = { fase: window.S.phase, modo: u.mode, flauta: +(+u.flautaBlend).toFixed(3), visible: !!u.flute?.visible, walkW: +(u.walkW ?? -1).toFixed(2), tMix: +(u.mixer?.time ?? -1).toFixed(2), version: u.version, cargado: !!u.loaded, rotY: +avatarObj.rotation.y.toFixed(2), pos: [p.x, p.y, p.z].map(v => +v.toFixed(2)), caja: [l, t, r, bt].map(Math.round) };
  if (u.bones && u.flute) {
    const G = { Left: [.38, -.175, -.01], Right: [.126, -.175, -.01] };
    for (const side of ['Left', 'Right']) {
      const hand = u.bones.get('mixamorig' + side + 'Hand'); if (!hand) continue;
      const hp = hand.getWorldPosition(new V()), gp = u.flute.localToWorld(new V(...G[side]));
      o['mano' + side[0]] = +(hp.distanceTo(gp) / s).toFixed(3);
      const toe = u.bones.get('mixamorig' + side + 'ToeBase') || u.bones.get('mixamorig' + side + 'Foot');
      if (toe) o['pie' + side[0]] = +((toe.getWorldPosition(new V()).y - p.y) / s).toFixed(3);
    }
    const head = u.bones.get('mixamorigHead'); if (head) { const fp = u.flute.getWorldPosition(new V()); o.bocaY = +((fp.y - head.getWorldPosition(new V()).y) / s).toFixed(3); }
    const fq = u.flute.getWorldQuaternion(new THREE.Quaternion()), ax = new V(1, 0, 0).applyQuaternion(fq), aq = avatarObj.getWorldQuaternion(new THREE.Quaternion()), rx = new V(1, 0, 0).applyQuaternion(aq);
    o.ejeFlauta = +ax.dot(rx).toFixed(3); // 1 = tubo alineado con el eje lateral de la avatar
  }
  return o;
});

// cuadros por segundo durante 2 s (rAF real)
const fps = (page, ms = 2000) => page.evaluate((ms) => new Promise(res => { let n = 0, t0 = performance.now(), mx = 0, prev = t0; const f = (t) => { n++; mx = Math.max(mx, t - prev); prev = t; if (t - t0 < ms) requestAnimationFrame(f); else res({ fps: +(n * 1000 / (t - t0)).toFixed(1), peor: +mx.toFixed(1) }) }; requestAnimationFrame(f) }), ms);

const irAJuego = async (page, room) => {
  for (let k = 0; k < 16; k++) {
    const ph = await page.evaluate(async (room) => {
      const b = '/juego/'; if (window.S.phase === 'brief' || window.S.phase === 'play') return window.S.phase;
      const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js');
      try { V.voStop?.(); V.VO.armed = true } catch { } try { (await import(b + 'core/voiceState.js')).VO.armed = true } catch { }
      const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone?.(); return window.S.phase
    }, room);
    if (ph === 'brief' || ph === 'play') break; await sleep(600);
  }
  await sleep(700); await page.evaluate(async () => { if (window.S.phase !== 'play') (await import('/juego/flow.js')).startRoom() }); await sleep(2600);
};

for (const [w, h, touch] of SIZES) for (const esc of ESC) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) });
  const T = `${w}x${h}`, tiles = []; let n = 0;
  const take = async (nota) => {
    const m = await medir(page); const [l, t, r, b] = m.caja, cw = Math.max(60, r - l), ch = Math.max(90, b - t), mx = cw * .35, my = ch * .15;
    const clip = { x: Math.max(0, l - mx), y: Math.max(0, t - my), width: Math.min(w, cw + 2 * mx), height: Math.min(h, ch + 2 * my) }; clip.width = Math.min(clip.width, w - clip.x); clip.height = Math.min(clip.height, h - clip.y);
    const full = await page.screenshot({ type: 'jpeg', quality: 80 }); let crop = null;
    try { if (clip.width > 8 && clip.height > 8) crop = await page.screenshot({ type: 'jpeg', quality: 88, clip }) } catch { }
    tiles.push({ full, crop, nota, m }); data.push({ esc, T, k: n++, nota, ...m }); console.log(`${label} ${esc} ${T} ${nota} ${JSON.stringify(m)}`);
  };
  try {
    const room = esc === 'inicio' ? 0 : esc === 'fa5' || esc === 'pre5' ? 5 : esc === 'fa0' ? 1 : 4;
    const mm = await (async () => { await page.goto(`${BASE}/juego/?${room ? 'room=' + room + '&' : ''}debug${touch ? '&input=touch' : ''}`, { waitUntil: 'domcontentloaded' }); return 0 })();
    await page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true) }, { timeout: 120000, polling: 200 }, room);
    console.log(`${label} ${esc} ${T} reduced-motion=${await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)}`);
    await sleep(1000);
    if (CPU > 1) { const c = await page.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: CPU }) }
    if (esc === 'inicio') {
      await take('portada'); await page.evaluate(() => document.getElementById('btnStart').click());
      await sleep(350); await take('entra+0.35s'); await sleep(900); await take('entra+1.25s');
      await page.evaluate(() => window.walkNext?.()); for (let k = 0; k < 4; k++) { await sleep(420); await take('camina' + (k + 1)) }
      const f = await fps(page); console.log(`${label} ${esc} ${T} FPS caminando ${JSON.stringify(f)} cpu×${CPU}`); data.push({ esc, T, fps: f, cpu: CPU });
      await page.evaluate(async () => (await import('/juego/player.js')).stopAuto()); await sleep(900); await take('se detiene');
    } else if (esc.startsWith('pre')) { // preludio de FA♯: camina hacia el círculo con el traje «body»
      await sleep(1500); await take('preludio quieta');
      await page.keyboard.down('KeyW'); for (let k = 0; k < 4; k++) { await sleep(380); await take('camina' + (k + 1)) } await page.keyboard.up('KeyW'); await sleep(900); await take('se detiene');
    } else { // recorrido dentro del Momento (FA♯; fa5/fa0 = mismas teclas con otro traje, solo para ver el rig en el preludio)
      await irAJuego(page, room); await take('juego quieta');
      const keysSeq = ['KeyD', 'KeyD', 'KeyS', 'KeyA', 'KeyW'];
      await page.keyboard.down('KeyD'); await sleep(260);
      for (let k = 0; k < 4; k++) { await sleep(330); await take('camina' + (k + 1)); if (k === 1) { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyS') } }
      const f = await fps(page); console.log(`${label} ${esc} ${T} FPS caminando ${JSON.stringify(f)} cpu×${CPU}`); data.push({ esc, T, fps: f, cpu: CPU });
      for (const k of keysSeq) await page.keyboard.up(k).catch(() => { });
      await sleep(250); await take('frena+0.25s'); await sleep(900); await take('quieta tocando');
    }
  } catch (e) { console.log(`${label} ${esc} ${T} ERROR ${String(e.message).slice(0, 240)}`) }
  if (errs.length) console.log(`${label} ${esc} ${T} errores: ${[...new Set(errs)].join(' | ')}`);
  await page.close();
  // tira: fila de pantallas completas + fila de recortes de la avatar
  if (tiles.length) {
    const sheet = await browser.newPage(); const kf = (w < h ? 330 : 190) / h, cap = (x) => `<figcaption>${x.nota}<br>${x.m.modo} · flauta ${x.m.flauta}${x.m.manoL != null ? ` · manos ${x.m.manoL}/${x.m.manoR}` : ''}</figcaption>`;
    const img = (buf, ww, hh) => `<img src="data:image/jpeg;base64,${Buffer.from(buf).toString("base64")}" ${ww ? `width="${ww}"` : ''} height="${hh}">`;
    await sheet.setViewport({ width: 2400, height: 1200 });
    await sheet.setContent(`<body style="margin:0;background:#111;color:#eee;font:11px monospace"><div id="s" style="display:inline-block;padding:6px"><div style="font-size:14px;padding:2px 0 6px">${label} · ${esc} · ${T}${CPU > 1 ? ' · CPU×' + CPU : ''}</div><div style="display:flex;gap:6px;align-items:flex-start">${tiles.map(x => `<figure>${img(x.full, Math.round(w * kf), Math.round(h * kf))}${cap(x)}</figure>`).join('')}</div><div style="display:flex;gap:6px;align-items:flex-start">${tiles.map(x => x.crop ? `<figure>${img(x.crop, 0, 300)}</figure>` : '').join('')}</div></div><style>figure{margin:0 0 6px}figcaption{padding:2px;max-width:${Math.max(150, Math.round(w * kf))}px}</style></body>`);
    const el = await sheet.$('#s'); await el.screenshot({ path: path.join(SHOTS, `it5_flauta_${label}_${esc}_${T}.jpg`), type: 'jpeg', quality: 84 }); await sheet.close();
  }
}
fs.writeFileSync(path.join(DIR, `it5_flauta_${label}.json`), JSON.stringify(data, null, 1));
await browser.close(); console.log('FIN');
