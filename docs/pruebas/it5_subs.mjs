// Iteración 5 · subtítulos sincronizados con la locución.
// Política de autoplay SIMULADA: Chrome sin ventana deja sonar todo aunque se le pida la política estricta, así que
// cada página rechaza play() con NotAllowedError hasta que el documento recibe un gesto de verdad (pointerdown o keydown con isTrusted).: cada sala se abre con ?room=N, la narración
// arranca con su reloj propio (la voz está bloqueada hasta que haya un gesto), se pulsa una tecla (gesto real) y
// la voz debe engancharse en ese instante. Se muestrea cada 100 ms: reloj, currentTime, texto visible, líneas.
// Uso: node it5_subs.mjs [tamaños: 360x640,390x844,…|todos] [salas: 1,2,…] [extras: 1|0]
//   → it5_subs_<tamaño>.json + shots/it5_subs_<tamaño>_<SALA>_<1-3>.jpg
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { sleep, SHOTS, BASE, DIR, SEL } from './lib.mjs';

const TODOS = [[360, 640, 1], [390, 844, 1], [844, 390, 1], [768, 1024, 1], [1366, 768, 0]];
const arg = process.argv[2] && process.argv[2] !== 'todos' ? process.argv[2].split(',') : null;
const SIZES = TODOS.filter(([w, h]) => !arg || arg.includes(`${w}x${h}`));
const ROOMS = (process.argv[3] || '1,2,3,4,5,6').split(',').map(Number);
const EXTRAS = process.argv[4] !== '0';
const NOM = ['', 'DO', 'RE', 'MI', 'FA', 'SOL', 'LA'];
const fallas = [];
const ok = (cond, msg) => { if (!cond) { fallas.push(msg); console.log('  FALLA', msg) } return cond };

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--no-first-run', '--mute-audio',  '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});

