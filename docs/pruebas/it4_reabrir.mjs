// Reapertura inmediata: cerrar el juego y volver a abrirlo en la misma tarea (antes de que el navegador procese
// el «atrás» que retira la entrada del historial). El juego nuevo debe quedar abierto y con su entrada propia.
import { launch, sleep, BASE } from './lib.mjs';
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
const frame = () => p.frames().find((f) => f.url().includes('/juego/'));
const gameUp = async () => { for (let i = 0; i < 400; i++) { const f = frame(); if (f) { const ok = await f.evaluate(() => { const pr = document.getElementById('preloader'); return !!(window.S && pr && !pr.classList.contains('on')); }).catch(() => false); if (ok) return f; } await sleep(250); } throw new Error('el juego no cargó'); };
const state = () => p.evaluate(() => ({ abierto: !document.getElementById('game').hidden, marcos: document.querySelectorAll('iframe').length, clase: document.documentElement.classList.contains('game-open'), hist: history.length, flag: !!history.state?.flauxusGame, lente: getComputedStyle(document.getElementById('lens')).display }));
try {
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000 });
  await sleep(1000); await p.tap('.press-start');
  await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); await sleep(3000);
  const marks = await p.evaluate(() => window.__flauxus.marks());
  await p.evaluate(([s, e]) => scrollTo(0, e - (e - s) * .12), marks.m2); await p.waitForSelector('#osd .cta.on', { timeout: 20000 }); await sleep(700);
  await p.tap('#osd .cta'); await p.waitForFunction(() => !document.getElementById('game').hidden, { timeout: 8000 });
  await gameUp(); await sleep(500);
  console.log('abierto:', JSON.stringify(await state()));
  // cerrar y reabrir sin ceder el hilo
  await p.evaluate(() => { document.querySelector('.game-close').click(); document.querySelector('#osd .cta').click(); });
  await sleep(1500);
  const s1 = await state();
  console.log('cerrar + reabrir en la misma tarea:', JSON.stringify(s1), s1.abierto && s1.marcos === 1 && s1.flag ? 'OK' : 'FALLA');
  const f = await gameUp();
  console.log('juego nuevo:', JSON.stringify(await f.evaluate(() => ({ fase: window.S.phase, sala: window.S.room }))));
  // «atrás» lo cierra con normalidad
  await p.goBack({ timeout: 3000 }).catch(() => {}); await sleep(900);
  const s2 = await state();
  console.log('atrás:', JSON.stringify(s2), !s2.abierto && s2.marcos === 0 && !s2.flag ? 'OK' : 'FALLA');
  // y la landing sigue viva (misma página, sin recarga)
  console.log('landing viva:', await p.evaluate(() => document.documentElement.classList.contains('started')), '· errores:', JSON.stringify(errs));
} catch (e) { console.log('ERROR', e.message); }
await b.close();
