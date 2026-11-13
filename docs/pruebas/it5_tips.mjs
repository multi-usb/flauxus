// Iteración 5 · microcontenidos de M4: recorre el momento en pasos finos y comprueba, en cada tamaño,
// que los marcadores no pisan rostros, citas, datos ni botones fijos; que el texto abierto cabe en la ventana y
// no tapa nada; objetivos táctiles ≥ 44 px; uno abierto a la vez; cierre al tocar fuera, con Escape y con el scroll.
// Uso: node it5_tips.mjs [tamaños separados por coma]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, SHOTS, BASE, DIR } from './lib.mjs';

const ALL = [[360, 640, 1], [375, 667, 1], [390, 844, 1], [412, 915, 1], [667, 375, 1], [844, 390, 1], [768, 1024, 1], [1024, 768, 1], [1366, 768, 0], [1920, 1080, 0]];
const pick = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const SIZES = pick ? ALL.filter(([w, h]) => pick.has(`${w}x${h}`)) : ALL;
const FACE = { 'ph-a': [0.54, 0.3], 'ph-b': [0.54, 0.4], 'ph-c': [0.48, 0.38], 'ph-d': [0.34, 0.52], 'ph-e': [0.46, 0.3] };

// Estado geométrico de M4 en este instante.
const state = (FACE) => {
  const W = innerWidth, H = innerHeight;
  const R = (r) => [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v));
  const vis = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .15) return false; } return true; };
  const textRect = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1); if (!rs.length) return null; return R({ left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) }); };
  const obst = {};
  for (const [k, f] of Object.entries(FACE)) {
    const el = document.querySelector('.' + k); if (el.style.visibility !== 'visible') continue;
    const r = el.getBoundingClientRect(), h = 0.15 * Math.sqrt(r.width * r.height), cx = r.left + f[0] * r.width, cy = r.top + f[1] * r.height;
    obst['rostro ' + k] = R({ left: cx - h, top: cy - h, right: cx + h, bottom: cy + h });
  }
  document.querySelectorAll('#m4 .m4-quote .type, #m4 .m4-quote cite, #m4 .m4-facts p').forEach((el, i) => { if (!vis(el)) return; const t = textRect(el.querySelector('.typed') || el); if (t) obst[(el.closest('.m4-quote') ? 'cita ' : 'datos ') + i] = t; });
  for (const q of ['#hud .hud-iso', '#sound', '#hud-cta']) { const el = document.querySelector(q); if (el && vis(el)) obst[q] = R(el.getBoundingClientRect()); }
  const tips = [...document.querySelectorAll('#m4 .m4-tip')].map((el) => {
    const on = el.classList.contains('on'), open = el.classList.contains('open');
    return { k: el.dataset.for, on, open, btn: R(el.querySelector('.m4-tip-btn').getBoundingClientRect()), size: [el.querySelector('.m4-tip-btn').offsetWidth, el.querySelector('.m4-tip-btn').offsetHeight], chip: R(el.querySelector('.m4-tip-chip').getBoundingClientRect()), text: R(el.querySelector('.m4-tip-text').getBoundingClientRect()), exp: el.querySelector('.m4-tip-btn').getAttribute('aria-expanded'), fs: [parseFloat(getComputedStyle(el.querySelector('.m4-tip-btn')).fontSize), parseFloat(getComputedStyle(el.querySelector('.m4-tip-text')).fontSize)] };
  });
  return { W, H, obst, tips, y: Math.round(scrollY), sx: document.documentElement.scrollWidth > W + 1 };
};
const hit = (a, b, pad = 0) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]) - pad) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]) - pad);

