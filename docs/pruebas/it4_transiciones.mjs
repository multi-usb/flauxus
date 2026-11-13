// Transiciones landing ↔ juego en móvil emulado (táctil): 5 ciclos portal → JUEGA YA → jugar → salir → volver a entrar.
// Uso: node it4_transiciones.mjs 390x844 [ciclos]
import path from 'node:path';
import { launch, sleep, SHOTS, BASE, snap } from './lib.mjs';
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number);
const CYCLES = +(process.argv[3] || 5);
const TAG = `it4_trans_${W}x${H}`;
const b = await launch();
const p = await b.newPage();
const vp = (w, h) => p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await vp(W, H);
const errs = [], aborted = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
p.on('requestfailed', (r) => aborted.push((r.failure()?.errorText || '') + ' ' + r.url().slice(-70)));
p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().slice(-90)); });
const shot = (n) => p.screenshot({ path: path.join(SHOTS, `${TAG}_${n}.jpg`), type: 'jpeg', quality: 78 });
const fails = []; let checks = 0;
const log = (...a) => console.log(...a);
const ok = (cond, msg, extra = '') => { checks++; if (!cond) { fails.push(msg + (extra ? ' → ' + extra : '')); log('   FALLO ·', msg, extra); } return cond; };
const frames = () => p.frames().filter((f) => f.url().includes('/juego/'));
const gameUp = async (room = 0) => { for (let i = 0; i < 400; i++) { const f = frames()[0]; if (f) { const r = await f.evaluate((room) => { const pr = document.getElementById('preloader'); return !!(window.S && pr && !pr.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true)); }, room).catch(() => false); if (r) return f; } await sleep(250); } throw new Error('el juego no cargó'); };

