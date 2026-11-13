// Auditoría responsive de toda la landing (iteración 4): desborde horizontal, piezas fuera de pantalla,
// solapes entre textos/botones visibles, objetivos táctiles < 44 px y elementos que tapan a los botones.
// Uso: node it4_audit.mjs [etiqueta] [tamaños separados por coma]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, SHOTS, BASE, DIR } from './lib.mjs';

const tag = process.argv[2] || 'despues';
const ALL = [[320, 568, 1], [360, 640, 1], [375, 667, 1], [390, 844, 1], [412, 915, 1], [844, 390, 1], [667, 375, 1], [640, 360, 1], [568, 320, 1], [768, 1024, 1], [1024, 768, 1], [1366, 768, 0], [1920, 1080, 0], [2560, 1080, 0]];
const pick = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const SIZES = pick ? ALL.filter(([w, h]) => pick.has(`${w}x${h}`)) : ALL;

const collect = ({ scope, touch }) => {
  const W = innerWidth, H = innerHeight;
  const vis = (el) => { let e = el; while (e && e !== document.documentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .12) return false; e = e.parentElement; } return true; };
  const name = (el) => (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : (el.id ? '' : el.tagName.toLowerCase()));
  // rectángulo de lo que realmente se ve: el del texto si es un bloque de texto, recortado a la ventana
  const union = (list) => { let b = null; for (const e of list) { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; b = b ? [Math.min(b[0], r.left), Math.min(b[1], r.top), Math.max(b[2], r.right), Math.max(b[3], r.bottom)] : [r.left, r.top, r.right, r.bottom]; } return b; };
  const box = (el) => {
    const ws = [...el.querySelectorAll('.w')];
    if (ws.length) return union(ws.filter((w) => +getComputedStyle(w).opacity >= .5 && !w.style.transform)); // palabras ya reveladas
    const ty = el.querySelector(':scope > .typed');
    if (ty) return ty.textContent ? union([...ty.getClientRects()].map((r) => ({ getBoundingClientRect: () => r }))) : null; // texto ya escrito
    if (el.matches('.m3-c')) return union([...el.children].filter((s) => s.style.visibility === 'visible' && parseFloat((s.style.transform || '').replace('translateY(', '')) < .1));
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom];
  };
  const soft = (a, b) => [a, b].some((n) => /sala-note/.test(n)) && [a, b].some((n) => /sala-title/.test(n)) || [a, b].some((n) => /sala-title/.test(n)) && [a, b].some((n) => /sala-prompt/.test(n));
  const fixed = '#hud-cta, #sound, #hud .hud-iso, #hud .hud-scroll small, #hud .hud-chapter, #hud .hud-counter, #osd .cta, #osd .osd-prompt, #sys .sys-hint span';
  const inScope = scope === '#boot'
    ? '#boot .boot-logo, #boot .tape-label, #boot .home-tagline, #boot .press-start, #boot .home-audio-caption, #sound'
    : `${scope} p, ${scope} h1, ${scope} h2, ${scope} h3, ${scope} button, ${scope} a, ${scope} dd, ${scope} dt, ${scope} li, ${scope} cite, ${scope} small, ${fixed}`;
  const els = [...document.querySelectorAll(inScope)].filter((el) => !el.classList.contains('sr-only') && !el.closest('.sr-only') && vis(el));
  const items = [];
  for (const el of els) {
    if (el.matches('.notes li, dd:has(a), .m3-c span')) continue;
    const b = box(el); if (!b || b[2] - b[0] < 3 || b[3] - b[1] < 3) continue;
    if (b[3] < 2 || b[1] > H - 2 || b[2] < 2 || b[0] > W - 2) continue; // fuera de la ventana: no se ve ahora
    items.push({ el, n: name(el), b });
  }
  const out = { off: [], ov: [], tap: [], blocked: [], ox: document.documentElement.scrollWidth > W + 1 };
  const vertical = scope === '#m4' || scope === '#m6'; // secciones que se recorren en vertical: solo importa el ancho
  for (const { n, b, el } of items) {
    const x = b[0] < -2 || b[2] > W + 2, y = !vertical && (b[1] < -2 || b[3] > H + 2);
    if ((x || y) && !el.closest('.m3-vert')) out.off.push(`${n} [${b.map(Math.round)}]`);
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ix = Math.min(A.b[2], B.b[2]) - Math.max(A.b[0], B.b[0]), iy = Math.min(A.b[3], B.b[3]) - Math.max(A.b[1], B.b[1]);
    if (ix < 3 || iy < 3) continue;
    const k = (ix * iy) / Math.min((A.b[2] - A.b[0]) * (A.b[3] - A.b[1]), (B.b[2] - B.b[0]) * (B.b[3] - B.b[1]));
    if (soft(A.n, B.n) && k < .4) continue; // interlineado apretado del rótulo de sala: no es un cruce
    if (vertical && [A, B].some((x) => x.el.closest('#sound, #hud'))) continue; // botón fijo sobre contenido que se desplaza
    if (k > .08) out.ov.push(`${A.n} × ${B.n} ${(k * 100).toFixed(0)}%`);
  }
  for (const { el, n } of items) {
    if (!/^(BUTTON|A)$/.test(el.tagName) || el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    if (touch && (r.width < 43.5 || r.height < 43.5)) out.tap.push(`${n} ${Math.round(r.width)}x${Math.round(r.height)}`);
    // ¿algo tapa el centro del botón?
    const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el)) out.blocked.push(`${n} ← ${name(top)}`);
  }
  return out;
};

