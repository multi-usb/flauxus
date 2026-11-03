/* ======================================================================
   FLAUXUS — ui/debug.js
   Herramientas de dirección de arte y pruebas. Solo se activan con
   parámetros de URL (?perf, ?light, ?debug); no afectan al juego publicado.
   ====================================================================== */
import * as THREE from 'three';
import { qs } from '../core/util.js';
import { QUALITY as QUALITY_CFG } from '../core/config.js';
import { S, rooms } from '../core/state.js';
import { renderer, scene, world, roomGroup, composer } from '../engine/renderer.js';
import { lightingManager, LIGHT_PRESETS } from '../engine/lighting.js';
import { groundController } from '../engine/ground.js';
import { assetManager, placeFBX } from '../AssetManager.js';
import { NAV, SPAWN, navY, placeAtSpawn, navFloor, navPath, navNode, onAtriumLoaded } from '../NavMesh.js';
import { stairGroups } from '../atrium/atrium.js';
import { keys } from '../core/inputState.js';
import { player } from '../player.js';
import { enterRoom, startGame, finish, cur } from '../flow.js';

export let perfEl = null; const pf = { t: 0, n: 0 };

export function perfTick(dt) {
  if (!perfEl) return; pf.n++; pf.t += dt; if (pf.t < .5) return;
  const i = renderer.info; let nl = 0; scene.traverseVisible(o => { if (o.isLight) nl++ });
  perfEl.textContent = `${Math.round(pf.n / pf.t)} fps · ${QUALITY_CFG.tier}\ncalls* ${i.render.calls} · tris ${(i.render.triangles / 1000).toFixed(0)}k\ngeom ${i.memory.geometries} · tex ${i.memory.textures} · prog ${i.programs?.length ?? '?'}\nluces ${nl} · sombra ${QUALITY_CFG.shadows ? 'sí' : 'blob'}\n* incluye pasadas de bloom`;
  pf.n = 0; pf.t = 0;
}

const PR_MAX = renderer.getPixelRatio(); let prAvg = 16, prCool = 3;
export function adaptRes(dt) { // resolución adaptativa: baja el pixel ratio si el frame time se dispara, lo recupera si hay margen
  prAvg += (dt * 1000 - prAvg) * Math.min(1, dt / 1.2); prCool -= dt; if (prCool > 0) return;
  const cur = renderer.getPixelRatio(); let nx = cur;
  if (prAvg > 24 && cur > .6) nx = Math.max(.6, cur - .15); else if (prAvg < 14.5 && cur < PR_MAX) nx = Math.min(PR_MAX, cur + .1);
  if (nx !== cur) { renderer.setPixelRatio(nx); composer?.setPixelRatio(nx); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); prCool = 3 }
}

export function initDebug() {
  if (qs.has('perf') || qs.has('light')) {
    perfEl = document.createElement('pre');
    perfEl.style.cssText = 'position:fixed;left:8px;top:8px;z-index:90;margin:0;padding:6px 9px;font:11px/1.45 ui-monospace,Menlo,monospace;color:#c9d000;background:rgba(0,0,0,.65);border-radius:6px;pointer-events:none';
    document.body.appendChild(perfEl); renderer.info.autoReset = false
  }
  if (qs.has('light')) (async () => {
    try {
      const { default: GUI } = await import('https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/+esm');
      const gui = new GUI({ title: 'Luz del escenario' }), lm = lightingManager; let f = null;
      const hex = (o, k) => ({ get c() { return '#' + o[k].toString(16).padStart(6, '0') }, set c(v) { o[k] = parseInt(v.slice(1), 16); lm.configure() } });
      const num = (o, k, a, b, st, name) => f.add(o, k, a, b, st).name(name).onChange(() => lm.configure());
      const build = () => {
        f?.destroy(); const P = lm.P; f = gui.addFolder('Preset: ' + lm.id); f.open();
        num(P, 'exp', .3, 2, .01, 'exposición'); num(P, 'env', 0, 1.5, .01, 'IBL (relleno)'); num(P, 'fog', 0, .06, .001, 'niebla'); num(P, 'bloomT', .3, 1, .01, 'bloom umbral');
        num(P.hemi, '2', 0, 2, .01, 'hemisferio'); f.addColor(hex(P.hemi, 0), 'c').name('hemi cielo').onChange(() => lm.configure());
        num(P.key, 'i', 0, 4, .01, 'luz principal'); f.addColor(hex(P.key, 'c'), 'c').name('principal color').onChange(() => lm.configure());
        num(P.rim, 'k', 0, 30, .1, 'rim ganancia');
        P.pts.forEach((c, i) => { if (!lm.pts[i]) return; num(c, 'e', 0, 4, .01, 'punto ' + (i + 1) + ' e'); f.addColor(hex(c, 'c'), 'c').name('punto ' + (i + 1) + ' color').onChange(() => lm.configure()) });
        if (lm.spot) { num(P.spot, 'e', 0, 4, .01, 'foco e'); num(P.spot, 'ang', .2, 1.4, .01, 'foco ángulo'); num(P.spot, 'pen', 0, 1, .01, 'foco penumbra') }
      };
      lm.onApply = build; build();
      gui.add({ copiar() { const t = JSON.stringify(LIGHT_PRESETS); navigator.clipboard?.writeText(t); console.log(t) } }, 'copiar').name('Copiar presets (JSON)');
    } catch (e) { console.warn('Panel de luz no disponible', e) }
  })();
  if (qs.has('debug')) window.__FLX = { NAV, navFloor, navPath, navNode, onAtriumLoaded, get stairGroups() { return stairGroups }, get navY() { return navY }, SPAWN, keys, placeAtSpawn, THREE, placeFBX, world, roomGroup, groundController, renderer, scene, lightingManager, assetManager, QUALITY: QUALITY_CFG, S, enterRoom, startGame, finish, rooms, player, get cur() { return cur } }; // solo para pruebas (?debug)
}
