// Integración landing ↔ juego: portal, notas con E, botón «Salir» único, retorno y cambio de tamaño en vivo.
import path from 'node:path';
import { launch, sleep, SHOTS, BASE } from './lib.mjs';
const b = await launch();
const p = await b.newPage(); await p.setViewport({ width: 1366, height: 768 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
const shot = (n) => p.screenshot({ path: path.join(SHOTS, 'integ_' + n + '.jpg'), type: 'jpeg', quality: 75 });
const log = (...a) => console.log(...a);
const frame = () => p.frames().find((f) => f.url().includes('/juego/'));
const gameUp = async (room) => { for (let i = 0; i < 400; i++) { const f = frame(); if (f) { const ok = await f.evaluate((room) => { const pre = document.getElementById('preloader'); return !!(window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true)); }, room).catch(() => false); if (ok) return f; } await sleep(250); } throw new Error('el juego no cargó'); };
const corner = async (f) => ({
  landingClose: await p.evaluate(() => { const e = document.querySelector('.game-close'); const s = getComputedStyle(e); return s.display !== 'none' && !document.getElementById('game').hidden; }),
  gameExit: await f.evaluate(() => { const e = document.getElementById('btnExit'); const r = e.getBoundingClientRect(); return e.hidden ? null : [r.left, r.top, r.right, r.bottom].map(Math.round); }),
  back: await f.evaluate(() => { const e = document.getElementById('btnBack'); const s = getComputedStyle(e); if (s.display === 'none') return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); }),
});
const inter = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
try {
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000 });
  await sleep(1500); await p.click('.press-start');
  await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); await sleep(1500);
  const marks = await p.evaluate(() => window.__flauxus.marks());
  // 1) portal → juego
  await p.evaluate(([s, e]) => scrollTo(0, e - (e - s) * .12), marks.m2);
  await p.waitForSelector('#osd .cta.on', { timeout: 20000 }); await sleep(800); await shot('1_portal');
  await p.keyboard.press('KeyE');
  let f = await gameUp(0); await sleep(1000);
  log('1 portal+E → juego abierto:', !!f, '· marcos:', (await p.$$('#game iframe')).length, JSON.stringify(await corner(f)));
  await shot('2_menu_embebido');
  await f.evaluate(() => document.getElementById('btnStart').click()); await sleep(2500);
  // 2) entrar a una sala desde el atrio y comprobar los dos botones
  await f.evaluate(async () => (await import('/juego/flow.js')).enterRoom(5)); f = await gameUp(5); await sleep(1500);
  let c = await corner(f); log('2 sala SOL: salir', c.gameExit, '· volver', c.back, '· ¿se pisan?', inter(c.gameExit, c.back), '· botón de la landing visible:', c.landingClose);
  await shot('3_sala_embebida');
  // 3) cambio de tamaño en vivo, dentro de la sala
  for (const [w, h] of [[390, 844], [844, 390], [1024, 768], [2560, 1080], [1366, 768]]) {
    await p.setViewport({ width: w, height: h }); await sleep(1200); c = await corner(f);
    log(`3 redimensionar ${w}x${h}: salir`, c.gameExit, 'volver', c.back, '¿se pisan?', inter(c.gameExit, c.back));
    if (w === 390 || w === 844) await shot(`4_sala_${w}x${h}`);
  }
  // 4) volver al atrio y salir a la landing con el botón del juego
  await f.evaluate(() => document.getElementById('btnBack').click());
  await p.waitForFunction(() => true); for (let i = 0; i < 200; i++) { const ok = await f.evaluate(() => window.S.room === 0 && !window.S.busy && !document.getElementById('preloader').classList.contains('on')).catch(() => false); if (ok) break; await sleep(250); }
  log('4 volver al atrio: fase', await f.evaluate(() => window.S.phase));
  const y0 = await p.evaluate(() => scrollY);
  await f.evaluate(() => document.getElementById('btnExit').click()); await sleep(900);
  log('5 salir: juego cerrado', await p.evaluate(() => document.getElementById('game').hidden), '· marcos', (await p.$$('#game iframe')).length, '· scroll conservado', Math.abs((await p.evaluate(() => scrollY)) - y0) < 4);
  // 5) nota + E → sala concreta, y el progreso guardado sigue ahí
  await p.evaluate(([s, e]) => scrollTo(0, s + (e - s) * .3), marks.m5); await sleep(2500);
  await p.evaluate(() => [...document.querySelectorAll('#m5 .note')][5].focus()); await sleep(400);
  await p.keyboard.press('KeyE'); await p.keyboard.press('KeyE');
  f = await gameUp(6);
  log('6 nota LA♯ + E → sala', await f.evaluate(() => window.S.room), '· marcos', (await p.$$('#game iframe')).length);
  await shot('5_nota_la');
  await p.keyboard.press('Escape'); await sleep(300);
  log('errores de página:', errs);
} catch (e) { log('ERROR', e.message); await shot('error'); }
await b.close();