async function run(browser, [w, h, touch]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  const res = {};
  const note = (k, r) => { const o = {}; for (const f of ['off', 'ov', 'tap', 'blocked']) if (r[f].length) o[f] = r[f]; if (r.ox) o.desbordeX = true; if (Object.keys(o).length) res[k] = o; };
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `it4_${tag}_aud_${w}x${h}_${n}.jpg`), type: 'jpeg', quality: 68 });
  try {
    await page.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
    await sleep(700); note('carga', await page.evaluate(collect, { scope: '#boot', touch })); await shot('0_carga');
    await page.waitForFunction(() => { const b = document.querySelector('.press-start'); return b && !b.disabled && !b.classList.contains('waiting'); }, { timeout: 60000, polling: 200 });
    await sleep(2600); note('inicio', await page.evaluate(collect, { scope: '#boot', touch })); await shot('1_inicio');
    await page.click('.press-start');
    await page.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 });
    await sleep(4500);
    const marks = await page.evaluate(() => window.__flauxus.marks());
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const pts = [['m1', 0], ['m2', .92], ['m3', .15], ['m3', .5], ['m3', .88], ['m4', .12], ['m4', .3], ['m4', .45], ['m4', .6], ['m4', .75], ['m4', .92], ['m5', .2], ['m5', .6], ['m5', .95], ['m6', .5], ['m6', 1]];
    for (const [m, f] of pts) {
      const [s, e] = marks[m];
      const y = m === 'm6' ? (f === 1 ? total : (e + total) / 2) : s + (e - s) * f;
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForFunction((m) => document.documentElement.dataset.moment === m, { timeout: 8000, polling: 100 }, m).catch(() => {});
      await sleep(m === 'm6' ? 2800 : m === 'm1' ? 2500 : 1900);
      note(`${m}@${f}`, await page.evaluate(collect, { scope: '#' + m, touch }));
      await shot(`${m}_${String(f).replace('.', '')}`);
    }
  } catch (e) { res.ERROR = String(e.message).slice(0, 160); }
  if (errs.length) res.errores = errs.slice(0, 3);
  await page.close();
  return res;
}

const browser = await launch();
const out = {};
for (const s of SIZES) { out[`${s[0]}x${s[1]}`] = await run(browser, s); console.log(`${s[0]}x${s[1]}`, JSON.stringify(out[`${s[0]}x${s[1]}`])); }
await browser.close();
fs.writeFileSync(path.join(DIR, `it4_audit_${tag}.json`), JSON.stringify(out, null, 1));
