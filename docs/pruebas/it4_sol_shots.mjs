// SOL: capturas y comprobaciones de preludio y juego en varios tamaños. Uso: node it4_sol_shots.mjs <etiqueta> [tamaños]
import { launch, sleep, BASE, shot } from './lib.mjs';
const label = process.argv[2] || 'antes';
const SIZES = (process.argv[3] || '360x640x1,390x844x1,412x915x1,844x390x1,667x375x1,768x1024x1,1024x768x1,1366x768x0,1920x1080x0').split(',').map(s => s.split('x').map(Number));
const browser = await launch(); let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; return (ok ? 'OK  ' : 'FALLA ') + msg; };
// caja del holograma frente al cuadro y a las piezas del HUD realmente visibles
const holoCheck = (page) => page.evaluate(() => {
  const d = window.__FLX.cur.dbg(); if (!d.box) return null;
  const W = innerWidth, H = innerHeight, b = d.box, px = { l: (b.left * .5 + .5) * W, r: (b.right * .5 + .5) * W, t: (-b.top * .5 + .5) * H, w: (-b.waist * .5 + .5) * H };
  const hit = [];
  for (const q of ['#progress', '#objective', '#btnBack', '#btnSkip', '#btnVoSkip', '#roomHint', '#roomInfo', '#hud .brandwrap', '#hud .rightTop']) { const e = document.querySelector(q); if (!e || (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))) continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.top > H * .5) continue; if (r.right > px.l && r.left < px.r && r.bottom > px.t && r.top < px.w) hit.push(q); }
  return { scale: d.holo.scale, level: d.holo.level, px: Object.fromEntries(Object.entries(px).map(([k, v]) => [k, Math.round(v)])), dentro: px.l >= 0 && px.r <= W && px.t >= 0, hud: hit, altoPx: Math.round(px.w - px.t), anchoPx: Math.round(px.r - px.l) };
});
for (const [w, h, touch] of SIZES) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await page.goto(`${BASE}/juego/?room=5&debug${touch ? '&input=touch' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && window.S.room === 5 && window.S.ready; }, { timeout: 120000, polling: 100 });
  const T = `${w}x${h}`; const out = [];
  await sleep(4000);
  await shot(page, `it4_sol_${label}_${T}_preludio.jpg`);
  let hc = await holoCheck(page);
  if (hc) out.push(check(hc.dentro && !hc.hud.length, `preludio (título visible) holograma ${JSON.stringify(hc)}`));
  await sleep(7500); // el título de la sala se retira a los 9 s
  hc = await holoCheck(page);
  if (hc) { await shot(page, `it4_sol_${label}_${T}_preludio_12s.jpg`); out.push(check(hc.dentro && !hc.hud.length, `preludio (12 s) holograma ${JSON.stringify(hc)}`)); }
  for (let k = 0; k < 14; k++) { const ph = await page.evaluate(async () => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; Pl.player.set(0, Pl.player.y, 0); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }); if (ph === 'brief') break; await sleep(600); }
  await sleep(900); await page.evaluate(async () => (await import('/juego/flow.js')).startRoom());
  await sleep(4500);
  await shot(page, `it4_sol_${label}_${T}_juego.jpg`);
  hc = await holoCheck(page);
  if (hc) out.push(check(hc.dentro && !hc.hud.length, `juego holograma ${JSON.stringify(hc)}`));
  const st = () => page.evaluate(() => window.__FLX?.cur?.dbg?.() ?? null);
  let d = await st();
  if (d?.orbs) {
    out.push(check(d.orbs.every(o => !o.cap && o.hold === 0), `sin toques: ningún sensor conectado ni cargando (armed=${d.armed})`));
    const uiTop = await page.evaluate(async () => (await import('/juego/GameContext.js')).GX.uiTop || 0);
    out.push(check(d.orbs.every(o => o.x >= 48 && o.x <= w - 48 && o.y >= uiTop + 42 && o.y <= h - 60), `sensores dentro del cuadro y bajo el HUD (uiTop ${uiTop}) ${JSON.stringify(d.orbs.map(o => [o.x, o.y]))}`));
    const sep = Math.min(Math.hypot(d.orbs[0].x - d.orbs[1].x, d.orbs[0].y - d.orbs[1].y), Math.hypot(d.orbs[0].x - d.orbs[2].x, d.orbs[0].y - d.orbs[2].y), Math.hypot(d.orbs[1].x - d.orbs[2].x, d.orbs[1].y - d.orbs[2].y));
    out.push(check(sep >= 72, `separación mínima entre sensores ${Math.round(sep)} px · radio táctil ${d.hitR} px`));
    // toque real a 44 px del centro del sensor 0 (fuera del dibujo de 30 px, dentro del área táctil)
    const off = touch ? 44 : 36; let o = d.orbs[0];
    if (touch) await page.touchscreen.touchStart(o.x - off, o.y); else await page.mouse.move(o.x - off, o.y);
    for (let i = 0; i < 6; i++) { await sleep(90); o = (await st()).orbs[0]; if (touch) await page.touchscreen.touchMove(o.x - off, o.y); else await page.mouse.move(o.x - off, o.y); }
    d = await st(); out.push(check(d.orbs[0].hold > .2 && !d.orbs[0].cap, `a ${off} px del centro carga (hold ${d.orbs[0].hold})`));
    await shot(page, `it4_sol_${label}_${T}_juego_cargando.jpg`);
    for (let i = 0; i < 14 && !(await st()).orbs[0].cap; i++) { await sleep(90); o = (await st()).orbs[0]; if (touch) await page.touchscreen.touchMove(o.x - off, o.y); else await page.mouse.move(o.x - off, o.y); }
    if (touch) await page.touchscreen.touchEnd(); else await page.mouse.move(8, h - 8);
    await sleep(900); d = await st();
    out.push(check(d.orbs[0].cap && !d.orbs[1].cap && !d.orbs[2].cap, `conectado solo el sensor tocado ${JSON.stringify(d.orbs.map(o => o.cap))}`));
    await shot(page, `it4_sol_${label}_${T}_juego_conectado.jpg`);
  }
  out.push(check(!errs.length, 'sin errores de página ' + errs.join(' | ')));
  console.log('== ' + T + (touch ? ' táctil' : '') + '\n  ' + out.join('\n  '));
  await page.close();
}
await browser.close();
console.log(fails ? `FALLAS: ${fails}` : 'TODO OK');