// (c) Qué hay de la landing visible o capaz de recibir eventos sobre el juego
const landingOver = () => p.evaluate(() => {
  const g = document.getElementById('game'), W = innerWidth, H = innerHeight;
  const top = {}, stack = {};
  for (let i = 0; i < 9; i++) for (let j = 0; j < 15; j++) {
    const x = Math.round((i + .5) * W / 9), y = Math.round((j + .5) * H / 15);
    const els = document.elementsFromPoint(x, y);
    const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '');
    const t = els[0];
    if (!t || !g.contains(t)) top[t ? name(t) : 'nada'] = (top[t ? name(t) : 'nada'] || 0) + 1;
    else if (t.tagName !== 'IFRAME') top['(juego) ' + name(t)] = (top['(juego) ' + name(t)] || 0) + 1;
    // lo que queda en la pila fuera del juego (recibiría eventos si el iframe no los tomara)
    for (const e of els) if (!g.contains(e) && e !== document.body && e !== document.documentElement) stack[name(e)] = (stack[name(e)] || 0) + 1;
  }
  // elementos fuera de #game que el navegador sigue pintando (visibility visible, con caja y opacidad)
  const vis = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (g.contains(e) || e.contains(g)) continue;
    const s = getComputedStyle(e); if (s.visibility !== 'visible' || s.display === 'none') continue;
    let a = e, shown = true, op = 1; while (a && a !== document.documentElement) { const sa = getComputedStyle(a); if (sa.display === 'none') { shown = false; break; } op *= +sa.opacity; a = a.parentElement; }
    if (!shown || op < .02) continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    vis.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).slice(0, 30) + `[${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}]`);
  }
  const l = document.getElementById('lens'), ls = l ? getComputedStyle(l) : null, cu = document.getElementById('cursor');
  const fr = g.querySelector('iframe'), rr = fr?.getBoundingClientRect();
  return {
    abierto: !g.hidden, gameOpen: document.documentElement.classList.contains('game-open'), marcos: document.querySelectorAll('iframe').length,
    marcoCaja: rr ? [rr.left, rr.top, rr.width, rr.height].map(Math.round) : null, vista: [W, H],
    top, stack, vis: vis.slice(0, 12), nvis: vis.length,
    lente: l ? { display: ls.display, vis: ls.visibility, op: +(+ls.opacity).toFixed(2), on: l.classList.contains('on'), w: Math.round(l.getBoundingClientRect().width) } : null,
    cursor: cu ? getComputedStyle(cu).display : null, scrollX: document.documentElement.scrollWidth > W + 1,
  };
});
const checkOver = (o, donde, { cargando = false } = {}) => {
  const tops = Object.keys(o.top).filter((k) => !(cargando && k.includes('game-close')) && !(k.startsWith('(juego)')));
  ok(o.abierto && o.gameOpen, `${donde}: el juego no figura abierto`, JSON.stringify([o.abierto, o.gameOpen]));
  ok(o.marcos === 1, `${donde}: iframes en el documento ≠ 1`, String(o.marcos));
  ok(frames().length === 1, `${donde}: contextos de navegación del juego ≠ 1`, String(frames().length));
  ok(tops.length === 0, `${donde}: un elemento de la landing recibe el toque sobre el juego`, JSON.stringify(o.top));
  ok(Object.keys(o.stack).length === 0, `${donde}: capas de la landing alcanzables bajo el juego`, JSON.stringify(o.stack));
  ok(o.nvis === 0, `${donde}: elementos de la landing aún visibles`, `${o.nvis}: ${o.vis.join(' ')}`);
  ok(o.lente && o.lente.display === 'none' && !o.lente.on, `${donde}: lente de radiografía activa`, JSON.stringify(o.lente));
  ok(o.marcoCaja && o.marcoCaja[0] === 0 && o.marcoCaja[1] === 0 && o.marcoCaja[2] === o.vista[0] && o.marcoCaja[3] === o.vista[1], `${donde}: el iframe no cubre la pantalla`, JSON.stringify([o.marcoCaja, o.vista]));
  ok(!o.scrollX, `${donde}: desborde horizontal`);
};
const closed = () => p.evaluate(() => {
  const g = document.getElementById('game'), l = document.getElementById('lens'), ls = getComputedStyle(l);
  const hidden = [...document.body.children].filter((e) => e !== g && e.tagName !== 'SCRIPT' && getComputedStyle(e).visibility === 'hidden' && getComputedStyle(e).display !== 'none').map((e) => e.id || e.className).slice(0, 6);
  return { oculto: g.hidden, gameOpen: document.documentElement.classList.contains('game-open'), marcos: document.querySelectorAll('iframe').length, estado: history.state, hist: history.length, scrollY: Math.round(scrollY),
    lente: { display: ls.display, op: +(+ls.opacity).toFixed(2), on: l.classList.contains('on') }, ocultosDeMas: hidden, cta: !!document.querySelector('#osd .cta.on'), started: document.documentElement.classList.contains('started') };
});
const checkClosed = (c, donde) => {
  ok(c.oculto && !c.gameOpen, `${donde}: la capa del juego sigue abierta`, JSON.stringify(c));
  ok(c.marcos === 0, `${donde}: quedó un iframe`, String(c.marcos));
  ok(frames().length === 0, `${donde}: quedó un contexto del juego vivo`, String(frames().length));
  ok(!c.estado?.flauxusGame, `${donde}: quedó la entrada del juego en el historial`, JSON.stringify(c.estado));
  ok(!c.lente.on && c.lente.op < .05, `${donde}: la lente quedó encendida`, JSON.stringify(c.lente));
  if (c.started) ok(c.ocultosDeMas.length === 0, `${donde}: la landing quedó con capas ocultas`, c.ocultosDeMas.join(','));
};
// (a) estado del juego al arrancar
const gameState = (f) => f.evaluate(() => ({ url: location.search, phase: window.S.phase, room: window.S.room, completed: [...window.S.completed], metrics: Object.keys(window.S.metrics || {}).length,
  key: localStorage.getItem('flauxus.progress.v1'), ls: Object.keys(localStorage).filter((k) => k.startsWith('flauxus')), intro: document.getElementById('intro') ? getComputedStyle(document.getElementById('intro')).display !== 'none' : null,
  pips: document.querySelectorAll('#progress .done, #progress .pip.done').length, canvases: document.querySelectorAll('canvas').length }));
