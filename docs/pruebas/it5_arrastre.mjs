// Ajuste 5: arrastre de los fragmentos de partitura en LA♯ (room=6). Ratón y táctil real (CDP), directo y embebido.
// Uso: node it5_arrastre.mjs <etiqueta> [tamaños "360x640,390x844,844x390,768x1024,1366x768"] [modos "raton,tactil"] [embebido 0|1] [completar 0|1]
// Por paso se mide el ERROR DE SEGUIMIENTO: distancia entre el dedo y el punto del fragmento que se agarró
// (se calcula con la caja real y la matriz de transformación de la tarjeta fantasma, así vale para left/top o transform).
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, BASE, SHOTS, DIR } from './lib.mjs';
const label = process.argv[2] || 'despues';
const SIZES = (process.argv[3] || '360x640,390x844,844x390,768x1024,1366x768').split(',').map(s => s.split('x').map(Number));
const MODOS = (process.argv[4] || 'raton,tactil').split(',');
const EMB = process.argv[5] === '1', COMPLETAR = process.argv[6] !== '0';
const browser = await launch(); const filas = [];

// ---- funciones que corren dentro del juego ----
const enPagina = () => {
  window.__arr = {
    lin(el) { const m = new DOMMatrix(getComputedStyle(el).transform); return [m.a, m.b, m.c, m.d] },
    // punto local (en la caja sin transformar) que cae bajo (x,y)
    local(el, x, y) { const r = el.getBoundingClientRect(), [a, b, c, d] = this.lin(el), det = a * d - b * c, dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2); return [(d * dx - c * dy) / det + el.offsetWidth / 2, (-b * dx + a * dy) / det + el.offsetHeight / 2] },
    // posición en pantalla de un punto local
    visual(el, q) { const r = el.getBoundingClientRect(), [a, b, c, d] = this.lin(el), lx = q[0] - el.offsetWidth / 2, ly = q[1] - el.offsetHeight / 2; return [r.left + r.width / 2 + a * lx + c * ly, r.top + r.height / 2 + b * lx + d * ly] },
    estado() { return { slots: [...document.querySelectorAll('#laFrame .slot')].map(s => s.querySelector('.lcard')?.dataset.i ?? null), tray: [...document.querySelectorAll('#tray .lcard')].map(c => c.dataset.i), fantasmas: document.querySelectorAll('.lcard.drag').length, lifted: document.querySelectorAll('.lcard.lifted').length, hover: document.querySelectorAll('.slot.hover').length } },
    carta(i) { const c = document.querySelector(`#laUI .lcard[data-i="${i}"]`); if (!c) return null; const r = c.getBoundingClientRect(); return { r: [r.left, r.top, r.width, r.height], w: c.offsetWidth, h: c.offsetHeight } },
    slot(k) { const r = document.querySelectorAll('#laFrame .slot')[k].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] },
    paso(q, x, y) { const g = document.querySelector('.lcard.drag'); if (!g) return null; const v = this.visual(g, q), r = g.getBoundingClientRect(); return { err: Math.hypot(v[0] - x, v[1] - y), v, w: g.offsetWidth, h: g.offsetHeight, bb: [r.left, r.top], n: document.querySelectorAll('.lcard.drag').length } },
    encima(i) { const c = document.querySelector(`#laUI .lcard[data-i="${i}"]`), r = c.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e === c || c.contains(e)) ? null : (e ? (e.id || e.className || e.tagName) : 'nada') },
  };
  // última posición del puntero que el navegador entregó a la página (los toques llegan alineados al cuadro)
  window.__pm = null; for (const t of ['pointermove', 'pointerdown']) addEventListener(t, e => { window.__pm = [e.clientX, e.clientY] }, true);
  // cuenta de sonidos lanzados (toque = oír)
  window.__son = 0; const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__son++; return st.apply(this, a) };
};
const irAJuego = async (f, room) => {
  for (let k = 0; k < 20; k++) {
    const ph = await f.evaluate(async (room) => {
      const b = '/juego/'; if (window.S.phase === 'brief' || window.S.phase === 'play') return window.S.phase;
      const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js');
      try { V.voStop?.() } catch { } try { (await import(b + 'core/voiceState.js')).VO.armed = true } catch { }
      const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone?.(); return window.S.phase
    }, room);
    if (ph === 'brief' || ph === 'play') break; await sleep(600);
  }
  await sleep(700); await f.evaluate(async () => { if (window.S.phase !== 'play') (await import('/juego/flow.js')).startRoom() }); await sleep(2200);
};