async function abrir(w, h, touch, room, { sinAudio = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().slice(-60)) });
  await page.evaluateOnNewDocument(() => {
    const play = HTMLMediaElement.prototype.play; window.__bloqueos = 0; let gesto = false;
    for (const n of ['pointerdown', 'keydown']) addEventListener(n, e => { if (e.isTrusted) gesto = true }, true);
    HTMLMediaElement.prototype.play = function () { if (!gesto) { window.__bloqueos++; return Promise.reject(new DOMException('sin gesto', 'NotAllowedError')) } return play.call(this) };
  });
  if (sinAudio) { await page.setRequestInterception(true); page.on('request', r => /audio\/locucion\/.*\.(ogg|m4a)/.test(r.url()) ? r.abort() : r.continue()) }
  await page.goto(`${BASE}/juego/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.S, { timeout: 30000, polling: 50 });
  // muestreador: se instala antes de que la sala esté lista, para no perder la primera frase
  await page.evaluate(async () => {
    const { VO } = await import('/juego/core/voiceState.js');
    const M = window.__m = { s: [], on: false, t0: 0 };
    setInterval(() => {
      if (!VO.active) { if (M.on) M.fin = performance.now(); return }
      if (!M.on) { M.on = true; M.t0 = performance.now() }
      const vl = document.querySelector('#voText .vl.on'), tx = document.getElementById('voText').getBoundingClientRect(), el = VO.el;
      let lines = 0, over = false, txt = '';
      if (vl && vl.firstChild && +getComputedStyle(vl).opacity > 0) {
        txt = vl.textContent; const r = document.createRange(); r.selectNodeContents(vl); const rc = [...r.getClientRects()];
        lines = new Set(rc.map(q => Math.round(q.top))).size;
        const quieto = /none|matrix(1, 0, 0, 1, 0, 0)/.test(getComputedStyle(vl).transform);   // durante el relevo (200 ms) la capa aún se desplaza 6 px
        over = rc.some(q => q.left < tx.left - 1 || q.right > tx.right + 1) || quieto && rc.some(q => q.top < tx.top - 2 || q.bottom > tx.bottom + 2);
      }
      M.s.push({ n: performance.now() - M.t0, t: VO.t, ct: el ? el.currentTime : null, p: el ? el.paused : null, mu: el ? el.muted : null, txt, lines, over, capas: document.querySelectorAll('#voText .vl.on').length });
    }, 100);
  });
  await page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return pre && !pre.classList.contains('on') && window.S.room === room && window.S.ready }, { timeout: 120000, polling: 50 }, room);
  page.errs = errs; return page;
}
const estado = (page) => page.evaluate(async (SEL) => {
  const b = '/juego/'; const THREE = await import('three'); const { avatarObj } = await import(b + 'engine/avatar.js'); const { camera } = await import(b + 'engine/renderer.js');
  const W = innerWidth, H = innerHeight; camera.updateMatrixWorld();
  const s = avatarObj.scale.x, p = avatarObj.position, hh = 1.72 * s, hw = .34 * s; let l = 1e9, r = -1e9, t = 1e9, bt = -1e9;
  for (const dx of [-hw, hw]) for (const dy of [0, hh]) for (const dz of [-hw, hw]) { const v = new THREE.Vector3(p.x + dx, p.y + dy, p.z + dz).project(camera); const x = (v.x * .5 + .5) * W, y = (-v.y * .5 + .5) * H; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); bt = Math.max(bt, y) }
  const vis = e => { if (!e) return false; let q = e; while (q && q !== document.documentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < .05) return false; q = q.parentElement } const rc = e.getBoundingClientRect(); return rc.width > 2 && rc.height > 2 };
  const vo = document.getElementById('vo'), v = vo.getBoundingClientRect(), pisa = [];
  if (!vis(vo)) return { visible: false };
  for (const q of SEL) { const e = document.querySelector(q); if (q === '#vo' || !vis(e)) continue; const c = e.getBoundingClientRect(); if (c.left < v.right - 1 && v.left < c.right - 1 && c.top < v.bottom - 1 && v.top < c.bottom - 1) pisa.push(q) }
  for (const e of document.querySelectorAll('#hud button, #hud a, #joy')) { if (!vis(e)) continue; const c = e.getBoundingClientRect(); if (c.left < v.right - 1 && v.left < c.right - 1 && c.top < v.bottom - 1 && v.top < c.bottom - 1) pisa.push('ctl:' + (e.id || e.className)) }
  const ix = Math.min(v.right, r) - Math.max(v.left, l), iy = Math.min(v.bottom, bt) - Math.max(v.top, t);
  const cs = getComputedStyle(document.getElementById('voText'));
  return { visible: true, vo: [v.left, v.top, v.right, v.bottom].map(Math.round), fuera: v.left < -1 || v.top < -1 || v.right > W + 1 || v.bottom > H + 1, pisa, avatar: [l, t, r, bt].map(Math.round),
    avatarPct: ix > 2 && iy > 2 ? Math.round(100 * ix * iy / Math.max(1, (r - l) * (bt - t))) : 0, px: parseFloat(cs.fontSize), altoTexto: Math.round(document.getElementById('voText').getBoundingClientRect().height), lh: parseFloat(cs.lineHeight),
    live: document.getElementById('voLive').getAttribute('aria-live'), reduce: matchMedia('(prefers-reduced-motion: reduce)').matches };
}, SEL);
const pista = (page, room) => page.evaluate(async (room) => (await import('/juego/audio/locucion/pistas.js')).PISTAS[room], room);
const muestras = (page) => page.evaluate(() => ({ s: window.__m.s, fin: window.__m.fin || 0 }));
const voz = (page) => page.evaluate(async () => { const { VO } = await import('/juego/core/voiceState.js'); return { active: VO.active, armed: VO.armed, t: VO.t, el: VO.el ? { ct: VO.el.currentTime, p: VO.el.paused, mu: VO.el.muted, src: VO.el.currentSrc.split('/').pop() } : null } });

// Compara lo que se vio con la pista: cada texto mostrado debe ser un tramo de palabras de una frase, en orden.
function analizar(P, s, etiqueta) {
  const vistos = []; let prev = '';
  for (const m of s) { if (m.txt && m.txt !== prev) vistos.push({ txt: m.txt, n: m.n, reloj: m.ct !== null && !m.p ? m.ct : m.t, audio: m.ct !== null && !m.p }); prev = m.txt }
  let si = 0, wi = 0, maxOff = 0, n = 0; const offs = [];
  for (const v of vistos) {
    const pal = v.txt.split(/\s+/); let seg = P.segs[si], sw = seg ? seg.texto.split(/\s+/) : [];
    if (seg && wi >= sw.length) { si++; wi = 0; seg = P.segs[si]; sw = seg ? seg.texto.split(/\s+/) : [] }
    if (!ok(seg && sw.slice(wi, wi + pal.length).join(' ') === v.txt, `${etiqueta}: texto fuera de la pista o de orden «${v.txt}»`)) break;
    const esp = wi === 0 ? seg.t0 : seg.w[wi], off = v.reloj - esp; offs.push(+off.toFixed(2)); maxOff = Math.max(maxOff, Math.abs(off)); n++;
    ok(Math.abs(off) <= .25, `${etiqueta}: «${v.txt.slice(0, 30)}…» apareció a ${off.toFixed(2)} s de su inicio (${esp})`);
    wi += pal.length;
  }
  const completo = P.segs.map(x => x.texto).join(' ');
  ok(vistos.map(v => v.txt).join(' ') === completo, `${etiqueta}: el texto mostrado no es la narración completa (${vistos.length} tramos)`);
  ok(s.every(m => m.lines <= 2), `${etiqueta}: más de 2 líneas (${Math.max(...s.map(m => m.lines))})`);
  ok(s.every(m => !m.over), `${etiqueta}: texto desbordado de la caja`);
  ok(s.every(m => m.capas <= 1), `${etiqueta}: dos frases visibles a la vez`);
  return { tramos: n, maxOff: +maxOff.toFixed(2), offs, lineasMax: Math.max(0, ...s.map(m => m.lines)) };
}

const tabla = [];
for (const [w, h, touch] of SIZES) {
  const out = { size: `${w}x${h}`, salas: {} };
  for (const room of ROOMS) {
    const tag = `${w}x${h} ${NOM[room]}`; console.log('·', tag);
    const page = await abrir(w, h, touch, room); const P = await pista(page, room);
    await page.waitForFunction(() => window.__m.on, { timeout: 15000, polling: 50 });
    await sleep(1000);
    const antes = await voz(page);                                    // sin gesto: la voz no puede sonar; el reloj corre
    await page.keyboard.press('KeyZ');                                // gesto real (tecla sin función en el juego)
    await sleep(600);
    const d1 = await voz(page); await sleep(1000); const d2 = await voz(page);
    ok(antes.active && antes.t > .5 && (!antes.el || antes.el.p), `${tag}: antes del gesto debía avanzar solo el reloj (${JSON.stringify(antes)})`);
    ok(d1.el && !d1.el.p && !d1.el.mu, `${tag}: tras el gesto la voz no suena (${JSON.stringify(d1)})`);
    ok(d1.el && d2.el && d2.el.ct - d1.el.ct > .8 && d2.el.ct - d1.el.ct < 1.25, `${tag}: currentTime no avanza a ritmo real (${d1.el?.ct} → ${d2.el?.ct})`);
    ok(d1.el && Math.abs(d1.el.ct - d1.t) < .12 && d1.el.ct > 1.2, `${tag}: la voz no se enganchó en el instante del reloj (ct ${d1.el?.ct}, reloj ${d1.t})`);
    const est = [];
    for (let k = 0; k < 3; k++) {
      const obj = P.dur * [.22, .5, .82][k];
      await page.waitForFunction((obj) => window.__m.s.length && window.__m.s[window.__m.s.length - 1].t >= obj, { timeout: 90000, polling: 50 }, obj);
      const e = await estado(page); est.push(e);
      await page.screenshot({ path: path.join(SHOTS, `it5_subs_${w}x${h}_${NOM[room]}_${k + 1}.jpg`), type: 'jpeg', quality: 78 });
      ok(e.visible && !e.fuera, `${tag}: caja fuera de pantalla ${JSON.stringify(e.vo)}`);
      ok(e.visible && !e.pisa.length, `${tag}: la caja pisa ${e.pisa}`);
      ok(e.visible && e.avatarPct === 0, `${tag}: la caja tapa el ${e.avatarPct}% de la avatar (caja ${e.vo} · avatar ${e.avatar})`);
      ok(e.visible && e.px >= 16, `${tag}: letra de ${e.px}px`);
      ok(e.visible && Math.abs(e.altoTexto - 2 * e.lh) <= 1, `${tag}: la caja de texto no mide dos líneas (${e.altoTexto} vs ${2 * e.lh})`);
    }
    await page.waitForFunction(() => window.__m.fin, { timeout: 90000, polling: 100 }); await sleep(300);
    const { s } = await muestras(page), fin = await voz(page), a = analizar(P, s, tag);
    const conAudio = s.filter(m => m.ct !== null && !m.p), deriva = Math.max(0, ...conAudio.map(m => Math.abs(m.ct - m.t)));
    ok(fin.armed && !fin.active && !fin.el, `${tag}: al terminar no quedó armada/limpia (${JSON.stringify(fin)})`);
    ok(conAudio.length > (P.dur - 3) * 9, `${tag}: pocas muestras con la voz sonando (${conAudio.length})`);
    ok(deriva <= .06, `${tag}: el reloj de subtítulos se apartó ${deriva.toFixed(2)} s de currentTime`);
    ok(!(await page.evaluate(() => document.getElementById('vo').classList.contains('show'))), `${tag}: la caja no se ocultó al terminar`);
    ok(!page.errs.length, `${tag}: errores ${page.errs.join(' | ')}`);
    const fila = { tamaño: `${w}x${h}`, sala: NOM[room], frases: P.segs.length, 'tramos vistos': a.tramos, 'duración (s)': P.dur, 'desfase máx (s)': a.maxOff, 'líneas máx': a.lineasMax, 'letra px': est[0].px, 'caja': est[0].vo?.join(','), 'avatar %': Math.max(...est.map(e => e.avatarPct || 0)), reduce: est[0].reduce };
    tabla.push(fila); out.salas[NOM[room]] = { ...fila, offs: a.offs, est };
    await page.close();
  }
  fs.writeFileSync(path.join(DIR, `it5_subs_${w}x${h}.json`), JSON.stringify(out, null, 1));
}
console.table(tabla);

if (EXTRAS) {
  console.log('\n— extras —');
  { // 1. el audio no carga (peticiones abortadas): los mismos segmentos avanzan con su reloj
    const page = await abrir(390, 844, 1, 5, { sinAudio: true }); const P = await pista(page, 5);
    await page.waitForFunction(() => window.__m.fin, { timeout: 60000, polling: 100 });
    const { s } = await muestras(page), a = analizar(P, s, 'sin audio SOL'), fin = await voz(page);
    ok(s.every(m => m.ct === null || m.p), 'sin audio: no debía sonar nada'); ok(fin.armed && !fin.active, 'sin audio: no terminó armada');
    console.log('  sin audio (SOL 390x844): tramos', a.tramos, '· desfase máx', a.maxOff, 's · duración medida', (s[s.length - 1].n / 1000).toFixed(1), 's de', P.dur);
    await page.close();
  }
  { // 2. silencio, saltar y apagado
    const page = await abrir(1366, 768, 0, 2); await page.waitForFunction(() => window.__m.on, { timeout: 15000, polling: 50 });
    await sleep(600); await page.keyboard.press('KeyZ'); await sleep(900);
    const a = await voz(page); await page.keyboard.press('KeyM'); await sleep(300); const b = await voz(page); await page.keyboard.press('KeyM'); await sleep(300); const c = await voz(page);
    ok(a.el && !a.el.mu && b.el?.mu && c.el && !c.el.mu, `silencio (M): ${a.el?.mu} → ${b.el?.mu} → ${c.el?.mu}`);
    // pausa externa (el sistema corta el audio): los subtítulos esperan y luego siguen con su reloj
    await page.evaluate(async () => { (await import('/juego/core/voiceState.js')).VO.el.pause() }); await sleep(400); const p1 = await voz(page); await sleep(2200); const p2 = await voz(page);
    ok(p2.active && p2.t > p1.t + .5, `pausa externa: el reloj no retomó (${p1.t} → ${p2.t})`);
    await page.keyboard.press('KeyZ'); await sleep(700); const p3 = await voz(page);
    ok(p3.el && !p3.el.p && Math.abs(p3.el.ct - p3.t) < .12, `pausa externa: la voz no volvió con un gesto (${JSON.stringify(p3)})`);
    const el = await page.evaluateHandle(async () => (await import('/juego/core/voiceState.js')).VO.el);
    await page.click('#btnVoSkip'); await sleep(500); const sk = await voz(page);
    ok(sk.armed && !sk.active && !sk.el && await page.evaluate(e => e.paused, el) && !(await page.evaluate(() => document.getElementById('vo').classList.contains('show'))), `saltar: ${JSON.stringify(sk)}`);
    console.log('  silencio / pausa externa / saltar: comprobados en RE 1366x768');
    await page.close();
    const p4 = await abrir(390, 844, 1, 6); await p4.waitForFunction(() => window.__m.on, { timeout: 15000, polling: 50 }); await sleep(500); await p4.keyboard.press('KeyZ'); await sleep(900);
    const h2 = await p4.evaluateHandle(async () => (await import('/juego/core/voiceState.js')).VO.el); const sonaba = await p4.evaluate(e => e && !e.paused, h2);
    await p4.evaluate(() => dispatchEvent(new Event('flauxus:teardown'))); await sleep(300);
    ok(sonaba && await p4.evaluate(e => e.paused, h2) && await p4.evaluate(() => window.__flauxusStopped()), 'apagado: la voz siguió sonando tras flauxus:teardown');
    console.log('  apagado (teardown) en LA 390x844: la voz se detiene');
    // 3. pista estimada (ficha con texto y sin grabación) y redimensión en marcha
    const est = await p4.evaluate(async () => { const V = await import('/juego/ui/voice.js'); const p = V.pistaEstimada([{ t: 'Esta es una narración de prueba, sin grabación, que debe partirse en frases breves y coherentes. ¿Lo hace bien? Tiene que respetar la puntuación, no cortar palabras y avanzar con un ritmo de lectura parecido al de las grabaciones reales del proyecto.' }]); return { n: p.segs.length, max: Math.max(...p.segs.map(s => s.texto.length)), dur: p.dur, mono: p.segs.every((s, i) => s.t1 > s.t0 && (!i || s.t0 >= p.segs[i - 1].t1 - .01)), txt: p.segs.map(s => s.texto) } });
    ok(est.n >= 4 && est.max <= 66 && est.mono, `pista estimada: ${JSON.stringify(est)}`); console.log('  pista estimada:', est.n, 'frases · máx', est.max, 'car. ·', est.dur, 's\n   ', est.txt.join(' | '));
    await p4.close();
  }
  { // 4. girar el teléfono en plena locución: se vuelve a paginar y sigue en dos líneas
    const page = await abrir(360, 640, 1, 4); const P = await pista(page, 4); await page.waitForFunction(() => window.__m.on, { timeout: 15000, polling: 50 });
    await sleep(500); await page.keyboard.press('KeyZ'); await sleep(6000);
    await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    await page.waitForFunction(() => window.__m.fin, { timeout: 60000, polling: 100 });
    const { s } = await muestras(page); const vistos = [...new Set(s.map(m => m.txt).filter(Boolean))];
    ok(s.every(m => m.lines <= 2 && !m.over), `giro: líneas ${Math.max(...s.map(m => m.lines))} / desborde`);
    ok(vistos.join(' ') === P.segs.map(x => x.texto).join(' '), 'giro: el texto dejó de ser la narración completa');
    console.log('  giro 360x640 → 640x360 en FA: ', vistos.length, 'tramos · líneas máx', Math.max(...s.map(m => m.lines)));
    await page.close();
  }
}
await browser.close();
console.log(fallas.length ? `\n${fallas.length} FALLAS:\n` + fallas.join('\n') : '\nTODO OK');
