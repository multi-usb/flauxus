// SOL: el mapa de alturas frente al rayo original contra la malla (misma semántica que ground.roomHeight) + coste del toque.
import { launch, sleep, BASE } from './lib.mjs';
const b = await launch(); const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/juego/?room=5&debug&input=touch`);
await p.waitForFunction(() => { const pre = document.getElementById('preloader'); return window.S && pre && !pre.classList.contains('on') && window.S.room === 5 && window.S.ready; }, { timeout: 120000 });
await sleep(2000);
const r = await p.evaluate(async () => {
  const F = window.__FLX, THREE = F.THREE, g = F.groundController, obj = g.roomObj; const Pl = await import('/juego/player.js'); const R = await import('/juego/engine/renderer.js');
  const rc = new THREE.Raycaster(); const down = new THREE.Vector3(0, -1, 0); const meshes = []; obj.traverse(o => { if (o.isMesh) meshes.push(o); });
  const real = (o, d, far) => { rc.set(o, d); rc.far = far; const hits = []; for (const m of meshes) THREE.Mesh.prototype.raycast.call(m, rc, hits); return hits.sort((a, b) => a.distance - b.distance); };
  const out = { mapa: !!g.roomMap, floorRay: !!F.rooms?.[4]?.floorRay, mallas: meshes.length, rayoPropio: meshes.every(m => m.raycast !== THREE.Mesh.prototype.raycast) };
  // 1 · paseos radiales: altura "pisable" con el rayo real (encadenando la altura actual) frente a getHeight()
  let n = 0, dif6 = 0, dif15 = 0, maxD = 0, sinRayo = 0; const peores = [];
  for (let k = 0; k < 24; k++) { const ang = k * .2618; let cy = .358; for (let rr = 0; rr <= 12; rr += .13) { const x = Math.sin(ang) * rr, z = Math.cos(ang) * rr; let best = null; for (const h of real(new THREE.Vector3(x, cy + 1.6, z), down, 12)) if (h.point.y <= cy + .55 && (best === null || h.point.y > best)) best = h.point.y; const m = g.getHeight(x, z, cy, false); n++; if (best === null) { sinRayo++; continue; } cy = best; const d = Math.abs(m - best); if (d > maxD) maxD = d; if (d > .06) dif6++; if (d > .15) { dif15++; if (peores.length < 8) peores.push([+x.toFixed(2), +z.toFixed(2), +best.toFixed(3), +m.toFixed(3)]); } } }
  out.alturas = { muestras: n, sinRayo, 'dif>6cm': dif6, 'dif>15cm': dif15, maxDif: +maxD.toFixed(3), peores };
  // 2 · toques: punto de impacto del rayo de cámara (rayo real frente al del mapa) y coste de clickToGo
  const cam = R.camera; let tn = 0, tmax = 0, fallos = 0; const ndc = new THREE.Vector2(), rc2 = new THREE.Raycaster();
  for (let i = 0; i < 40; i++) { ndc.set(Math.random() * 1.6 - .8, -Math.random() * .8 - .05); rc2.setFromCamera(ndc, cam); const a = real(rc2.ray.origin.clone(), rc2.ray.direction.clone(), 120)[0]; rc2.far = 120; const hh = []; meshes[0].raycast(rc2, hh); const bq = hh[0]; if (!a && !bq) continue; if (!a || !bq) { fallos++; continue; } tn++; const d = Math.hypot(a.point.x - bq.point.x, a.point.z - bq.point.z); if (d > tmax) tmax = d; }
  out.toques = { comparados: tn, soloUno: fallos, maxDifXZ: +tmax.toFixed(3) };
  const t0 = performance.now(); for (let i = 0; i < 20; i++) Pl.clickToGo(innerWidth * (.2 + .03 * i), innerHeight * .45); out.clickToGoMs = +((performance.now() - t0) / 20).toFixed(3);
  const t1 = performance.now(); for (let i = 0; i < 3; i++) real(new THREE.Vector3(i, 5, 2), down, 12); out.rayoRealMs = +((performance.now() - t1) / 3).toFixed(1);
  return out;
});
console.log(JSON.stringify(r, null, 1), errs);
await b.close();
