// Menú: ¿la tarjeta cabe sin scroll interno y se ven las cuatro entradas? + favicon/404
import { launch, open, sleep, gameReady, shot } from './lib.mjs';
const browser = await launch();
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [412, 915], [667, 375], [844, 390], [1366, 768]]) {
  const touch = w < 1000;
  const page = await open(browser, `/juego/?${touch ? 'input=touch' : ''}`, { w, h, touch });
  await gameReady(page, 0); await sleep(600);
  const m = await page.evaluate(() => { const b = document.querySelector('#intro .box'), r = b.getBoundingClientRect(); const sats = [...document.querySelectorAll('.sats a')].map(a => { const q = a.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height), q.bottom <= Math.min(innerHeight, r.bottom) + 1 && q.top >= r.top - 1, a.scrollWidth > a.clientWidth + 1] }); const st = document.getElementById('btnStart').getBoundingClientRect(); return { contenido: b.scrollHeight, visible: b.clientHeight, caja: [Math.round(r.top), Math.round(r.bottom)], sats, entrar: [Math.round(st.top), Math.round(st.bottom)], icono: document.querySelector('link[rel=icon]')?.href } });
  console.log(`${w}x${h}`, JSON.stringify(m), 'errores:', JSON.stringify(page.errors));
  await shot(page, `it4_fix_menu_${w}x${h}.jpg`); await page.close();
}
await browser.close();
