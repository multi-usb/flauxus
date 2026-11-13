// Matriz de superposiciones del juego: salas × estados × resoluciones (directo y embebido en un iframe).
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, SEL, SHOTS, BASE, DIR } from './lib.mjs';

const SIZES = [[320, 568, 1], [375, 667, 1], [390, 844, 1], [430, 932, 1], [844, 390, 1], [768, 1024, 1], [1024, 768, 0], [1366, 768, 0], [1440, 900, 0], [1920, 1080, 0], [2560, 1080, 0]];
const EMB = [[390, 844, 1], [844, 390, 1], [1024, 768, 0], [1366, 768, 0]];
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6];
const MODE = process.argv[4] || 'todo'; // todo | directo | embebido
const shotsFor = new Set((process.argv[3] || '390x844,1366x768').split(','));

const snapFn = (SEL) => {
  const W = innerWidth, H = innerHeight, out = {};
  for (const q of SEL) {
    const e = document.querySelector(q); if (!e) continue;
    let v = true, p = e;
    while (p && p !== document.documentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) { v = false; break; } p = p.parentElement; }
    if (!v) continue;
    const r = e.getBoundingClientRect(); if (r.width < 3 || r.height < 3) continue;
    out[q] = [r.left, r.top, r.right, r.bottom].map(Math.round);
  }
  const k = Object.keys(out), ov = [], off = [];
  for (const a of k) { const r = out[a]; if (a !== '#epInner' && (r[0] < -1 || r[1] < -1 || r[2] > W + 1 || r[3] > H + 1)) off.push(a.replace('#', '') + '[' + r.join(',') + ']'); }
  for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) {
    const a = out[k[i]], b = out[k[j]];
    if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) ov.push(k[i] + '×' + k[j]);
  }
  return { ov, off, n: k.length };
};

async function run(browser, [w, h, touch], room, embedded) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  const url = BASE + '/juego/' + (room ? '?room=' + room : '');
  let ctx = page;
  if (embedded) {
    await page.goto(BASE + '/humans.txt');
    await page.evaluate((url) => { document.body.innerHTML = ''; document.body.style.margin = 0; const mv = document.createElement('meta'); mv.name = 'viewport'; mv.content = 'width=device-width, initial-scale=1'; document.head.append(mv); const f = document.createElement('iframe'); f.src = url; f.allow = 'autoplay'; f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0'; document.body.append(f); }, url);
    await sleep(600);
    ctx = page.frames().find((f) => f.url().includes('/juego/'));
  } else await page.goto(url, { waitUntil: 'domcontentloaded' });
  const res = [];
  const tag = `${embedded ? 'emb_' : ''}r${room}_${w}x${h}`;
  const take = async (label) => {
    await ctx.evaluate(() => new Promise((res) => { let n = 0; const f = () => { (document.body.dataset.phase === window.S.phase && ++n >= 12) ? res() : requestAnimationFrame(f); }; requestAnimationFrame(f); setTimeout(res, 6000); }));
    const s = await ctx.evaluate(snapFn, SEL); s.label = label; res.push(s);
    if (shotsFor.has(`${w}x${h}`)) await page.screenshot({ path: path.join(SHOTS, `${tag}_${label}.jpg`), type: 'jpeg', quality: 70 });
  };
  try {
    await ctx.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true); }, { timeout: 90000, polling: 250 }, room);
    await sleep(1100);
    if (!room) {
      await take('menu');
      await ctx.evaluate(() => document.getElementById('btnStart').click()); await sleep(1900); await take('atrio');
      await sleep(1400); await take('atrio+habilidad');
      await ctx.evaluate(() => document.getElementById('btnHelp').click()); await sleep(600); await take('ayuda');
      await ctx.evaluate(() => document.getElementById('helpClose').click());
      await ctx.evaluate(async () => { const st = await import('/juego/core/state.js'); const ep = await import('/juego/ui/epilogue.js'); [1, 2, 3, 4, 5, 6].forEach(i => st.S.completed.add(i)); ep.showEpilogue(); });
      await sleep(900); await take('epilogo');
    } else {
      await take('preludio+voz');
      await ctx.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); V.voStop(); V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); }, room);
      await sleep(900); await take('preludio+entrar');
      for (let k = 0; k < 12; k++) { const ph = await ctx.evaluate(async (room) => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); const Rm = await import(b + 'Rooms.js'); if (window.S.phase === 'brief') return 'brief'; V.VO.armed = true; const tr = Rm.ROOMS[room - 1].trigger || { x: 0, z: 0 }; Pl.player.set(tr.x, Pl.player.y, tr.z); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }, room); if (ph === 'brief') break; await sleep(700); }
      await ctx.waitForFunction(() => window.S.phase === 'brief', { timeout: 8000 }); await sleep(800); await take('ficha');
      await ctx.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(2000); await take('juego');
      await ctx.evaluate(() => { document.getElementById('btnSkip').style.display = 'block'; }); await sleep(250); await take('juego+saltar');
      await ctx.evaluate(async () => (await import('/juego/flow.js')).finish({}, [['Dato', '1'], ['Otro dato', '2 de 3']], false)); await sleep(1400); await take('cierre');
    }
  } catch (e) { res.push({ label: 'ERROR', ov: [String(e.message).slice(0, 120)], off: [], n: 0 }); }
  await page.close();
  return { tag, w, h, room, embedded, states: res.length, bad: res.filter((r) => r.ov.length || r.off.length).map((r) => ({ l: r.label, ov: r.ov, off: r.off })), errs };
}

const jobs = [];
for (const room of only) { if (MODE !== 'embebido') for (const s of SIZES) jobs.push([s, room, false]); if (MODE !== 'directo') for (const s of EMB) jobs.push([s, room, true]); }
const out = []; let i = 0;
const worker = async () => { const browser = await launch(); while (i < jobs.length) { const j = jobs[i++]; out.push(await run(browser, ...j)); process.stderr.write('.'); } await browser.close(); };
await Promise.all([worker(), worker(), worker()]);
out.sort((a, b) => a.tag.localeCompare(b.tag));
fs.writeFileSync(path.join(DIR, 'audit_' + MODE + '.json'), JSON.stringify(out, null, 1));
const bad = out.filter((o) => o.bad.length || o.errs.length);
console.log(`\n${out.length} combinaciones · ${out.reduce((a, o) => a + o.states, 0)} estados · con problemas: ${bad.length}`);
for (const o of bad) console.log(o.tag, JSON.stringify(o.bad), o.errs.slice(0, 2).join(' | '));
