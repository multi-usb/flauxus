// Auditoría de la landing: preloader, desbordes por momento y cruces foto/texto en M4, por resolución.
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, SHOTS, BASE, DIR } from './lib.mjs';

const ALL = [[320, 568, 1], [375, 667, 1], [390, 844, 1], [430, 932, 1], [844, 390, 1], [768, 1024, 1], [1024, 768, 0], [1366, 768, 0], [1440, 900, 0], [1920, 1080, 0], [2560, 1080, 0]];
const pick = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const SIZES = pick ? ALL.filter(([w, h]) => pick.has(`${w}x${h}`)) : ALL;
const shotsFor = new Set((process.argv[3] || '390x844,1366x768,2560x1080').split(','));

const collect = (m) => {
  const W = innerWidth, H = innerHeight;
  const vis = (el) => { let e = el; while (e && e !== document.body) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false; e = e.parentElement; } return true; };
  const rc = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const inter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const sel = `#${m} p, #${m} h1, #${m} h2, #${m} h3, #${m} button, #${m} a, #${m} dd, #${m} dt, #${m} li, #osd .cta, #osd .osd-prompt, #hud p, #hud-cta, #sound`;
  const off = [];
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (m === 'm4' || m === 'm6') { if (r.left < -2 || r.right > W + 2) off.push((el.className || el.tagName).toString().split(' ')[0] + ' x'); continue; } // secciones que se recorren en vertical
    if (r.left < -2 || r.right > W + 2 || r.top < -2 || r.bottom > H + 2) off.push((el.className || el.tagName).toString().split(' ')[0] + ` [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]`);
  }
  const cross = [];
  if (m === 'm4') {
    const texts = [...document.querySelectorAll('#m4 .m4-facts, #m4 .m4-quote')].filter(vis);
    const photos = [...document.querySelectorAll('#m4 .ph')].filter(vis);
    for (const t of texts) {
      const a = rc(t); if (a[3] < 0 || a[1] > H) continue; const area = (a[2] - a[0]) * (a[3] - a[1]);
      for (const p of photos) { const b = rc(p), k = inter(a, b) / Math.max(1, area); if (k > .04) cross.push(`${t.className.split(' ').pop()}×${p.className.split(' ')[1]} ${(k * 100).toFixed(0)}%`); }
    }
  }
  return { off, cross, ox: document.documentElement.scrollWidth > W + 1, am: document.documentElement.dataset.moment };
};

async function run(browser, [w, h, touch]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  const tag = `landing_${w}x${h}`, doShot = shotsFor.has(`${w}x${h}`);
  const shot = (n) => doShot ? page.screenshot({ path: path.join(SHOTS, `${tag}_${n}.jpg`), type: 'jpeg', quality: 72 }) : null;
  const issues = {};
  try {
    await page.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
    await sleep(900); await shot('0_carga');
    const boot = await page.evaluate(() => { const W = innerWidth, H = innerHeight, bad = []; for (const el of document.querySelectorAll('#boot .boot-logo, #boot .boot-tape, #boot .tape-label, #boot .home-tagline, #boot .press-start, #boot .home-audio-caption')) { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') continue; const r = el.getBoundingClientRect(); if (r.width < 2) continue; if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) bad.push(el.className.split(' ')[0] + ` [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]`); } return bad; });
    if (boot.length) issues.carga = boot;
    await page.waitForFunction(() => { const b = document.querySelector('.press-start'); return b && !b.disabled && !b.classList.contains('waiting'); }, { timeout: 60000, polling: 200 });
    await sleep(2600); await shot('1_inicio');
    const home = await page.evaluate(() => { const W = innerWidth, H = innerHeight, out = {}, bad = []; for (const q of ['.boot-logo', '.home-tagline', '.press-start', '.home-audio-caption']) { const el = document.querySelector('#boot ' + q); const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) continue; const r = el.getBoundingClientRect(); if (r.width < 2) continue; out[q] = [r.left, r.top, r.right, r.bottom]; if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) bad.push(q + ' fuera'); } const k = Object.keys(out); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = out[k[i]], b = out[k[j]]; if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) bad.push(k[i] + '×' + k[j]); } return bad; });
    if (home.length) issues.inicio = home;
    await page.click('.press-start');
    await page.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 });
    await sleep(1500);
    const marks = await page.evaluate(() => window.__flauxus.marks());
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const pts = [['m1', .5], ['m2', .92], ['m3', .15], ['m3', .5], ['m3', .88], ['m4', .12], ['m4', .3], ['m4', .45], ['m4', .6], ['m4', .75], ['m4', .92], ['m5', .2], ['m5', .6], ['m5', .95], ['m6', 1]];
    for (const [m, f] of pts) {
      const [s, e] = marks[m];
      await page.evaluate((y) => scrollTo(0, y), m === 'm6' ? total : s + (e - s) * f);
      // espera a que el director alcance ese momento (el scroll se lee suavizado) y a que asienten las animaciones
      await page.waitForFunction((m) => document.documentElement.dataset.moment === m, { timeout: 8000, polling: 100 }, m).catch(() => {});
      await sleep(m === 'm6' ? 2800 : 1800);
      const r = await page.evaluate(collect, m);
      if (r.off.length || r.cross.length || r.ox || r.am !== m) issues[`${m}@${f}`] = { off: r.off.slice(0, 6), cross: r.cross, ox: r.ox, momento: r.am };
      await shot(`${m}_${String(f).replace('.', '')}`);
    }
    issues._scroll = { totalPx: total, pantallas: +(total / h).toFixed(1) };
  } catch (e) { issues.ERROR = String(e.message).slice(0, 160); }
  await page.close();
  return { tag, issues, errs };
}

const out = []; let i = 0;
const worker = async () => { const browser = await launch(); while (i < SIZES.length) { const s = SIZES[i++]; out.push(await run(browser, s)); process.stderr.write('.'); } await browser.close(); };
await Promise.all([worker(), worker()]);
out.sort((a, b) => a.tag.localeCompare(b.tag));
fs.writeFileSync(path.join(DIR, 'landing.json'), JSON.stringify(out, null, 1));
for (const o of out) console.log(o.tag, JSON.stringify(o.issues), o.errs.slice(0, 2).join(' | '));
