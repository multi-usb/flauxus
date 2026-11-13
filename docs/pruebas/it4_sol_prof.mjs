// SOL: inventario de la escena + perfil de CPU (muestreo) en preludio caminando / juego. Uso: node it4_sol_prof.mjs [estado=camina|quieta|juego] [cpu] [touch]
import { launch, sleep, BASE } from './lib.mjs';
const state = process.argv[2] || 'camina', cpu = +(process.argv[3] || 1), touch = +(process.argv[4] ?? 1);
const b = await launch(); const p = await b.newPage(); await p.setViewport(touch ? { width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { width: 1366, height: 768 });
await p.goto(`${BASE}/juego/?room=5&debug${touch ? '&input=touch' : ''}`);
await p.waitForFunction(() => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && window.S.room === 5 && window.S.ready; }, { timeout: 120000 });
await sleep(3000);
if (process.argv[5] === 'inv') {
  const inv = await p.evaluate(async () => {
    const R = await import('/juego/engine/renderer.js'); const A = await import('/juego/engine/avatar.js');
    const tri = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
    const texOf = m => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'envMap', 'aoMap'].filter(k => m[k]).map(k => k + ':' + (m[k].image?.width || '?') + 'x' + (m[k].image?.height || '?'));
    const av = []; A.avatarObj.traverse(o => { if (o.isMesh) av.push({ n: o.name, skinned: !!o.isSkinnedMesh, tris: tri(o.geometry), verts: o.geometry.attributes.position.count, bones: o.skeleton?.bones.length, mats: (Array.isArray(o.material) ? o.material : [o.material]).map(m => m.type + ' ' + texOf(m).join(',') + (m.transparent ? ' transp' : '')), shadow: o.castShadow + '/' + o.receiveShadow }); });
    const room = {}; let rt = 0, rm = 0; R.roomGroup.traverse(o => { if (o.isMesh || o.isPoints) { rm++; const t = o.isMesh ? tri(o.geometry) : 0; rt += t; const k = (o.material.type || '') + (o.geometry.type !== 'BufferGeometry' ? ':' + o.geometry.type : ''); room[k] = (room[k] || 0) + t; } });
    const big = []; R.roomGroup.traverse(o => { if (o.isMesh && tri(o.geometry) > 5000) big.push({ n: o.name, tris: tri(o.geometry), mat: (Array.isArray(o.material) ? o.material : [o.material]).map(m => m.type + ' ' + texOf(m).join(',')).join('|'), cast: o.castShadow, recv: o.receiveShadow, culled: o.frustumCulled }); });
    const lights = []; R.scene.traverse(o => { if (o.isLight) lights.push(o.type + ' i=' + o.intensity.toFixed(1) + (o.castShadow ? ' SOMBRA ' + o.shadow.mapSize.x : '')); });
    return { av, roomMeshes: rm, roomTris: rt, room, big, lights, shadowAuto: R.renderer.shadowMap.autoUpdate, info: { ...R.renderer.info.memory }, progs: R.renderer.info.programs.length, caps: { maxTex: R.renderer.capabilities.maxTextureSize, floatBone: R.renderer.capabilities.isWebGL2 } };
  });
  console.log(JSON.stringify(inv, null, 1));
}
const c = await p.createCDPSession(); if (cpu > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: cpu });
if (state === 'juego') {
  for (let k = 0; k < 14; k++) { const ph = await p.evaluate(async () => { const b = '/juego/'; const V = await import(b + 'ui/voice.js'); const Pl = await import(b + 'player.js'); if (window.S.phase === 'brief') return 'brief'; V.voStop(); V.VO.armed = true; Pl.player.set(0, Pl.player.y, 0); (await import(b + 'ui/prelude.js')).enterZone(); return window.S.phase; }); if (ph === 'brief') break; await sleep(600); }
  await sleep(800); await p.evaluate(async () => (await import('/juego/flow.js')).startRoom()); await sleep(3000);
}
if (state === 'camina') { await p.keyboard.down('KeyA'); await sleep(800); }
await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 250 }); await c.send('Profiler.start');
await sleep(5000);
const { profile } = await c.send('Profiler.stop');
const self = new Map(); const dt = profile.timeDeltas, ids = profile.samples; const byId = new Map(profile.nodes.map(n => [n.id, n]));
let total = 0; ids.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ' @' + n.callFrame.url.split('/').slice(-2).join('/') + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + dt[i]); total += dt[i]; });
const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP || 24));
console.log(`SOL · ${state} · cpu×${cpu} · touch ${touch} · total ${(total / 1000).toFixed(0)} ms`);
for (const [k, v] of rows) console.log((v / total * 100).toFixed(1).padStart(5) + '%  ' + (v / 1000).toFixed(0).padStart(5) + ' ms  ' + k);
await b.close();