for (const [w, h] of SIZES) for (const modo of MODOS) {
  const tactil = modo === 'tactil', T = `${w}x${h}`, id = `${label} ${EMB ? 'embebido ' : ''}${T} ${modo}`;
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: tactil ? 2 : 1, hasTouch: tactil, isMobile: tactil });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text().slice(0, 200)) });
  const cdp = await page.createCDPSession();
  const R = { T, modo, emb: EMB, ok: true, notas: [] }; const falla = (s) => { R.ok = false; R.notas.push(s); console.log(`${id} FALLA ${s}`) };
  let f = page;
  try {
    if (EMB) { // landing → nota LA♯ + E → sala 6 dentro del iframe
      await page.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting') }, { timeout: 60000 });
      await sleep(1500); await page.evaluate(() => document.querySelector('.press-start').click());
      await page.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); await sleep(1500);
      const marks = await page.evaluate(() => window.__flauxus.marks());
      await page.evaluate(([s, e]) => scrollTo(0, s + (e - s) * .3), marks.m5); await sleep(2500);
      await page.evaluate(() => [...document.querySelectorAll('#m5 .note')][5].focus()); await sleep(400);
      await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
      for (let i = 0; i < 400; i++) { const fr = page.frames().find(x => x.url().includes('/juego/')); if (fr && await fr.evaluate(() => { const pre = document.getElementById('preloader'); return !!(window.S && pre && !pre.classList.contains('on') && window.S.room === 6 && window.S.ready) }).catch(() => false)) { f = fr; break } await sleep(250) }
      if (f === page) throw new Error('el juego embebido no abrió la sala 6');
      const off = await page.evaluate(() => { const r = document.querySelector('#game iframe').getBoundingClientRect(); return [r.left, r.top, r.width, r.height] }); R.iframe = off.map(Math.round);
      if (Math.abs(off[0]) > .5 || Math.abs(off[1]) > .5) throw new Error('iframe desplazado ' + off);
    } else {
      await page.goto(`${BASE}/juego/?room=6${tactil ? '&input=touch' : ''}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && window.S.room === 6 && window.S.ready }, { timeout: 120000, polling: 200 });
    }
    await sleep(800); await f.evaluate(enPagina); await irAJuego(f, 6);
    R.fase = await f.evaluate(() => window.S.phase); R.touchClass = await f.evaluate(() => document.body.classList.contains('touch'));
    if (R.fase !== 'play') throw new Error('no llegó a play: ' + R.fase);
    await sleep(600);

    // ---- puntero: ratón (page.mouse) o dedo (CDP Input.dispatchTouchEvent) ----
    let dedo = null, otros = [];
    const tp = () => [...(dedo ? [{ x: dedo[0], y: dedo[1], id: 1, radiusX: 8, radiusY: 8, force: 1 }] : []), ...otros];
    const P = {
      async down(x, y) { if (tactil) { dedo = [x, y]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp() }) } else { await page.mouse.move(x, y); await sleep(260); await page.mouse.down() } },
      async move(x, y) { if (tactil) { dedo = [x, y]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp() }) } else await page.mouse.move(x, y) },
      async up() { if (tactil) { dedo = null; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: tp() }) } else await page.mouse.up() },
      async cancel() { if (tactil) { dedo = null; otros = []; await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }) } },
    };
    const est = () => f.evaluate(() => window.__arr.estado());
    const pasos = { n: 0, max: 0, saltos: 0, peor: null, tam: 0 };
    // Arrastra la tarjeta i hasta (dx,dy) agarrándola en la fracción (fx,fy); mide cada paso. `enMedio` corre a mitad de camino.
    const arrastra = async (i, dest, { fx = .3, fy = .65, n = 14, soltar = true, enMedio = null, medir = true } = {}) => {
      const c = await f.evaluate((i) => window.__arr.carta(i), i); if (!c) { falla(`no hay tarjeta ${i}`); return }
      const gx = c.r[0] + c.r[2] * fx, gy = c.r[1] + c.r[3] * fy;
      if (!tactil) { await page.mouse.move(gx, gy); await sleep(260) } // el «hover» del ratón termina su transición antes de agarrar
      const q = await f.evaluate((i, x, y) => { const el = document.querySelector(`#laUI .lcard[data-i="${i}"]`); return window.__arr.local(el, x, y) }, i, gx, gy);
      await P.down(gx, gy); await sleep(40);
      await P.move(gx + 2, gy + 2); await sleep(16); // por debajo del umbral: aún es un toque
      let prev = null, ult = [gx, gy];
      for (let k = 1; k <= n; k++) {
        const t = k / n, d = typeof dest === 'function' ? await dest() : dest; // el destino se relee: puede moverse (giro)
        const x = gx + (d[0] - gx) * t + Math.sin(t * Math.PI * 3) * 9 * (1 - t), y = gy + (d[1] - gy) * t + Math.sin(t * Math.PI * 2) * 22 * (1 - t);
        await P.move(x, y); ult = [x, y];
        // espera a que la página haya recibido ESTE movimiento antes de medir (si no, se mediría el paso anterior)
        const llego = await f.waitForFunction((x, y) => window.__pm && Math.abs(window.__pm[0] - x) < .6 && Math.abs(window.__pm[1] - y) < .6, { timeout: 400, polling: 'raf' }, x, y).then(() => true, () => false);
        if (!llego && medir) { pasos.perdidos = (pasos.perdidos || 0) + 1 }
        if (medir) {
          const m = await f.evaluate((q, x, y) => window.__arr.paso(q, x, y), q, x, y);
          if (!m) { if (Math.hypot(x - gx, y - gy) > 24) { pasos.saltos++; falla(`tarjeta ${i} paso ${k}: no hay fantasma bajo el dedo`) } } // dentro del margen de toque del navegador aún no hay arrastre
          else {
            pasos.n++; if (m.err > pasos.max) { pasos.max = m.err; pasos.peor = `tarjeta ${i} paso ${k}` }
            if (m.n !== 1) falla(`tarjeta ${i} paso ${k}: ${m.n} fantasmas`);
            pasos.tam = Math.max(pasos.tam, Math.abs(m.w - c.w), Math.abs(m.h - c.h));
            if (prev) { const s = Math.hypot((m.v[0] - prev.v[0]) - (x - prev.x), (m.v[1] - prev.v[1]) - (y - prev.y)); if (s > 2) pasos.saltos++ }
            prev = { v: m.v, x, y };
          }
        }
        if (enMedio && k === Math.floor(n / 2)) await enMedio();
        await sleep(12);
      }
      if (soltar) { await P.up(); await sleep(140) }
      return ult;
    };
    const slotC = (k) => f.evaluate((k) => window.__arr.slot(k), k);

    // 0) nada tapa las tarjetas
    const tapa = []; for (let i = 0; i < 6; i++) { const e = await f.evaluate((i) => window.__arr.encima(i), i); if (e) tapa.push(`${i}:${e}`) } R.tapadas = tapa; if (tapa.length) falla('tarjetas tapadas ' + tapa.join(' '));

    // A) toque = oír (sin mover nada)
    const e0 = await est(), s0 = await f.evaluate(() => window.__son);
    { const c = await f.evaluate(() => window.__arr.carta(0)); await P.down(c.r[0] + c.r[2] / 2, c.r[1] + c.r[3] / 2); await sleep(60); await P.up(); await sleep(250) }
    const e1 = await est(), s1 = await f.evaluate(() => window.__son);
    R.toque = JSON.stringify(e0) === JSON.stringify(e1) && s1 > s0; if (!R.toque) falla(`toque: sonidos ${s1 - s0}, estado ${JSON.stringify(e1)}`);
    await f.evaluate(async () => (await import('/juego/AudioSystem.js')).stopClips());

    // B) colocar los 4 fragmentos (0→I, 1→II, 2→III, 3→IV), agarrando cada uno en un punto distinto
    const G = [[.3, .65], [.8, .25], [.15, .2], [.6, .85]];
    for (let k = 0; k < 4; k++) await arrastra(k, await slotC(k), { fx: G[k][0], fy: G[k][1], enMedio: k === 2 && [390, 844, 1366].includes(w) ? () => page.screenshot({ path: path.join(SHOTS, `it5_arrastre_${label}${EMB ? '_emb' : ''}_${T}_${modo}_enelaire.jpg`), type: 'jpeg', quality: 80 }) : null });
    R.B = { pasos: pasos.n, errMax: +pasos.max.toFixed(2), saltos: pasos.saltos, tam: +pasos.tam.toFixed(1) };
    let e = await est(); R.colocados = e.slots.join(''); if (e.slots.join('') !== '0123') falla('colocación ' + JSON.stringify(e.slots));
    if (e.fantasmas || e.lifted || e.hover) falla('restos tras colocar ' + JSON.stringify(e));
    if (w === 390 || w === 844 || w === 1366) await page.screenshot({ path: path.join(SHOTS, `it5_arrastre_${label}${EMB ? '_emb' : ''}_${T}_${modo}_colocados.jpg`), type: 'jpeg', quality: 80 });

    // C) reordenar (I → III ocupado: el que estaba vuelve a la bandeja) y retirar (soltar fuera = bandeja)
    await arrastra(0, await slotC(2)); e = await est();
    R.reordenar = e.slots[0] === null && e.slots[2] === '0' && e.tray.includes('2'); if (!R.reordenar) falla('reordenar ' + JSON.stringify(e));
    await arrastra(1, [w * .5, Math.max(8, h * .05)]); e = await est();
    R.retirar = e.slots[1] === null && e.tray.includes('1'); if (!R.retirar) falla('retirar ' + JSON.stringify(e));

    // D) cancelación: no cambia nada y no deja restos
    const antesC = await est();
    if (tactil) {
      await arrastra(4, await slotC(0), { soltar: false }); await P.cancel(); await sleep(150);
    } else { // el ratón sale de la ventana y se suelta fuera
      await arrastra(4, [w + 60, -40], { soltar: false, medir: false }); await page.mouse.up(); await sleep(150);
    }
    e = await est(); R.cancelar = e.fantasmas === 0 && e.lifted === 0 && e.hover === 0 && (tactil ? JSON.stringify(e) === JSON.stringify(antesC) : e.slots.join() === antesC.slots.join());
    if (!R.cancelar) falla(`cancelar: antes ${JSON.stringify(antesC)} después ${JSON.stringify(e)}`);
    // pérdida de foco de la ventana a mitad de arrastre
    await arrastra(4, await slotC(0), { soltar: false, n: 6 }); await f.evaluate(() => window.dispatchEvent(new Event('blur'))); await sleep(120);
    e = await est(); R.foco = e.fantasmas === 0 && e.lifted === 0 && e.slots.join() === antesC.slots.join(); if (!R.foco) falla('pérdida de foco: ' + JSON.stringify(e));
    await P.up().catch(() => { }); await sleep(120); e = await est(); if (e.fantasmas || e.slots.join() !== antesC.slots.join()) falla('tras soltar después del blur: ' + JSON.stringify(e));

    // E) segundo dedo durante el arrastre (solo táctil): no roba ni duplica el fragmento
    if (tactil) {
      const c5 = await f.evaluate(() => window.__arr.carta(5));
      await arrastra(4, await slotC(0), { enMedio: async () => { otros = [{ x: c5.r[0] + c5.r[2] / 2, y: c5.r[1] + c5.r[3] / 2, id: 2, radiusX: 8, radiusY: 8, force: 1 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp() }); await sleep(30) } });
      otros = []; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(150);
      e = await est(); R.dosDedos = e.slots[0] === '4' && e.fantasmas === 0 && e.lifted === 0; if (!R.dosDedos) falla('dos dedos: ' + JSON.stringify(e));
    } else await arrastra(4, await slotC(0));

    // F) girar / redimensionar a mitad de arrastre: el fragmento sigue al dedo y cae en la casilla bajo el dedo
    await arrastra(1, () => slotC(1), { n: 16, enMedio: async () => { await page.setViewport({ width: h, height: w, deviceScaleFactor: tactil ? 2 : 1, hasTouch: tactil, isMobile: tactil }); await sleep(500) } });
    e = await est(); R.giro = e.slots[1] === '1' && e.fantasmas === 0; if (!R.giro) falla('giro a mitad de arrastre: ' + JSON.stringify(e));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: tactil ? 2 : 1, hasTouch: tactil, isMobile: tactil }); await sleep(500);
    // deja los 4 espacios compuestos
    e = await est(); for (let k = 0; k < 4; k++) if (e.slots[k] === null) { const lib = (await est()).tray[0]; await arrastra(+lib, await slotC(k)) }
    e = await est(); if (e.slots.some(s => s === null)) falla('no quedaron 4 compuestos ' + JSON.stringify(e));

    R.perdidos = pasos.perdidos || 0; R.pasos = pasos.n; R.errMax = +pasos.max.toFixed(2); R.saltos = pasos.saltos; R.peor = pasos.peor; R.tam = +pasos.tam.toFixed(1);
    if (pasos.max > 2) falla(`error de seguimiento máx ${pasos.max.toFixed(2)} px (${pasos.peor})`);
    if (pasos.saltos) falla(`${pasos.saltos} saltos`);
    if (pasos.tam > 1) falla(`el fragmento cambia de tamaño al levantarlo: ${pasos.tam.toFixed(1)} px`);

    // G) completar la sala: escuchar la secuencia y entregar
    if (COMPLETAR) {
      const clic = async (sel) => { const r = await f.evaluate((sel) => { const b = document.querySelector(sel), r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, b.disabled, getComputedStyle(b).display] }, sel); await P.down(r[0], r[1]); await sleep(40); await P.up(); return r };
      const b = await clic('#laListen'); if (b[2]) falla('«Escuchar secuencia» deshabilitado');
      await f.waitForFunction(() => getComputedStyle(document.getElementById('laConfirm')).display !== 'none', { timeout: 180000, polling: 300 });
      // a mitad de arrastre se entrega la obra: no debe quedar nada colgado ni dar errores
      const sl = (await est()).slots[3]; await arrastra(+sl, await slotC(3), { soltar: false, n: 6 });
      await f.evaluate(() => document.getElementById('laConfirm').click()); await sleep(600);
      await P.move(w / 2, h / 2).catch(() => { }); await P.up().catch(() => { }); await sleep(600);
      e = await est(); R.fin = await f.evaluate(() => window.S.phase); R.completa = R.fin === 'done' && e.fantasmas === 0;
      if (!R.completa) falla(`completar: fase ${R.fin}, fantasmas ${e.fantasmas}`);
    }
  } catch (err) { falla('ERROR ' + String(err.message).slice(0, 260)) }
  if (errs.length) { R.errores = [...new Set(errs)]; falla('errores de página: ' + R.errores.join(' | ')) }
  filas.push(R); console.log(`${id} ${R.ok ? 'OK' : 'CON FALLAS'} ${JSON.stringify({ colocar4: R.B, pasos: R.pasos, errMax: R.errMax, saltos: R.saltos, tam: R.tam, toque: R.toque, colocados: R.colocados, reordenar: R.reordenar, retirar: R.retirar, cancelar: R.cancelar, foco: R.foco, dosDedos: R.dosDedos, giro: R.giro, completa: R.completa })}`);
  await page.close();
}
fs.writeFileSync(path.join(DIR, `it5_arrastre_${label}${EMB ? '_emb' : ''}.json`), JSON.stringify(filas, null, 1));
await browser.close(); console.log(filas.every(r => r.ok) ? 'TODO OK' : 'HAY FALLAS'); console.log('FIN');
