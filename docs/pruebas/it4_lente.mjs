// Radiografía sobre el juego + reinicio completo: landing → juego → landing en móvil emulado (táctil).
// Uso: node it4_lente.mjs antes|despues
import path from 'node:path';
import { launch, sleep, SHOTS, BASE } from './lib.mjs';
const pre = process.argv[2] || 'antes';
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
const shot = (n) => p.screenshot({ path: path.join(SHOTS, `it4_${pre}_lente_${n}.jpg`), type: 'jpeg', quality: 78 });
const log = (...a) => console.log(...a);
const frame = () => p.frames().find((f) => f.url().includes('/juego/'));
const gameUp = async (room = 0) => { for (let i = 0; i < 400; i++) { const f = frame(); if (f) { const ok = await f.evaluate((room) => { const pr = document.getElementById('preloader'); return !!(window.S && pr && !pr.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true)); }, room).catch(() => false); if (ok) return f; } await sleep(250); } throw new Error('el juego no cargó'); };
// Qué capas de la landing siguen pintándose por encima del juego
const over = () => p.evaluate(() => {
  const g = document.getElementById('game'); const gz = +getComputedStyle(g).zIndex || 0; const out = [];
  const vis = (el) => { let e = el; while (e && e !== document.documentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .02) return false; e = e.parentElement; } return true; };
  for (const el of document.querySelectorAll('body > *')) {
    if (el === g || el.contains(g)) continue; const s = getComputedStyle(el); if (s.position !== 'fixed' && s.position !== 'absolute') continue;
    const z = +s.zIndex || 0; if (z <= gz || !vis(el)) continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    out.push(`${el.id || el.className}(z${z}, op ${(+s.opacity).toFixed(2)}, ${Math.round(r.width)}x${Math.round(r.height)})`);
  }
  const l = document.getElementById('lens'), ls = getComputedStyle(l);
  return { gameOpen: !g.hidden, gz, encima: out, lente: { op: +(+ls.opacity).toFixed(2), display: ls.display, on: l.classList.contains('on'), w: Math.round(l.getBoundingClientRect().width) }, marcos: document.querySelectorAll('#game iframe').length };
});
const start = async () => {
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000 });
  await sleep(1200); await p.tap('.press-start');
  await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); await sleep(3500);
  return p.evaluate(() => window.__flauxus.marks());
};
const toPortal = async (marks) => { await p.evaluate(([s, e]) => scrollTo(0, e - (e - s) * .12), marks.m2); await p.waitForSelector('#osd .cta.on', { timeout: 20000 }); await sleep(900); };
// toque sostenido sobre el CTA (queda encima del cuerpo de María Clara): la radiografía se abre justo al entrar
const tapCta = async (hold = 160) => { const r = await p.evaluate(() => { const c = document.querySelector('#osd .cta').getBoundingClientRect(); return [c.left + c.width * .78, c.top + c.height * .4]; }); await p.touchscreen.touchStart(r[0], r[1]); await sleep(hold); await p.touchscreen.touchEnd(); };
try {
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  let marks = await start();
  for (let n = 1; n <= 3; n++) {
    await toPortal(marks);
    await tapCta(n === 2 ? 420 : 160);
    await p.waitForFunction(() => !document.getElementById('game').hidden, { timeout: 8000 });
    await sleep(700); const a = await over(); await shot(`${n}a_abriendo`);
    const f = await gameUp(0); await sleep(600); const c = await over(); await shot(`${n}b_juego`);
    log(`ciclo ${n} · al abrir:`, JSON.stringify(a)); log(`ciclo ${n} · juego listo:`, JSON.stringify(c));
    if (n === 1) { // cambio de orientación con el juego abierto
      await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(1500); log('  horizontal 844x390:', JSON.stringify(await over())); await shot('1c_horizontal');
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(1500); log('  vertical 390x844:', JSON.stringify(await over()));
    }
    // avanzar dentro del juego para comprobar después que no se hereda nada
    const st = await f.evaluate(async () => { document.getElementById('btnStart')?.click(); await new Promise((r) => setTimeout(r, 2500)); return { phase: window.S.phase, room: window.S.room, ls: Object.keys(localStorage).filter((k) => k.startsWith('flauxus')) }; }).catch((e) => ({ err: e.message }));
    log('  dentro del juego:', JSON.stringify(st));
    if (n === 1) { await f.evaluate(() => document.getElementById('btnExit').click()); log('  salida: Salir del juego (flauxus:exit)'); }
    else if (n === 2) { await p.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}); log('  salida: atrás del navegador'); }
    else { await p.evaluate(() => window.focus()); await p.keyboard.press('Escape'); log('  salida: Escape'); }
    await sleep(1200);
    const still = await p.evaluate(() => document.documentElement.classList.contains('started')).catch(() => false);
    if (!still) { log('  LA LANDING SE PERDIO AL SALIR →', p.url()); await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' }); marks = await start(); continue; }
    const d = await over(); await shot(`${n}d_de_vuelta`);
    log('  de vuelta:', JSON.stringify(d), '· marcos vivos:', p.frames().length - 1, '· game-open:', await p.evaluate(() => document.documentElement.classList.contains('game-open')), '· history.length', await p.evaluate(() => history.length), '· estado', JSON.stringify(await p.evaluate(() => history.state)));
    // la radiografía vuelve a funcionar limpia: toque sobre el cuerpo en M1
    if (n === 3) { await p.evaluate(() => scrollTo(0, 0)); await sleep(2500); await p.touchscreen.touchStart(195, 430); await sleep(700); const on = await over(); await shot('3e_radiografia_m1'); await p.touchscreen.touchEnd(); await sleep(1600); const off = await over(); log('  radiografía en M1 al tocar:', JSON.stringify(on.lente), '· al soltar:', JSON.stringify(off.lente)); }
  }
  // sala directa desde M5 (?room=N) y luego portal: debe empezar en el primer nivel, sin progreso heredado
  await p.evaluate(([s, e]) => scrollTo(0, s + (e - s) * .3), marks.m5); await sleep(2800);
  await p.evaluate(() => document.querySelector('#m5 .sala-prompt').click());
  let f = await gameUp(); await sleep(1500);
  log('M5 → sala directa:', JSON.stringify(await f.evaluate(() => ({ url: location.search, room: window.S.room, phase: window.S.phase }))), JSON.stringify((await over()).encima));
  await f.evaluate(() => document.getElementById('btnExit')?.click()); await sleep(1000);
  if (!(await p.evaluate(() => document.getElementById('game').hidden))) { await p.evaluate(() => document.querySelector('.game-close').click()); await sleep(600); }
  await toPortal(marks); await tapCta(); f = await gameUp(0); await sleep(800);
  log('portal después de sala directa:', JSON.stringify(await f.evaluate(() => ({ url: location.search, room: window.S.room, phase: window.S.phase, ls: Object.keys(localStorage).filter((k) => k.startsWith('flauxus')) }))));
  // recarga con el juego abierto
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500);
  log('recarga con el juego abierto:', JSON.stringify(await over()), '· estado', JSON.stringify(await p.evaluate(() => history.state)), '· history.length', await p.evaluate(() => history.length));
  await shot('5_recarga');
  log('errores de página:', JSON.stringify(errs));
} catch (e) { log('ERROR', e.message); await shot('error'); }
await b.close();
