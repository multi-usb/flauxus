// Iteración 5 · menú principal del juego: centrado medido (márgenes del panel respecto a la ventana), botón principal
// a la vista, sin scroll, sin pisar «Salir» (embebido). Directo y embebido, con y sin ?entry, con ?dev.
// Uso: node it5_jmenu.mjs [etiqueta] [tamaños separados por coma]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, SHOTS, BASE, DIR } from './lib.mjs';

const tag = process.argv[2] || 'antes';
const ALL = [[320, 568, 1], [360, 640, 1], [375, 667, 1], [390, 844, 1], [412, 915, 1], [568, 320, 1], [667, 375, 1], [844, 390, 1], [768, 1024, 1], [1024, 768, 1], [1024, 768, 0], [1366, 768, 0], [1920, 1080, 0], [1366, 500, 0]];
const pick = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const SIZES = pick ? ALL.filter(([w, h]) => pick.has(`${w}x${h}`)) : ALL;
const VARIANTS = [['', 0], ['', 1], ['?entry=fanzine', 0], ['?entry=fanzine', 1], ['?entry=poster', 1], ['?entry=cards&cards=PAUSA,RETARDA,MI%20INTENCI%C3%93N', 0], ['?dev', 0], ['?entry=cards&dev', 1]];

const measure = () => {
  const W = innerWidth, H = innerHeight, box = document.querySelector('#intro .box'), r = box.getBoundingClientRect();
  const vis = (e) => { if (!e) return null; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || e.hidden) return null; const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2 ? q : null; };
  const ex = vis(document.getElementById('btnExit')), bt = vis(document.getElementById('btnStart'));
  const inside = (q) => q && q.top >= Math.max(0, r.top) - .5 && q.bottom <= Math.min(H, r.bottom) + .5 && q.left >= -.5 && q.right <= W + .5;
  const parts = ['.eyebrow', '.big', '.lede', '.how', '#btnStart', '.note', '.sats'].map((q) => { const e = box.querySelector(q), v = vis(e); return q + (v ? (inside(v) ? '' : '!FUERA') : '(oculto)'); });
  const sats = [...box.querySelectorAll('.sats a')].map((a) => vis(a));
  const fs = (q) => { const e = box.querySelector(q); return e && vis(e) ? +parseFloat(getComputedStyle(e).fontSize).toFixed(1) : null; };
  return {
    box: [r.left, r.top, r.right, r.bottom].map((v) => +v.toFixed(1)),
    dx: +(r.left - (W - r.right)).toFixed(1), dy: +(r.top - (H - r.bottom)).toFixed(1),
    scroll: box.scrollHeight - box.clientHeight, btn: !!inside(bt), btnH: bt ? Math.round(bt.height) : 0,
    exit: ex ? [ex.left, ex.top, ex.right, ex.bottom].map(Math.round) : null,
    pisaSalir: !!(ex && ex.left < r.right && r.left < ex.right && ex.top < r.bottom && r.top < ex.bottom),
    fuera: r.left < 0 || r.top < 0 || r.right > W || r.bottom > H,
    satsVis: sats.filter((q) => inside(q)).length + '/' + sats.length, satMinH: Math.min(...sats.filter(Boolean).map((q) => Math.round(q.height))),
    parts: parts.filter((p) => /!|oculto/.test(p)).join(' '),
    fs: { eyebrow: fs('.eyebrow'), lede: fs('.lede'), how: fs('.how'), btn: fs('#btnStart'), note: fs('.note'), satsK: fs('.sats-k'), sat: fs('.sats a'), small: fs('.sats a small') },
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
};

const browser = await launch();
const out = []; let bad = 0;
for (const [w, h, touch] of SIZES) for (const [q, emb] of VARIANTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  const url = BASE + '/juego/' + q; let ctx = page;
  try {
    if (emb) {
      await page.goto(BASE + '/humans.txt');
      await page.evaluate((url) => { document.body.innerHTML = ''; document.body.style.margin = 0; const mv = document.createElement('meta'); mv.name = 'viewport'; mv.content = 'width=device-width, initial-scale=1'; document.head.append(mv); const f = document.createElement('iframe'); f.src = url; f.allow = 'autoplay'; f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0'; document.body.append(f); }, url);
      await sleep(600); ctx = page.frames().find((f) => f.url().includes('/juego/'));
    } else await page.goto(url, { waitUntil: 'domcontentloaded' });
    await ctx.waitForFunction(() => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on'); }, { timeout: 90000, polling: 250 });
    await sleep(1200);
    const m = await ctx.evaluate(measure);
    const name = `${w}x${h}${touch ? 't' : 'm'}${emb ? '_emb' : ''}${q ? '_' + q.replace(/[?&]/g, '').replace(/entry=/, '').replace(/cards=.*?(dev|$)/, '$1').replace(/=/g, '') : ''}`;
    const ok = Math.abs(m.dx) <= 4 && Math.abs(m.dy) <= 4 && m.btn && m.scroll <= 1 && !m.pisaSalir && !m.fuera && !errs.length;
    if (!ok) bad++;
    out.push({ name, ...m, errs });
    console.log(`${ok ? 'ok ' : 'XX '} ${name.padEnd(28)} caja ${m.box.join(',').padEnd(26)} dx ${String(m.dx).padStart(6)} dy ${String(m.dy).padStart(6)} scroll ${String(m.scroll).padStart(4)} btn ${m.btn ? 'sí' : 'NO'} (${m.btnH}) sats ${m.satsVis} (${m.satMinH}px) ${m.pisaSalir ? 'PISA SALIR ' : ''}${m.fuera ? 'FUERA ' : ''}${m.parts} fs ${JSON.stringify(m.fs)} ${errs.join('|')}`);
    await page.screenshot({ path: path.join(SHOTS, `it5_menu_${tag}_${name}.jpg`), type: 'jpeg', quality: 72 });
  } catch (e) { bad++; console.log('ERROR', w, h, q, emb, String(e.message).slice(0, 160)); }
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(DIR, `it5_jmenu_${tag}.json`), JSON.stringify(out, null, 1));
console.log(`\n${out.length} combinaciones · fuera de tolerancia: ${bad} · reduced-motion: ${out[0]?.reduce}`);
process.exit(bad ? 1 : 0);
