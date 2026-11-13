// Iteración 5 · auditoría de legibilidad de la landing con medidas reales.
// Por cada texto visible: tamaño de fuente calculado, alto de línea, color efectivo, contraste WCAG contra el fondo
// REAL (se captura la pantalla con el texto oculto y se muestrean los píxeles que quedan detrás) y caracteres por línea.
// Uso: node it5_legib.mjs [etiqueta] [tamaños separados por coma]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, SHOTS, BASE, DIR } from './lib.mjs';

const tag = process.argv[2] || 'antes';
const ALL = [[360, 640, 1], [375, 667, 1], [390, 844, 1], [412, 915, 1], [667, 375, 1], [844, 390, 1], [768, 1024, 1], [1024, 768, 1], [1366, 768, 0], [1920, 1080, 0]];
const pick = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const SIZES = pick ? ALL.filter(([w, h]) => pick.has(`${w}x${h}`)) : ALL;
const PTS = [['m1', 0], ['m2', .92], ['m3', .15], ['m3', .5], ['m3', .88], ['m4', .12], ['m4', .3], ['m4', .45], ['m4', .6], ['m4', .75], ['m4', .92], ['m5', .2], ['m5', .6], ['m5', .95], ['m6', .5], ['m6', 1]];

// En la página: lista de textos visibles con su geometría y estilo.
const collect = () => {
  const W = innerWidth, H = innerHeight;
  const roots = [...document.querySelectorAll('#boot, #story, #hud, #osd, #sys, #hud-cta, #sound, #game')];
  const out = [];
  const nameOf = (el) => {
    const one = (e) => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).filter((c) => !/^(on|show|in|is-|visible|done|typed|w$|c$)/.test(c)).slice(0, 2).join('.') : '');
    let n = one(el) || el.tagName.toLowerCase();
    let p = el.parentElement, hops = 0;
    while (p && hops < 3 && !/#/.test(n)) { const pn = one(p); if (pn) { n = pn + ' ' + n; if (/#/.test(pn) || hops >= 1) break; } p = p.parentElement; hops++; }
    return n.replace(/\s+/g, ' ').slice(0, 70);
  };
  const seen = new Set();
  for (const root of roots) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      let el = node.parentElement;
      if (!el || el.closest('.sr-only, script, style, noscript, svg')) continue;
      // las palabras/caracteres partidos por las animaciones se agrupan en su bloque
      const block = el.closest('.split, .type, [data-text], .m3-c, .m4-name, .hero-copy > p, .scale li') || el;
      if (seen.has(block)) continue; seen.add(block);
      // visibilidad y opacidad acumulada
      let op = 1, vis = true, e = el;
      while (e && e !== document.documentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') { vis = false; break; } op *= +s.opacity; e = e.parentElement; }
      if (!vis || op < .08) continue;
      const range = document.createRange(); range.selectNodeContents(block);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
      if (!rects.length) continue;
      const b = rects.reduce((a, r) => [Math.min(a[0], r.left), Math.min(a[1], r.top), Math.max(a[2], r.right), Math.max(a[3], r.bottom)], [1e9, 1e9, -1e9, -1e9]);
      if (b[3] < 4 || b[1] > H - 4 || b[2] < 4 || b[0] > W - 4) continue;
      const cs = getComputedStyle(el);
      const text = block.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const tops = [...new Set(rects.map((r) => Math.round(r.top / 4)))].length;
      const fs = parseFloat(cs.fontSize);
      const lh = cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight);
      const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor : cs.color;
      let blend = '';
      for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const m = getComputedStyle(p).mixBlendMode; if (m && m !== 'normal') { blend = m; break; } }
      out.push({
        n: nameOf(block), text: text.slice(0, 48), len: text.length, fs: +fs.toFixed(2), lh: lh ? +(lh / fs).toFixed(2) : null,
        color: fill, op: +op.toFixed(2), wt: +cs.fontWeight, fam: cs.fontFamily.split(',')[0].replace(/["']/g, ''), upper: cs.textTransform === 'uppercase',
        lines: tops, cpl: Math.round(text.length / tops), blend,
        b: [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(W, b[2]), Math.min(H, b[3])].map(Math.round),
      });
    }
  }
  return out;
};

// En una página auxiliar: contraste de cada texto contra los píxeles reales de la captura sin texto.
const contrastIn = async ({ png, items }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  const L = (r, gg, b) => .2126 * lin(r) + .7152 * lin(gg) + .0722 * lin(b);
  return items.map((it) => {
    const m = it.color.match(/[\d.]+/g).map(Number); const a = (m[3] ?? 1) * it.op;
    const [x0, y0, x1, y1] = it.b; const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const d = g.getImageData(x0, y0, w, h).data; const step = Math.max(1, Math.floor(Math.sqrt(w * h / 900)));
    const cr = []; let sr = 0, sg = 0, sb = 0, n = 0;
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4; const r = d[i], gg = d[i + 1], b = d[i + 2];
      const fr = m[0] * a + r * (1 - a), fg = m[1] * a + gg * (1 - a), fb = m[2] * a + b * (1 - a);
      const l1 = L(fr, fg, fb), l2 = L(r, gg, b);
      cr.push((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)); sr += r; sg += gg; sb += b; n++;
    }
    cr.sort((p, q) => p - q);
    return { med: +cr[Math.floor(cr.length / 2)].toFixed(2), p10: +cr[Math.floor(cr.length * .1)].toFixed(2), bg: [sr / n, sg / n, sb / n].map(Math.round).join(',') };
  });
};

