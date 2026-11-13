// Reinicio completo del juego (lado landing): contexto WebGL liberado, «adelante» no reabre, pageshow persistido,
// salir y volver a la página (bfcache), ◀◀ de respaldo durante la carga y capas de la landing ocultas.
import { launch, sleep, BASE } from './lib.mjs';
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
const log = (...a) => console.log(...a);
const frame = () => p.frames().find((f) => f.url().includes('/juego/'));
const gameUp = async () => { for (let i = 0; i < 400; i++) { const f = frame(); if (f) { const ok = await f.evaluate(() => { const pr = document.getElementById('preloader'); return !!(window.S && pr && !pr.classList.contains('on')); }).catch(() => false); if (ok) return f; } await sleep(250); } throw new Error('el juego no cargó'); };
const state = () => p.evaluate(() => ({ abierto: !document.getElementById('game').hidden, marcos: document.querySelectorAll('iframe').length, clase: document.documentElement.classList.contains('game-open'), hist: history.length, flag: !!history.state?.flauxusGame, lente: getComputedStyle(document.getElementById('lens')).display }));
const start = async () => {
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000 });
  await sleep(1000); await p.tap('.press-start');
  await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); await sleep(3000);
  return p.evaluate(() => window.__flauxus.marks());
};
const openGame = async (marks) => { await p.evaluate(([s, e]) => scrollTo(0, e - (e - s) * .12), marks.m2); await p.waitForSelector('#osd .cta.on', { timeout: 20000 }); await sleep(700); const dbg = await p.evaluate(() => { const c = document.querySelector('#osd .cta'); const r = c.getBoundingClientRect(); const o = document.getElementById('osd'); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: [r.left, r.top, r.width, r.height].map(Math.round), osd: o.className, vis: getComputedStyle(c).visibility, top: t && (t.id || t.className), y: scrollY, m: document.documentElement.dataset.moment }; }); await p.tap('#osd .cta').catch((e) => { console.log('  tap falló', JSON.stringify(dbg)); throw e; }); await p.waitForFunction(() => !document.getElementById('game').hidden, { timeout: 8000 }); };
try {
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  let marks = await start();
  // 1) contexto WebGL: se guarda una referencia al contexto del juego y se comprueba que queda perdido al salir
  await openGame(marks); let f = await gameUp(); await sleep(500);
  const n = await f.evaluate(() => { window.top.__ctx = [...document.querySelectorAll('canvas')].map((c) => c.getContext('webgl2') || c.getContext('webgl')).filter(Boolean); return window.top.__ctx.length; });
  const visibles = await p.evaluate(() => [...document.body.children].filter((e) => e.id !== 'game' && !/SCRIPT|NOSCRIPT/.test(e.tagName) && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').map((e) => e.id || e.className));
  log('1 juego abierto:', JSON.stringify(await state()), '· contextos WebGL del juego:', n, '· capas de la landing aún visibles:', JSON.stringify(visibles));
  await f.evaluate(() => document.getElementById('btnExit').click()); await sleep(800);
  log('  tras «Salir»:', JSON.stringify(await state()), '· contextos perdidos:', await p.evaluate(() => window.__ctx.map((g) => g.isContextLost())), '· marcos del navegador:', p.frames().length - 1);
  // 2) «adelante» no reabre el juego
  await p.goForward({ timeout: 3000 }).catch(() => {}); await sleep(900);
  log('2 botón adelante:', JSON.stringify(await state()), '· landing viva:', await p.evaluate(() => document.documentElement.classList.contains('started')));
  // 3) ◀◀ de respaldo mientras el juego todavía carga
  await openGame(marks);
  const c = await p.evaluate(() => { const e = document.querySelector('.game-close'); const r = e.getBoundingClientRect(); const o = { visible: getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden', w: Math.round(r.width), h: Math.round(r.height), listo: document.getElementById('game').classList.contains('game-ready') }; e.click(); return o; }); await sleep(700);
  log('3 ◀◀ de respaldo durante la carga:', JSON.stringify(c), '→', JSON.stringify(await state()));
  // 4) pageshow persistido (simulado) con el juego abierto: nunca se restaura
  await openGame(marks); f = await gameUp(); await f.evaluate(() => document.getElementById('btnStart')?.click()); await sleep(1500);
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await sleep(900);
  log('4 pageshow persistido (simulado):', JSON.stringify(await state()));
  // 5) salir a otra página con el juego abierto y volver con «atrás» (bfcache real si el navegador lo usa)
  await openGame(marks); f = await gameUp(); await f.evaluate(() => document.getElementById('btnStart')?.click()); await sleep(1200);
  await p.evaluate(() => { addEventListener('pageshow', (e) => { window.__persisted = e.persisted; }); });
  await p.goto(BASE + '/brand/flauxus-iso.svg', { waitUntil: 'load' }); await sleep(500);
  await p.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}); await sleep(600);
  // puede caer en la entrada del juego (misma página): un «atrás» más la consume sola
  const persisted = await p.evaluate(() => window.__persisted);
  await sleep(1500);
  log('5 salir y volver:', persisted === true ? 'restaurada desde bfcache' : 'recargada (sin bfcache)', JSON.stringify(await state()), '· url', p.url().replace(BASE, ''));
  // 6) tras todo: una apertura nueva empieza en la portada del juego
  if (!(await p.evaluate(() => document.documentElement.classList.contains('started')))) marks = await start();
  await openGame(marks); f = await gameUp(); await sleep(600);
  log('6 apertura nueva:', JSON.stringify(await f.evaluate(() => ({ fase: window.S.phase, sala: window.S.room, url: location.pathname + location.search }))), JSON.stringify(await state()));
  log('errores de página:', JSON.stringify(errs));
} catch (e) { log('ERROR', e.message); }
await b.close();
