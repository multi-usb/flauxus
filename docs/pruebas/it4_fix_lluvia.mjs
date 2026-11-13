// Revisión it4: la lluvia de palabras cede ante cada bloque de texto del héroe (incluida la pista de scroll),
// cuántas palabras se ven a la vez, y las zonas tras girar fuera de M1.
import path from 'node:path';
import { launch, sleep, SHOTS, BASE } from './lib.mjs';
const SIZES = (process.argv[2] || '412x915x1,390x844x1,844x390x1,768x1024x1,1366x768x0').split(',').map((s) => s.split('x').map(Number));
const SECS = +(process.argv[3] || 44);
const b = await launch();
const ov = (a, c) => Math.max(0, Math.min(a[2], c[2]) - Math.max(a[0], c[0])) * Math.max(0, Math.min(a[3], c[3]) - Math.max(a[1], c[1]));
for (const [w, h, touch] of SIZES) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000, polling: 200 });
  await sleep(1500); await p.click('.press-start');
  await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 });
  await sleep(6000);
  const dom = () => p.evaluate(() => Object.fromEntries(['.hero-lockup img', '.hero-artist', '.hero-manifesto', '.hero-scroll', '.hero-copy > p:first-child', '.hero-explore', '.hero-mini-avatar'].map((q) => { const e = document.querySelector('#m1 ' + q); const r = e.getBoundingClientRect(); return [q, r.width < 2 ? null : [r.left / innerWidth, r.top / innerHeight, r.right / innerWidth, r.bottom / innerHeight]]; })));
  const d0 = await dom();
  const dbg0 = await p.evaluate(() => window.__flauxus.debug().rain);
  const pista = d0['.hero-scroll'];
  const inZone = (r) => r && dbg0.avoid.some((a) => a[0] <= r[0] + .002 && a[1] <= r[1] + .002 && a[2] >= r[2] - .002 && a[3] >= r[3] - .002);
  console.log(`=== ${w}x${h} · zonas ${dbg0.avoid.length} · palabras ${dbg0.words.length} · tinta desfasada ${dbg0.staleInk}`);
  console.log('  bloques dentro de alguna zona:', JSON.stringify(Object.fromEntries(Object.entries(d0).map(([k, r]) => [k, r ? inZone(r) : 'oculto']))));
  let maxOn = { op: 0 }, vis = [], shots = 0, worst = {};
  for (let t = 0; t < SECS * 2; t++) {
    const d = await p.evaluate(() => window.__flauxus.debug().rain);
    vis.push(d.words.filter((x) => x.opacity > 0.1).length);
    for (const [k, r] of Object.entries(d0)) {
      if (!r) continue;
      for (const x of d.words) {
        const part = ov(x.rect, r) / ((r[2] - r[0]) * (r[3] - r[1])); // parte del bloque bajo la tinta de la palabra
        if (part > 0.3 && x.opacity > (worst[k]?.op || 0)) worst[k] = { op: x.opacity, t: t / 2, text: x.text, part: +part.toFixed(2), k: x.k };
        if (k === '.hero-scroll' && part > 0.3 && x.opacity > 0.1 && shots < 2) { shots++; await p.screenshot({ path: path.join(SHOTS, `it4_fix_lluvia_${w}x${h}_pista${shots}.jpg`), type: 'jpeg', quality: 78 }); }
      }
    }
    if (t === 10 || t === 40 || t === 70) await p.screenshot({ path: path.join(SHOTS, `it4_fix_lluvia_${w}x${h}_t${t / 2}.jpg`), type: 'jpeg', quality: 78 });
    await sleep(500);
  }
  console.log('  palabras con opacidad > 0,10 a la vez: media', (vis.reduce((a, c) => a + c, 0) / vis.length).toFixed(2), 'máx', Math.max(...vis));
  console.log('  opacidad máxima de una palabra que cubre > 30 % de un bloque:', JSON.stringify(worst));
  // (a) giro fuera de M1: las zonas deben coincidir con una medida limpia al volver
  if (touch) {
    const marks = await p.evaluate(() => window.__flauxus.marks());
    await p.evaluate((y) => scrollTo(0, y), marks.m2[0] + (marks.m2[1] - marks.m2[0]) * .5); await sleep(1500);
    await p.setViewport({ width: h, height: w, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); await sleep(1800);
    const mid = await p.evaluate(() => ({ a: window.__flauxus.anchor(), m: document.documentElement.dataset.moment }));
    await p.evaluate(() => scrollTo(0, 0)); await sleep(2500);
    const d1 = await dom(); const z1 = (await p.evaluate(() => window.__flauxus.debug().rain)).avoid;
    let maxErr = 0, n = 0;
    for (const r of Object.values(d1)) { if (!r) continue; n++; const m = [14 / h, 14 / w, 14 / h, 14 / w]; const best = Math.min(...z1.map((a) => Math.max(Math.abs(a[0] - (r[0] - m[0])) * h, Math.abs(a[1] - (r[1] - m[1])) * w, Math.abs(a[2] - (r[2] + m[2])) * h, Math.abs(a[3] - (r[3] + m[3])) * w))); maxErr = Math.max(maxErr, best); }
    console.log(`  giro en M2 → ${h}x${w} (momento ${mid.m}, heroDirty ${mid.a.heroDirty}) y vuelta a M1: ${z1.length} zonas para ${n} bloques · error máx ${maxErr.toFixed(1)} px`);
    await p.screenshot({ path: path.join(SHOTS, `it4_fix_lluvia_${w}x${h}_girado.jpg`), type: 'jpeg', quality: 78 });
  }
  console.log('  errores', JSON.stringify(errs));
  await p.close();
}
await b.close();