const checkFresh = (s, donde, room = 0) => {
  ok(s.completed.length === 0, `${donde}: S.completed no está vacío`, JSON.stringify(s.completed));
  ok(s.key === null, `${donde}: existe flauxus.progress.v1`, String(s.key).slice(0, 80));
  ok(s.metrics === 0, `${donde}: S.metrics heredado`, String(s.metrics));
  ok(s.pips === 0, `${donde}: pips marcados como hechos`, String(s.pips));
  if (!room) ok(s.phase === 'intro' && s.room === 0, `${donde}: no arranca en el menú`, JSON.stringify([s.phase, s.room, s.url]));
  else ok(s.room === room, `${donde}: sala distinta de la pedida`, JSON.stringify([s.phase, s.room, s.url]));
};
const start = async () => {
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000 });
  await sleep(1200); await p.tap('.press-start');
  await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); await sleep(3500);
  return p.evaluate(() => window.__flauxus.marks());
};
const toPortal = async (marks) => { await p.evaluate(([s, e]) => scrollTo(0, e - (e - s) * .12), marks.m2); await p.waitForSelector('#osd .cta.on', { timeout: 20000 }); await sleep(900); };
const ctaBox = () => p.evaluate(() => { const c = document.querySelector('#osd .cta').getBoundingClientRect(); return [c.left, c.top, c.right, c.bottom].map(Math.round); });
const tapCta = async (hold = 160) => { const r = await ctaBox(); const x = r[0] + (r[2] - r[0]) * .6, y = r[1] + (r[3] - r[1]) * .45; await p.touchscreen.touchStart(x, y); await sleep(hold); await p.touchscreen.touchEnd(); return r; };
const seedOld = (f) => f.evaluate(() => localStorage.setItem('flauxus.progress.v1', JSON.stringify({ completed: [1, 2, 3, 4, 5, 6], metrics: { 1: { t: 30 } } })));

