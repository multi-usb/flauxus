import { launch, open, gameReady, sleep } from './lib.mjs';
const port = process.argv[2] || '5173';
process.env.BASE = 'http://localhost:' + port;
const b = await launch();
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
await p.goto('http://localhost:' + port + '/juego/'); await gameReady(p, 0); await p.click('#btnStart'); await sleep(1500);
const tex = () => p.evaluate(async () => { const R = await import('/juego/engine/renderer.js'); return R.renderer.info.memory.textures; });
for (const room of [1, 2, 3, 4, 5, 6]) {
  const row = [];
  for (let k = 0; k < 3; k++) {
    await p.evaluate(async (room) => (await import('/juego/flow.js')).enterRoom(room), room); await gameReady(p, room, 120000); await sleep(800);
    await p.evaluate(async () => (await import('/juego/flow.js')).leaveRoom());
    await p.waitForFunction(() => window.S.room === 0 && !document.getElementById('preloader').classList.contains('on') && !window.S.busy, { timeout: 120000, polling: 250 }); await sleep(800);
    row.push(await tex());
  }
  console.log('sala', room, 'texturas tras cada visita:', row.join(' → '));
}
await b.close();
