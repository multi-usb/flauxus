/* ======================================================================
   FLAUXUS — engine/avatar.js
   Avatar placeholder y su animación. `setAvatar` mantiene sincronizado
   GX.avatarObj para que las salas siempre vean el avatar vigente.
   ====================================================================== */
import * as THREE from 'three';
import { LIME, clamp } from '../core/util.js';
import { mat } from './materials.js';
import { scene } from './renderer.js';
import { A } from '../AudioSystem.js';
import { GX } from '../GameContext.js';

/* ======================================================================
   AVATAR — PLACEHOLDER GEO (se reemplaza por modelo low poly)
   ====================================================================== */
export function avatar(kind) {
  const g = new THREE.Group(), cy = kind === 'cyborg';
  const bodyMat = mat(cy ? 0x1f2119 : 0x2b2c23, { roughness: .9, metalness: cy ? .45 : .05 });
  const skinMat = mat(cy ? 0xe6e3d6 : 0xcfcab8, { roughness: .85, metalness: cy ? .2 : 0 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xf4f7cf, emissive: LIME, emissiveIntensity: cy ? 1.5 : .0, roughness: .3, metalness: .5 });
  const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o };
  const body = new THREE.Group(); g.add(body);
  const torso = M(new THREE.CapsuleGeometry(.44, .85, 4, 12), bodyMat, 0, 1.25, 0); if (kind === 'body') torso.scale.set(1.04, .95, 1.08); body.add(torso);
  body.add(M(new THREE.SphereGeometry(.34, 16, 12), skinMat, 0, 2.28, 0));
  const mkLimb = (x, y, r, len, off) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(M(new THREE.CapsuleGeometry(r, len, 4, 8), bodyMat, 0, off, 0)); g.add(p); return p };
  const armL = mkLimb(-.56, 1.85, .12, .75, -.5), armR = mkLimb(.56, 1.85, .12, .75, -.5), legL = mkLimb(-.22, 1.1, .14, .92, -.5), legR = mkLimb(.22, 1.1, .14, .92, -.5);
  const wl = new THREE.Object3D(); wl.position.set(0, -.95, 0); armL.add(wl); const wr = new THREE.Object3D(); wr.position.set(0, -.95, 0); armR.add(wr);
  const head = new THREE.Object3D(); head.position.set(0, 2.45, 0); g.add(head);
  const flute = M(new THREE.CylinderGeometry(.04, .04, 1.65, 12), mat(0xc9c9c0, { metalness: .9, roughness: .22 }), .28, 1.62, .3); flute.rotation.z = Math.PI / 2 + .12; g.add(flute);
  if (cy) { for (const x of [-.57, .57]) g.add(M(new THREE.BoxGeometry(.2, .2, .2), glowMat, x, 1.85, 0)); g.add(M(new THREE.ConeGeometry(.13, .42, 8), glowMat, 0, 2.8, 0)); const ring = M(new THREE.TorusGeometry(.5, .03, 8, 30), glowMat, 0, 1.25, 0); ring.rotation.x = Math.PI / 2; g.add(ring); head.position.y = 2.78 }
  g.userData = { body, armL, armR, legL, legR, joints: { wl, wr, head }, glowMat, flute, cy }; return g
}
export let avatarObj = avatar('disciplined'); scene.add(avatarObj);
export function setAvatar(kind) { scene.remove(avatarObj); avatarObj = avatar(kind); scene.add(avatarObj); GX.avatarObj = avatarObj }
// El avatar respira con el audio real (A.lvl) cuando toca
export function animAvatar(av, sp, t, play = false, air = 0) {
  const u = av.userData, k = clamp(sp / 6, 0, 1.5), w = t * 9, br = A.lvl;
  if (u.cy) u.glowMat.emissiveIntensity = 1.1 + br * 2.6 + clamp(sp / 6, 0, 1) * .8; // Skin Cyborg: los dispositivos laten con el sonido y con el cuerpo
  u.legL.rotation.x = Math.sin(w) * .75 * k; u.legR.rotation.x = -Math.sin(w) * .75 * k;
  const sw = Math.sin(w) * .55 * k;
  if (play) { u.armL.rotation.x = -1.05 + Math.sin(t * 1.7) * .04; u.armR.rotation.x = -1.15 + Math.sin(t * 1.7 + 1) * .04; u.armL.rotation.z = .5; u.armR.rotation.z = -.5; u.body.rotation.z = Math.sin(t * 1.3) * .03 * (1 + air); u.body.scale.set(1 + br * .05, 1 + br * .035, 1 + br * .05); u.flute.rotation.x = -br * .12 }
  else { u.armL.rotation.x = -sw; u.armR.rotation.x = sw; u.armL.rotation.z = -.15; u.armR.rotation.z = .15; u.body.rotation.z = 0; u.body.scale.set(1, 1, 1) }
  u.body.position.y = Math.abs(Math.sin(w)) * .09 * k + Math.sin(t * 1.6) * .015
}
