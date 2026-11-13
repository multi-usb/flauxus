// Lluvia de palabras: velocidad real, opacidades, zonas evitadas, pausa (pestaña oculta / juego / fuera de M1) y movimiento reducido.
import { launch, sleep, BASE } from './lib.mjs';
const b = await launch();
const sizes = process.argv[2] ? process.argv[2].split(',').map((s) => s.split('x').map(Number)) : [[390, 844], [1024, 768], [1366, 768]];
const boot = async (p, q = '') => { await p.goto(BASE + '/?fps' + q, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => { const x = document.querySelector('.press-start'); return x && !x.disabled && !x.classList.contains('waiting'); }, { timeout: 60000 }); await sleep(800); await p.click('.press-start'); await p.waitForFunction(() => document.documentElement.classList.contains('started') && window.__flauxus, { timeout: 30000 }); };
const rain = (p) => p.evaluate(() => window.__flauxus.debug().rain);
for (const [w, h] of sizes) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: w < 1100, isMobile: w < 1100 });
  console.log('reduced-motion del entorno:', await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)); await boot(p, '&gl'); await sleep(1500);
  const a0 = await rain(p); await sleep(6000); const a = await rain(p); await sleep(5000); const c = await rain(p);
  const dy = a.words.map((x, i) => (c.words[i].rect[1] - x.rect[1]) * h / 5).filter((v) => v > 0);
  console.log(`${w}x${h}`, 'palabras:', a.words.length, '· opacidad a 1,5 s:', a0.words.map((x) => x.opacity).join(' '), '· a 7,5 s:', a.words.map((x) => x.opacity).join(' '));
  console.log('   velocidad (px/s):', dy.map((v) => v.toFixed(1)).join(' '), '· zonas evitadas:', a.avoid.length, '· k:', c.words.map((x) => x.k).join(' '));
  // ancho de la palabra en pantalla y si alguna encendida pisa una zona de texto
  const hits = c.words.filter((x) => x.opacity > .12 && c.avoid.some((z) => Math.min(x.rect[2], z[2]) - Math.max(x.rect[0], z[0]) > .02 && Math.min(x.rect[3], z[3]) - Math.max(x.rect[1], z[1]) > .01));
  console.log('   ancho en pantalla (%):', c.words.map((x) => Math.round((x.rect[2] - x.rect[0]) * 100)).join(' '), '· encendidas (>0,12) sobre texto:', hits.map((x) => `${x.text} ${x.opacity} k${x.k}`).join(', ') || 'ninguna');
  if (w === sizes[0][0]) {
    // fuera de M1: la lluvia no avanza
    const marks = await p.evaluate(() => window.__flauxus.marks());
    await p.evaluate((y) => scrollTo(0, y), marks.m3[0] + 400); await sleep(1500); const s1 = await rain(p); await sleep(2500); const s2 = await rain(p);
    console.log('   fuera de M1 (M3) · fase quieta:', s1.words.every((x, i) => x.phase === s2.words[i].phase));
    await p.evaluate(() => scrollTo(0, 0)); await sleep(2500);
    // pestaña oculta: el bucle se detiene
    const cdp = await p.createCDPSession();
    const h1 = await rain(p); await cdp.send('Emulation.setIdleOverride', { isUserActive: false, isScreenUnlocked: false }).catch(() => {});
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(2500); const h2 = await rain(p);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(1500); const h3 = await rain(p);
    console.log('   pestaña oculta · fase quieta:', h1.words.every((x, i) => Math.abs(x.phase - h2.words[i].phase) < 0.002), '· al volver avanza:', h3.words.some((x, i) => x.phase !== h2.words[i].phase), '· salto máx. de fase al volver:', Math.max(...h3.words.map((x, i) => { const d = (x.phase - h2.words[i].phase + 1) % 1; return d; })).toFixed(4));
  }
  await p.close();
}
// movimiento reducido
const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await boot(p); await sleep(2500); const r1 = await rain(p); await sleep(3000); const r2 = await rain(p);
console.log('movimiento reducido · fase quieta:', r1.words.every((x, i) => x.phase === r2.words[i].phase), '· opacidades:', r2.words.map((x) => x.opacity).join(' '));
await p.screenshot({ path: 'shots/it4_despues_lluvia_reducido_390x844.jpg', type: 'jpeg', quality: 75 });
await b.close();