async function run(browser, helper, [w, h, touch]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  const res = { pasos: {} };
  const measure = async (k) => {
    await page.screenshot({ path: path.join(SHOTS, `it5_${tag}_${w}x${h}_${k}.jpg`), type: 'jpeg', quality: 72 });
    const items = await page.evaluate(collect);
    await page.addStyleTag({ content: '*,*::before,*::after{-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}' }).then((h) => h.evaluate((s) => s.id = 'it5-hide'));
    const png = await page.screenshot({ type: 'png', encoding: 'base64' });
    await page.evaluate(() => document.getElementById('it5-hide')?.remove());
    const cr = await helper.evaluate(contrastIn, { png, items });
    res.pasos[k] = items.map((it, i) => ({ ...it, ...cr[i] }));
    (res.logos ||= {})[k] = await page.evaluate(() => ['#boot .boot-logo svg', '.hero-lockup img', '#hud .hud-iso', '#m6 .m6-logo', '#m6 .m6-rewind', '#m6 .m6-uni img', '#hud-cta', '#sound'].map((q) => { const e = document.querySelector(q); if (!e) return null; let v = true, op = 1; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') v = false; op *= +c.opacity; } const r = e.getBoundingClientRect(); return v && op > .1 && r.width > 2 && r.bottom > 0 && r.top < innerHeight ? q + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + Math.round(r.left) + ',' + Math.round(r.top) + ' op' + op.toFixed(2) : null; }).filter(Boolean));
  };
  try {
    await page.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
    res.reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    await sleep(700); await measure('0_carga');
    await page.waitForFunction(() => { const b = document.querySelector('.press-start'); return b && !b.disabled && !b.classList.contains('waiting'); }, { timeout: 60000, polling: 200 });
    await sleep(2600); await measure('1_inicio');
    await page.click('.press-start');
    await page.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 });
    await sleep(1300); await measure('m1_act');
    await sleep(3200);
    const marks = await page.evaluate(() => window.__flauxus.marks());
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (const [m, f] of PTS) {
      const [s, e] = marks[m];
      const y = m === 'm6' ? (f === 1 ? total : (e + total) / 2) : s + (e - s) * f;
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForFunction((m) => document.documentElement.dataset.moment === m, { timeout: 8000, polling: 100 }, m).catch(() => {});
      await sleep(m === 'm6' ? 2800 : m === 'm1' ? 2500 : 1900);
      await measure(`${m}_${String(f).replace('.', '')}`);
    }
  } catch (e) { res.ERROR = String(e.message).slice(0, 200); }
  if (errs.length) res.errores = errs.slice(0, 3);
  await page.close();
  return res;
}

const browser = await launch();
const helper = await browser.newPage(); await helper.goto('about:blank');
const out = {};
for (const s of SIZES) { const k = `${s[0]}x${s[1]}`; out[k] = await run(browser, helper, s); console.log(k, Object.keys(out[k].pasos).length, 'pasos', out[k].ERROR || '', 'reducedMotion=' + out[k].reducedMotion, (out[k].errores || []).join(' | ')); }
await browser.close();
fs.writeFileSync(path.join(DIR, `it5_legib_${tag}.json`), JSON.stringify(out));

// Resumen: por elemento, lo peor medido en celulares/tabletas.
const rows = new Map();
for (const [size, r] of Object.entries(out)) for (const [paso, items] of Object.entries(r.pasos)) for (const it of items) {
  const k = it.n; const o = rows.get(k) || { n: k, text: it.text, fsMin: 1e9, fsAt: '', crMin: 1e9, crAt: '', p10: 1e9, lh: it.lh, cplMax: 0, fam: it.fam, blend: it.blend, upper: it.upper, wt: it.wt, pasos: new Set() };
  if (it.fs < o.fsMin) { o.fsMin = it.fs; o.fsAt = size; }
  if (it.op >= .5 && it.med < o.crMin) { o.crMin = it.med; o.crAt = `${size} ${paso} bg ${it.bg} ${it.color} op ${it.op}`; }
  if (it.op >= .5) o.p10 = Math.min(o.p10, it.p10);
  o.cplMax = Math.max(o.cplMax, it.cpl); o.pasos.add(paso.split('_')[0] === '0' || paso.split('_')[0] === '1' ? paso : paso.split('_')[0]);
  rows.set(k, o);
}
const txt = [...rows.values()].sort((a, b) => a.fsMin - b.fsMin).map((o) => `${o.fsMin.toFixed(1).padStart(5)}px @${o.fsAt.padEnd(9)} lh ${String(o.lh).padEnd(4)} cr ${o.crMin === 1e9 ? '  –  ' : o.crMin.toFixed(2).padStart(5)} (p10 ${o.p10 === 1e9 ? '–' : o.p10.toFixed(2)}) cpl ${String(o.cplMax).padStart(3)} ${o.fam.slice(0, 10).padEnd(10)} ${o.wt} ${o.blend ? '[' + o.blend + '] ' : ''}${o.n}  «${o.text}»  {${[...o.pasos].join(',')}}  ${o.crMin < 4.5 ? '← ' + o.crAt : ''}`).join('\n');
fs.writeFileSync(path.join(DIR, `it5_legib_${tag}.txt`), txt);
console.log(txt);
for (const [size, r] of Object.entries(out)) { const seen = new Map(); for (const [p, l] of Object.entries(r.logos || {})) for (const x of l) { const q = x.split(' ').slice(0, -3).join(' ') + ' ' + x.split(' ').at(-3); if (!seen.has(q)) seen.set(q, p); } console.log('LOGOS ' + size + ': ' + [...seen].map(([q, p]) => q + ' (' + p + ')').join(' · ')); }
