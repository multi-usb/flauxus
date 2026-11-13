// Iteración 5 · comprobaciones sueltas: prefers-reduced-motion (corte limpio) y que los .m4a (Safari/iOS) decodifican y duran lo mismo.
import { launch, sleep, BASE } from './lib.mjs';
const b = await launch(); const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p.goto(BASE + '/juego/?room=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.S && window.S.room === 1 && window.S.ready && document.querySelector('#voText .vl.on'), { timeout: 120000, polling: 100 });
console.log('reduce:', await p.evaluate(() => { const e = document.querySelector('#voText .vl.on'), c = getComputedStyle(e); return { reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, transicion: c.transitionDuration, transform: c.transform, opacidad: c.opacity, texto: e.textContent } }));
console.log('m4a:', await p.evaluate(async () => { const { PISTAS } = await import('/juego/audio/locucion/pistas.js'); const out = {}; for (const k of Object.keys(PISTAS)) { const P = PISTAS[k]; const d = async ext => { const bl = await (await fetch('/juego/' + P.audio + ext)).blob(); const a = new Audio(URL.createObjectURL(bl)); await new Promise((r, j) => { a.onloadedmetadata = r; a.onerror = j }); return +a.duration.toFixed(2) }; out[P.sala] = { pista: P.dur, ogg: await d('.ogg'), m4a: await d('.m4a') } } return out }));
await b.close();
