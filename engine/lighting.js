/* ======================================================================
   FLAUXUS — engine/lighting.js
   Pool fijo de luces + presets por escenario. Cambiar de sala solo
   reconfigura las luces existentes: no recompila shaders.
   ====================================================================== */
import * as THREE from 'three';
import { LIME, V3 } from '../core/util.js';
import { QUALITY, SHADOW_R } from '../core/config.js';
import { ROOMS } from '../Rooms.js';
import { scene, renderer, BGT, hemi, key, rimL, bloom } from './renderer.js';

/* ---- presets de luz por escenario ----
   Unidades físicas (three r155+): intensidad = e · r² con decay 2, donde `e` ≈ iluminancia a `r` metros de la luz.
   Así e≈1 es "se nota claramente" a esa distancia. (Antes las puntuales valían 2–3 a 5–12 m: casi no iluminaban.)
   Afinar en vivo con ?light (panel) y copiar el JSON de vuelta aquí. */
export const LIGHT_PRESETS = {
  atrium: {
    // Fondo, niebla y luz ambiental cálida coordinados con el concept art
    bg: 0x241a14, fog: .011, exp: .92, env: .32, hemi: [0xf0e6d6, 0x2e1e16, .45], key: { c: 0xffeed8, i: 1.15, p: [12, 24, 8] }, rim: { c: LIME, base: 2.2, k: 8 }, bloomT: .85,
    pts: [{ gate: 1, c: LIME, e: 1.0, r: 3, p: [0, 3, 0] }, { c: 0xfff0d4, e: 1.1, r: 8, p: [0, 9, 0] }], spot: { c: 0xfffaec, e: 1.5, r: 24, p: [0, 24, 0], t: [0, 1.4, 0], ang: .7, pen: .6 }
  },
  ...Object.fromEntries(ROOMS.map(r => [r.id, r.light]))
};
const _gp = new V3(), _c0 = new V3(0, 3, 0);
export class LightingManager {
  constructor() {
    this.id = 'atrium'; this.P = LIGHT_PRESETS.atrium; this.keyOff = new V3(12, 24, 8); this.rimK = 8; this.onApply = null;
    this.avatarLight = new THREE.PointLight(0xfff5e6, 2.4, 12, 2); scene.add(this.avatarLight);
    this.pts = []; for (let i = 0; i < QUALITY.pts; i++) { const l = new THREE.PointLight(0xffffff, 0, 0, 2); scene.add(l); this.pts.push(l) }
    this.spot = null; if (QUALITY.spot) { this.spot = new THREE.SpotLight(0xffffff, 0, 0, .7, .5, 2); scene.add(this.spot); scene.add(this.spot.target) }
    this.blob = null;
    if (!QUALITY.shadows) { // sombra "blob" barata para móvil
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      this.blob = new THREE.Mesh(new THREE.CircleGeometry(.8, 24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1; scene.add(this.blob);
    }
    this.configure();
  }
  setMode(mode, roomId = 0) { this.apply(mode === 'atrium' ? 'atrium' : roomId) }
  apply(id) { this.id = id; this.P = LIGHT_PRESETS[id] || LIGHT_PRESETS.atrium; this.configure(); this.onApply?.() }
  configure() {
    const P = this.P;
    BGT.setHex(P.bg); scene.fog.density = P.fog; renderer.toneMappingExposure = P.exp; scene.environmentIntensity = P.env;
    hemi.color.setHex(P.hemi[0]); hemi.groundColor.setHex(P.hemi[1]); hemi.intensity = P.hemi[2];
    key.color.setHex(P.key.c); key.intensity = P.key.i; this.keyOff.set(P.key.p[0], P.key.p[1], P.key.p[2]);
    rimL.color.setHex(P.rim.c); this.rimK = P.rim.k; rimL.intensity = P.rim.base * P.rim.k;
    this.pts.forEach((l, i) => { const c = P.pts[i]; if (!c) { l.intensity = 0; return } l.color.setHex(c.c); l.position.set(c.p[0], c.p[1], c.p[2]); l.intensity = c.e * c.r * c.r });
    if (this.spot) { const s = P.spot; this.spot.color.setHex(s.c); this.spot.intensity = s.e * s.r * s.r; this.spot.angle = s.ang; this.spot.penumbra = s.pen; this.spot.position.set(s.p[0], s.p[1], s.p[2]); this.spot.target.position.set(s.t[0], s.t[1], s.t[2]) }
  }
  update(pos, dt, isAtrium) {
    this.avatarLight.position.set(pos.x, pos.y + 1.9, pos.z + .35);
    if (QUALITY.shadows) { // el frustum de sombra sigue al avatar, "pegado" a la rejilla de texeles para que no tiemble
      const ts = SHADOW_R * 2 / QUALITY.shadowMap, sx = Math.round(pos.x / ts) * ts, sz = Math.round(pos.z / ts) * ts;
      key.target.position.set(sx, pos.y, sz); key.position.set(sx + this.keyOff.x, pos.y + this.keyOff.y, sz + this.keyOff.z);
    } else key.position.copy(this.keyOff);
    if (this.blob) this.blob.position.set(pos.x, pos.y + .04, pos.z);
    if (bloom) bloom.threshold = this.P.bloomT;
  }
  /* En el atrio UNA luz acompaña a la escalera que late (antes: 6 puntuales fijas, una por escalera). */
  gate(groups, t, T) {
    const c = this.P.pts[0]; if (!c || !c.gate || !this.pts[0]) return; const l = this.pts[0], base = c.e * c.r * c.r, g = t && groups[t - 1];
    if (g) { g.userData.gate.getWorldPosition(_gp); l.position.lerp(_gp, .1); l.intensity = base * (1 + .3 * Math.sin(T * 3.5)) } else { l.position.lerp(_c0, .05); l.intensity = base * .6 }
  }
}
export const lightingManager = new LightingManager();
export const addRoomLight = () => { }, clearRoomLights = () => { };
export const rimSet = v => { rimL.intensity = v * lightingManager.rimK };
