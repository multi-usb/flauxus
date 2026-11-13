// Revisión it4: girar el teléfono conserva el punto de lectura (momento y fracción), sin rebobinado; y con el juego
// abierto el resto de la página queda inerte (Tab no sale del juego) y vuelve a estar activo al cerrar.
import path from 'node:path';
import { launch, sleep, SHOTS, BASE } from './lib.mjs';
const SIZES = (process.argv[2] || '390x844,360x640').split(',').map((s) => s.split('x').map(Number));
const b = await launch(); let fails = 0, checks = 0;
const ok = (c, msg, extra = '') => { checks++; if (!c) { fails++; console.log('   FALLO ·', msg, extra); } };
for (const [W, H] of SIZES) {
  const p = await b.newPage();
  const vp = (w, h) => p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await vp(W, H);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000, polling: 200 });
  await sleep(1200); await p.tap('.press-start');
  await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); await sleep(3500);
  const st = () => p.evaluate(() => { const m = window.__flauxus.marks(), y = scrollY; let id = 'm1'; for (const k in m) if (m[k][0] <= y + .5) id = k; return { y: Math.round(y), id, f: +((y - m[id][0]) / Math.max(1, m[id][1] - m[id][0])).toFixed(3), dom: document.documentElement.dataset.moment, rew: document.getElementById('hud').classList.contains('rewinding'), total: document.documentElement.scrollHeight - innerHeight, ox: document.documentElement.scrollWidth > innerWidth + 1 }; });
  console.log(`=== ${W}x${H}`);
  for (const [m, f] of [['m1', .5], ['m2', .88], ['m3', .5], ['m4', .45], ['m5', .6], ['m6', .6]]) {
    await vp(W, H); await sleep(1500);
    const marks = await p.evaluate(() => window.__flauxus.marks());
    await p.evaluate((y) => scrollTo(0, y), Math.round(marks[m][0] + (marks[m][1] - marks[m][0]) * f)); await sleep(1800);
    const a = await st();
    await vp(H, W); let rew = false; for (let i = 0; i < 9; i++) { await sleep(200); rew = rew || (await st()).rew; }
    const c = await st(); await p.screenshot({ path: path.join(SHOTS, `it4_fix_giro_${W}x${H}_${m}_h.jpg`), type: 'jpeg', quality: 72 });
    await vp(W, H); for (let i = 0; i < 9; i++) { await sleep(200); rew = rew || (await st()).rew; }
    const d = await st();
    console.log(`  ${m}@${f}: vertical y=${a.y} (${a.id} ${a.f}) → horizontal y=${c.y} (${c.id} ${c.f}, dom ${c.dom}) → vertical y=${d.y} (${d.id} ${d.f}) · rebobinado ${rew}`);
    ok(c.id === a.id && c.dom === a.id && Math.abs(c.f - a.f) < .03, `${m}: al girar cambió de momento o de fracción`, JSON.stringify([a, c]));
    ok(d.id === a.id && Math.abs(d.y - a.y) <= 6, `${m}: al volver a vertical no regresó al mismo punto`, JSON.stringify([a, d]));
    ok(!rew, `${m}: el giro disparó el rebobinado`); ok(!c.ox && !d.ox, `${m}: desborde horizontal`);
  }
  // juego abierto: resto de la página inerte
  await vp(W, H); await sleep(1200);
  const marks = await p.evaluate(() => window.__flauxus.marks());
  await p.evaluate(([s, e]) => scrollTo(0, e - (e - s) * .12), marks.m2); await p.waitForSelector('#osd .cta.on', { timeout: 20000 }); await sleep(900);
  await p.tap('#osd .cta'); await p.waitForFunction(() => !document.getElementById('game').hidden, { timeout: 8000 }); await sleep(400);
  const open = await p.evaluate(() => ({ inertes: [...document.body.children].filter((e) => e.inert).map((e) => e.id || e.tagName), noInertes: [...document.body.children].filter((e) => !e.inert && !/SCRIPT|NOSCRIPT/.test(e.tagName)).map((e) => e.id || e.className),
    visibles: [...document.querySelectorAll('body *')].filter((e) => !e.closest('#game') && getComputedStyle(e).visibility === 'visible' && getComputedStyle(e).display !== 'none' && e.getClientRects().length).length }));
  const foci = [];
  for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); foci.push(await p.evaluate(() => { const a = document.activeElement; return a.closest('#game') ? 'juego:' + a.tagName : (a === document.body ? 'body' : 'LANDING:' + (a.id || a.className)); })); }
  console.log('  juego abierto · inertes:', open.inertes.join(','), '· no inertes:', open.noInertes.join(','), '· visibles fuera del juego:', open.visibles, '· foco con Tab ×8:', [...new Set(foci)].join(' '));
  ok(open.noInertes.length === 1 && open.noInertes[0] === 'game', 'hermanos de #game sin inert', open.noInertes.join(','));
  ok(open.visibles === 0, 'elementos de la landing con visibility visible bajo el juego', String(open.visibles));
  ok(!foci.some((x) => x.startsWith('LANDING')), 'Tab llevó el foco a la landing', foci.join(' '));
  await p.keyboard.press('Escape').catch(() => {}); await sleep(300);
  if (await p.evaluate(() => !document.getElementById('game').hidden)) { await p.evaluate(() => document.querySelector('.game-close').click()); }
  await sleep(1500);
  const closed = await p.evaluate(() => ({ oculto: document.getElementById('game').hidden, inertes: [...document.body.children].filter((e) => e.inert).length, cta: !!document.querySelector('#osd .cta.on'), ctaVis: getComputedStyle(document.querySelector('#osd .cta')).visibility }));
  console.log('  juego cerrado:', JSON.stringify(closed));
  ok(closed.oculto && closed.inertes === 0 && closed.cta && closed.ctaVis === 'visible', 'al cerrar quedó algo inerte u oculto', JSON.stringify(closed));
  console.log('  errores', JSON.stringify(errs)); ok(!errs.length, 'errores de página');
  await p.close();
}
await b.close();
console.log(`RESUMEN giro: ${checks - fails}/${checks} OK`);
