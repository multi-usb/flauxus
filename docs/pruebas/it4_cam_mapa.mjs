// Coste del mapa de obstáculos de la cámara por sala: triángulos, mallas y tiempo. Uso: node it4_cam_mapa.mjs [salas]
import { launch, sleep, BASE } from './lib.mjs';
const ROOMS = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
const browser = await launch();
for (const room of ROOMS) {
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/juego/?room=${room}&debug&input=touch`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((room) => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && window.S.room === room && window.S.ready }, { timeout: 120000, polling: 200 }, room);
  await sleep(1500);
  const r = await page.evaluate(async () => {
    const b = '/juego/'; const { groundController } = await import(b + 'engine/ground.js'); const Pl = await import(b + 'player.js');
    let tris = 0, meshes = 0, big = 0; const o = groundController.roomObj;
    o.traverse(m => { if (!m.isMesh || !m.geometry) return; meshes++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 });
    return { meshes, tris: Math.round(tris), indexed: !!o.getObjectByProperty('isMesh', true)?.geometry.index, fr: Pl.frameDebug() };
  });
  console.log(`r${room} ${JSON.stringify(r)}`);
  await page.close();
}
await browser.close();