async function run(browser, [w, h, touch]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  const res = { problemas: [], vistos: {}, abiertos: {} };
  const bad = (s) => { if (!res.problemas.includes(s)) res.problemas.push(s); };
  const tap = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  try {
    await page.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const b = document.querySelector('.press-start'); return b && !b.disabled && !b.classList.contains('waiting'); }, { timeout: 60000, polling: 200 });
    await sleep(1500); await page.click('.press-start');
    await page.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 });
    await sleep(3500);
    const [s, e] = await page.evaluate(() => window.__flauxus.marks().m4);
    const N = 44;
    for (let i = 0; i <= N; i++) {
      const y = s + (e - s) * (0.04 + 0.95 * i / N);
      if (!touch) await page.mouse.move(2, h - 2);
      await page.evaluate((y) => scrollTo(0, y), y);
      await sleep(i === 0 ? 1500 : 650);
      let st = await page.evaluate(state, FACE);
      if (st.sx) bad('desborde horizontal');
      const on = st.tips.filter((t) => t.on);
      // marcadores cerrados: tamaño táctil y cruces
      for (const t of on) {
        res.vistos[t.k] = (res.vistos[t.k] || 0) + 1;
        if (t.size[0] < 44 || t.size[1] < 44) bad(`${t.k}: objetivo ${t.size}`);
        if (t.chip[0] < 0 || t.chip[2] > st.W) bad(`${t.k}: marcador fuera de pantalla [${t.chip}]`);
        if (t.fs[0] < 12 || t.fs[1] < 14) bad(`${t.k}: fuente ${t.fs}`);
        for (const [n, o] of Object.entries(st.obst)) if (hit(t.chip, o, 2) > 12) bad(`${t.k}: marcador × ${n} (${Math.round(hit(t.chip, o))} px²) @${i}`);
        for (const u of on) if (u !== t && hit(t.chip, u.chip) > 0) bad(`${t.k} × ${u.k}: marcadores encimados @${i}`);
      }
      // abre cada marcador visible una vez por tamaño (y otra si cambió mucho de sitio) y revisa el texto
      for (const t of on) {
        const cy = (t.chip[1] + t.chip[3]) / 2, cx = (t.chip[0] + t.chip[2]) / 2;
        const zone = Math.round(cy / (h / 3));
        const key = t.k + ':' + zone; if (res.abiertos[key]) continue;
        if (touch) await tap(cx, cy); else await page.mouse.move(cx, cy);
        await sleep(420);
        st = await page.evaluate(state, FACE);
        const o = st.tips.find((x) => x.k === t.k);
        if (!o.open || o.exp !== 'true') { bad(`${t.k}: no abrió (${touch ? 'toque' : 'hover'}) @${i}`); continue; }
        if (st.tips.filter((x) => x.open).length !== 1) bad('más de uno abierto');
        const T = o.text; const nb = res.problemas.length;
        res.abiertos[key] = `[${T}]`;
        if (T[0] < 0 || T[2] > st.W) bad(`${t.k}: texto fuera de pantalla en X [${T}] @${i}`);
        if (T[1] < 0 || T[3] > st.H) bad(`${t.k}: texto fuera de pantalla en Y [${T}] @${i}`);
        for (const [n, ob] of Object.entries(st.obst)) if (hit(T, ob, 2) > 30) bad(`${t.k}: texto × ${n} (${Math.round(hit(T, ob))} px²) @${i}`);
        for (const u of st.tips) if (u.on && u.k !== t.k && hit(T, u.chip) > 0) bad(`${t.k}: texto × marcador ${u.k} @${i}`);
        await page.screenshot({ path: path.join(SHOTS, `it5_tip_${w}x${h}_${t.k}_${zone}.jpg`), type: 'jpeg', quality: 72 }); if (res.problemas.length > nb) { await page.screenshot({ path: path.join(SHOTS, `it5_tipbad_${w}x${h}_${t.k}_${i}.jpg`), type: 'jpeg', quality: 72 }); console.log('BAD', i, t.k, JSON.stringify(T), JSON.stringify(st.obst)); }
        // cierre: tocar fuera (táctil) o sacar el cursor (escritorio)
        if (touch) await tap(st.W / 2, 6); else await page.mouse.move(2, h - 2);
        await sleep(300);
        if ((await page.evaluate(state, FACE)).tips.some((x) => x.open)) bad(`${t.k}: no cerró al ${touch ? 'tocar fuera' : 'salir el cursor'} @${i}`);
      }
    }
    // --- interacción: uno a la vez, segundo toque cierra, scroll cierra, teclado ---
    const goto = async (f) => { await page.evaluate((y) => scrollTo(0, y), s + (e - s) * f); await sleep(900); };
    let found = null;
    for (let f = 0.2; f < 0.95 && !found; f += 0.03) { await goto(f); const st = await page.evaluate(state, FACE); const on = st.tips.filter((t) => t.on); if (on.length) found = { f, on, st }; }
    if (found) {
      const t = found.on[0], cx = (t.chip[0] + t.chip[2]) / 2, cy = (t.chip[1] + t.chip[3]) / 2;
      await tap(cx, cy); await sleep(350);
      let st = await page.evaluate(state, FACE);
      res.toqueAbre = st.tips.find((x) => x.k === t.k).open;
      await tap(cx, cy); await sleep(350);
      st = await page.evaluate(state, FACE);
      res.segundoToqueCierra = !st.tips.some((x) => x.open);
      await tap(cx, cy); await sleep(350);
      await page.evaluate(() => scrollBy(0, 70)); await sleep(500);
      st = await page.evaluate(state, FACE);
      res.scrollCierra = !st.tips.some((x) => x.open);
      // teclado: foco visible abre; Escape cierra; aria-describedby apunta a la frase
      await page.evaluate(() => scrollBy(0, -70)); await sleep(500);
      if (!touch) await page.mouse.move(2, h - 2);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Tab');
      for (let i = 0; i < 12; i++) { if (await page.evaluate(() => document.activeElement?.classList.contains('m4-tip-btn'))) break; await page.keyboard.press('Tab'); }
      await sleep(350);
      const kb = await page.evaluate(() => { const a = document.activeElement; return { tip: a?.classList.contains('m4-tip-btn'), exp: a?.getAttribute('aria-expanded'), desc: !!document.getElementById(a?.getAttribute('aria-describedby') || '')?.textContent.trim(), name: a?.getAttribute('aria-label') || a?.textContent.trim(), secScroll: document.getElementById('m4').scrollTop }; });
      res.teclado = kb;
      await page.keyboard.press('Escape'); await sleep(250);
      res.escapeCierra = !(await page.evaluate(state, FACE)).tips.some((x) => x.open);
      await page.keyboard.press('Enter'); await sleep(250);
      res.enterAbre = (await page.evaluate(state, FACE)).tips.some((x) => x.open);
    } else bad('ningún marcador visible en el recorrido');
    for (const k of Object.keys(FACE)) if (!res.vistos[k]) bad(`${k}: el marcador nunca apareció`);
  } catch (err) { res.ERROR = String(err.message).slice(0, 200); }
  if (errs.length) res.errores = errs.slice(0, 3);
  await page.close();
  return res;
}

const browser = await launch();
const out = {};
for (const sz of SIZES) { const k = `${sz[0]}x${sz[1]}`; out[k] = await run(browser, sz); console.log(k, JSON.stringify(out[k])); }
await browser.close();
fs.writeFileSync(path.join(DIR, 'it5_tips.json'), JSON.stringify(out, null, 1));
