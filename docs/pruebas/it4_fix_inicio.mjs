// Revisión it4: pantalla de inicio (figura, botón, lema y cristales) en tableta vertical y celular.
import path from 'node:path';
import { launch, sleep, SHOTS, BASE } from './lib.mjs';
const SIZES = (process.argv[2] || '768x1024,820x1180,1024x1366,360x640,390x844,412x915').split(',').map((s) => s.split('x').map(Number));
const b = await launch();
for (const [w, h] of SIZES) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await p.goto(BASE + '/?fps', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000, polling: 200 });
  await sleep(2600);
  const out = [];
  for (let i = 0; i < 6; i++) {
    out.push(await p.evaluate(() => {
      const R = (q) => { const e = document.querySelector(q); const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
      const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const fig = R('#boot .boot-home-right'); const fw = fig[2] - fig[0];
      const body = [fig[0] + fw * .31, fig[1], fig[2] - fw * .31, fig[3]].map(Math.round); // cuerpo de la figura (sin el aire de la imagen)
      const g = ['.boot-glass-left', '.boot-glass-top'].map((q) => R('#boot ' + q));
      const txt = { lema: R('#boot .home-tagline'), boton: R('#boot .press-start'), leyenda: R('#boot .home-audio-caption') };
      return { cuerpo: body, ...txt, cristales: g, fuera: g.map((r) => r[0] < 0 || r[2] > innerWidth), textoBajoFigura: Object.fromEntries(Object.entries(txt).map(([k, r]) => [k, ov(r, body)])),
        z: [getComputedStyle(document.querySelector('#boot .boot-glass')).zIndex, getComputedStyle(document.querySelector('#boot .boot-home-right')).zIndex, getComputedStyle(document.querySelector('#boot .home-tagline')).zIndex] };
    }));
    if (i === 0 || i === 5) await p.screenshot({ path: path.join(SHOTS, `it4_fix_inicio_${w}x${h}_${i}.jpg`), type: 'jpeg', quality: 76 });
    await sleep(2500);
  }
  console.log(`${w}x${h}`, JSON.stringify(out[0]));
  console.log('  cristales fuera del borde en 6 muestras:', out.filter((o) => o.fuera.some(Boolean)).length, '· solape texto/cuerpo máx:', Math.max(...out.flatMap((o) => Object.values(o.textoBajoFigura))));
  await p.close();
}
await b.close();