try {
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  log(`=== ${W}×${H} táctil · prefers-reduced-motion: ${await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)} ===`);
  let marks = await start();
  const met0 = await p.metrics();
  for (let n = 1; n <= CYCLES; n++) {
    log(`--- ciclo ${n}`);
    if (!(await p.evaluate(() => !!document.querySelector('#osd .cta.on')))) await toPortal(marks);
    const y0 = await p.evaluate(() => Math.round(scrollY));
    const box = await tapCta(n % 2 ? 160 : 450);
    ok(box[0] >= 0 && box[2] <= W && box[3] <= H, `ciclo ${n}: [ JUEGA YA ] fuera de la pantalla`, JSON.stringify(box));
    await p.waitForFunction(() => !document.getElementById('game').hidden, { timeout: 8000 });
    await sleep(500); const a = await landingOver(); checkOver(a, `ciclo ${n} cargando`, { cargando: true }); if (n === 1) await shot(`c${n}_a_cargando`);
    const f = await gameUp(0); await sleep(700);
    const s = await gameState(f); log('  estado inicial:', JSON.stringify(s)); checkFresh(s, `ciclo ${n} al entrar`);
    const o = await landingOver(); checkOver(o, `ciclo ${n} menú`); if (n === 1) log('  capa superior en la rejilla (fuera del iframe):', JSON.stringify(o.top), '· ◀◀ de la landing:', await p.evaluate(() => getComputedStyle(document.querySelector('.game-close')).display)); await shot(`c${n}_b_menu`);
    // toques dentro del juego donde quedaría la lente: nada de la landing debe reaccionar
    await p.touchscreen.touchStart(W / 2, H * .45); await sleep(350); const t1 = await landingOver(); await p.touchscreen.touchEnd();
    ok(t1.lente.display === 'none' && !t1.lente.on, `ciclo ${n}: la lente reacciona a un toque dentro del juego`, JSON.stringify(t1.lente));
    // jugar: entrar al atrio y marcar un nivel como completado por código (+ partida vieja sembrada en ciclos pares)
    await f.evaluate(() => document.getElementById('btnStart').click()); await sleep(2600);
    const played = await f.evaluate(async (n) => { const st = await import('/juego/core/state.js'); st.S.completed.add(n > 6 ? 1 : n); st.S.completed.add(1); return { phase: st.S.phase, same: st.S === window.S, completed: [...st.S.completed] }; }, n);
    if (n % 2 === 0) await seedOld(f);
    log('  jugando:', JSON.stringify(played)); ok(played.phase === 'atrium', `ciclo ${n}: no entró al atrio`, played.phase);
    const g1 = await snap(f); ok(!g1.ov.length && !g1.off.length, `ciclo ${n} atrio: HUD del juego con cruces o fuera`, JSON.stringify(g1));
    await shot(`c${n}_c_atrio`);
    // (d) cambio de orientación con el juego abierto
    if (n <= 3) {
      await vp(H, W); await sleep(1600); const r1 = await landingOver(); checkOver(r1, `ciclo ${n} girado ${H}×${W}`);
      const g2 = await snap(f); ok(!g2.ov.length && !g2.off.length, `ciclo ${n} girado: HUD del juego con cruces o fuera`, JSON.stringify(g2));
      const cv = await f.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight, window.S.phase, [...window.S.completed]]; });
      ok(cv[0] === cv[2] && cv[1] <= cv[3] && cv[1] > cv[3] * .6 && cv[4] === 'atrium', `ciclo ${n} girado: el lienzo no siguió al giro o se perdió la partida`, JSON.stringify(cv));
      await shot(`c${n}_d_girado`);
      if (n === 3) {
        const m0 = await p.evaluate(() => window.__flauxus.marks());
        await f.evaluate(() => document.getElementById('btnExit').click()); await sleep(1600);
        const c = await closed(); checkClosed(c, 'ciclo 3 salir girado'); await shot('c3_h_salir_girado');
        const pos = (m, y) => Object.entries(m).filter(([, v]) => Array.isArray(v) && y >= v[0] && y < v[1]).map(([k]) => k).join('+');
        log('  salir en horizontal: scrollY', c.scrollY, '· momento', pos(m0, c.scrollY), '· [ JUEGA YA ] visible:', c.cta);
        ok(c.cta, 'ciclo 3: tras girar con el juego abierto y salir, la landing no vuelve al portal', 'scrollY ' + c.scrollY + ' · momento ' + pos(m0, c.scrollY));
        await vp(W, H); await sleep(1800); const c2 = await closed(); await shot('c3_i_salir_girado_vertical');
        const m1 = await p.evaluate(() => window.__flauxus.marks());
        log('  y de vuelta a vertical: scrollY', c2.scrollY, '· momento', pos(m1, c2.scrollY), '· [ JUEGA YA ] visible:', c2.cta);
        ok(c2.cta, 'ciclo 3: tras salir girado y volver a vertical, la landing no está en el portal', 'scrollY ' + c2.scrollY + ' · momento ' + pos(m1, c2.scrollY));
        marks = m1; continue;
      }
      await vp(W, H); await sleep(1600); const r2 = await landingOver(); checkOver(r2, `ciclo ${n} de vuelta a ${W}×${H}`);
      const g3 = await snap(f); ok(!g3.ov.length && !g3.off.length, `ciclo ${n} tras girar: HUD del juego con cruces o fuera`, JSON.stringify(g3));
      if (n === 1) await shot(`c${n}_e_vertical_otra_vez`);
    }
    // salida
    const how = ['', 'Salir', 'history.back()', 'Salir', 'recarga', 'atrás + adelante'][n] || 'Salir';
    log('  salida:', how);
    if (how === 'Salir') {
      const ex = await f.evaluate(() => { const e = document.getElementById('btnExit'); const r = e.getBoundingClientRect(); return e.hidden || getComputedStyle(e).display === 'none' ? null : [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height].map(Math.round); });
      ok(ex && ex[2] >= 44 && ex[3] >= 44, `ciclo ${n}: «Salir» ausente o menor de 44 px`, JSON.stringify(ex));
      if (ex) await p.touchscreen.tap(ex[0], ex[1]); else await p.evaluate(() => document.querySelector('.game-close').click());
    } else if (how === 'history.back()') await p.evaluate(() => history.back());
    else if (how === 'atrás + adelante') { await p.evaluate(() => history.back()); await sleep(900); await p.evaluate(() => history.forward()); }
    else if (how === 'recarga') {
      await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500);
      const c = await closed(); log('  tras recargar:', JSON.stringify(c)); checkClosed(c, `ciclo ${n} tras recargar`); await shot(`c${n}_f_recarga`);
      marks = await start();
      // (e) history.back() tras la recarga: no debe reabrir el juego
      const u0 = p.url(); await p.evaluate(() => history.back()).catch(() => {}); await sleep(1500);
      const u1 = p.url(); log('  history.back() tras recargar:', u0, '→', u1, '· marcos del juego:', frames().length);
      ok(frames().length === 0, `ciclo ${n}: history.back() tras recargar reabrió el juego`);
      if (!u1.startsWith(BASE) || !(await p.evaluate(() => document.documentElement.classList.contains('started')).catch(() => false))) {
        // salió de la página (no había más entradas): volver hacia adelante debe traer la landing sin juego
        await p.goForward({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}); await sleep(2500);
        log('  adelante →', p.url(), '· marcos del juego:', frames().length);
        ok(frames().length === 0, `ciclo ${n}: volver adelante a la landing restauró el juego`);
        if (!p.url().startsWith(BASE)) await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
        marks = await start();
      }
      const c2 = await closed(); checkClosed(c2, `ciclo ${n} tras recarga + atrás`);
      continue;
    }
    await sleep(1400);
    const c = await closed(); log('  de vuelta:', JSON.stringify(c)); checkClosed(c, `ciclo ${n} de vuelta (${how})`);
    ok(c.started, `ciclo ${n}: la landing se perdió al salir`, p.url());
    ok(Math.abs(c.scrollY - y0) < 4, `ciclo ${n}: el scroll de la landing cambió`, `${y0} → ${c.scrollY}`);
    await sleep(600); await shot(`c${n}_g_de_vuelta`);
    const m = await p.metrics(); log(`  métricas: documentos ${m.Documents}, marcos ${m.Frames}, nodos ${m.Nodes}, oyentes ${m.JSEventListeners}, heap ${(m.JSHeapUsedSize / 1048576).toFixed(1)} MB (inicio: ${met0.Documents}/${met0.Frames}/${met0.Nodes}/${met0.JSEventListeners}/${(met0.JSHeapUsedSize / 1048576).toFixed(1)})`);
  }
  // la radiografía vuelve a funcionar en la landing tras los ciclos
  await p.evaluate(() => scrollTo(0, 0)); await sleep(2800);
  await p.touchscreen.touchStart(W / 2, H * .5); await sleep(800);
  const on = await p.evaluate(() => { const l = document.getElementById('lens'), s = getComputedStyle(l); return { op: +(+s.opacity).toFixed(2), w: Math.round(l.getBoundingClientRect().width), display: s.display }; });
  await shot('z_radiografia_m1'); await p.touchscreen.touchEnd(); await sleep(1700);
  const off = await p.evaluate(() => { const l = document.getElementById('lens'), s = getComputedStyle(l); return { op: +(+s.opacity).toFixed(2), on: l.classList.contains('on') }; });
  log('radiografía en M1 al tocar:', JSON.stringify(on), '· al soltar:', JSON.stringify(off));
  ok(on.op > .5 && on.w > 60, 'la radiografía ya no funciona en la landing tras los ciclos', JSON.stringify(on));
  ok(off.op < .05, 'la radiografía no se apaga al soltar', JSON.stringify(off));

  // ?room=5 y ?room=6 directos, con una partida vieja sembrada: sin progreso heredado
  for (const room of [5, 6]) {
    await p.evaluate(() => localStorage.setItem('flauxus.progress.v1', JSON.stringify({ completed: [1, 2, 3, 4, 5, 6], metrics: { 1: { t: 30 } } })));
    await p.goto(`${BASE}/juego/?room=${room}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction((room) => { const pr = document.getElementById('preloader'); return window.S && pr && !pr.classList.contains('on') && window.S.room === room && window.S.ready; }, { timeout: 90000, polling: 250 }, room);
    await sleep(1500);
    const s = await gameState(p.mainFrame()); log(`?room=${room} directo:`, JSON.stringify(s)); checkFresh(s, `?room=${room} directo`, room);
    const g = await snap(p); ok(!g.ov.length && !g.off.length, `?room=${room}: HUD con cruces o fuera`, JSON.stringify(g));
    await shot(`room${room}_directo`);
    // recarga: sigue sin heredar
    await p.evaluate(async (room) => { const st = await import('/juego/core/state.js'); st.S.completed.add(room); st.S.completed.add(1); }, room);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction((room) => { const pr = document.getElementById('preloader'); return window.S && pr && !pr.classList.contains('on') && window.S.room === room && window.S.ready; }, { timeout: 90000, polling: 250 }, room);
    await sleep(800); const s2 = await gameState(p.mainFrame()); checkFresh(s2, `?room=${room} tras recargar`, room);
  }
} catch (e) { log('ERROR', e.stack || e.message); fails.push('EXCEPCIÓN: ' + e.message); await shot('error').catch(() => {}); }
log('errores de consola/página:', JSON.stringify(errs));
log('peticiones abortadas:', aborted.length, JSON.stringify([...new Set(aborted.map((a) => a.split(' ')[0]))]));
log(`RESUMEN ${W}×${H}: ${checks - fails.length}/${checks} OK`);
for (const f of fails) log(' ✗', f);
await b.close();
