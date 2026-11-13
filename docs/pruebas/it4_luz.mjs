// LA♯: color medio de la avatar en las capturas de it4_camaras (¿la baña la luz morada?). Uso: node it4_luz.mjs antes:390x844 antesD:1366x768 ...
import fs from 'node:fs';
import path from 'node:path';
import { launch, SHOTS, DIR } from './lib.mjs';
const browser = await launch({ gpu: false }); const page = await browser.newPage();
for (const arg of process.argv.slice(2)) {
  const [label, T] = arg.split(':'); const data = JSON.parse(fs.readFileSync(path.join(DIR, `it4_camaras_${label}.json`), 'utf8'));
  for (const st of ['pre', 'juego']) {
    const d = data.find(e => e.room === 6 && e.T === T && e.st === st); const f = path.join(SHOTS, `it4_cam_${label}_r6_${T}_${st}.jpg`); if (!d || !fs.existsSync(f)) { console.log(label, T, st, 'sin datos'); continue }
    const r = await page.evaluate(async (src, box) => {
      const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const [l, t, rr, b] = box, w = rr - l, h = b - t, x0 = Math.round(l + w * .25), y0 = Math.round(t + h * .12), cw = Math.max(2, Math.round(w * .5)), ch = Math.max(2, Math.round(h * .76));
      const p = x.getImageData(x0, y0, cw, ch).data; let R = 0, G = 0, B = 0, n = 0, vio = 0;
      for (let i = 0; i < p.length; i += 4) { R += p[i]; G += p[i + 1]; B += p[i + 2]; n++; if (p[i + 2] > p[i + 1] * 1.15 && p[i] > p[i + 1] * .95 && p[i + 2] > 40) vio++ }
      return { R: Math.round(R / n), G: Math.round(G / n), B: Math.round(B / n), pctVioleta: Math.round(100 * vio / n) };
    }, 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64'), d.caja);
    console.log(`${label} ${T} ${st}: RGB medio de la avatar (${r.R}, ${r.G}, ${r.B}) · píxeles violetas ${r.pctVioleta} % · B/G ${(r.B / Math.max(1, r.G)).toFixed(2)}`);
  }
}
await browser.close();
