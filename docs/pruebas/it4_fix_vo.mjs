// Locución: ¿la caja muestra líneas enteras y avanza con la lectura? Mide #vo/#voText en el preludio, en varios tamaños y momentos.
// Uso: node it4_fix_vo.mjs [sala]
import { launch, open, sleep, gameReady, shot } from './lib.mjs';
const room = +(process.argv[2] || 6);
const browser = await launch();
for (const [w, h] of [[360, 640], [390, 844], [844, 390], [667, 375], [1366, 768]]) {
  const touch = w < 1000;
  const page = await open(browser, `/juego/?room=${room}&debug${touch ? '&input=touch' : ''}`, { w, h, touch });
  await gameReady(page, room);
  for (const t of [1500, 9000]) {
    await sleep(t);
    const m = await page.evaluate(() => {
      const b = document.getElementById('vo'), tx = document.getElementById('voText'), rb = b.getBoundingClientRect(), rt = tx.getBoundingClientRect(), lh = parseFloat(getComputedStyle(tx).lineHeight);
      const on = [...tx.children].filter(s => s.classList.contains('on')), cur = on[on.length - 1], rc = cur?.getBoundingClientRect();
      return { caja: [Math.round(rb.top), Math.round(rb.bottom)], H: innerHeight, texto: [+rt.top.toFixed(1), +rt.bottom.toFixed(1)], lh, lineas: +(rt.height / lh).toFixed(2), scroll: tx.scrollTop, scrollLineas: +(tx.scrollTop / lh).toFixed(2), total: Math.round(tx.scrollHeight / lh), palabraVisible: rc ? rc.top >= rt.top - 1 && rc.bottom <= rt.bottom + 1 : null, n: on.length };
    });
    console.log(`${w}x${h} t+${t}`, JSON.stringify(m));
  }
  await shot(page, `it4_fix_vo_r${room}_${w}x${h}.jpg`);
  console.log('  errores:', JSON.stringify(page.errors));
  await page.close();
}
await browser.close();
