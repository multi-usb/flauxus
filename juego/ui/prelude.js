/* ======================================================================
   FLAUXUS — ui/prelude.js
   Preludio de cada sala: el usuario camina mientras escucha a María Clara.
   Al final del texto se arma el círculo de luz y empieza el Momento.
   ====================================================================== */
import * as THREE from 'three';
import { S } from '../core/state.js';
import { PRELUDE } from '../core/config.js';
import { $, TOUCH, LIME, PALE, lerp, clamp, damp } from '../core/util.js';
import { T } from '../core/time.js';
import { TRIG_LABEL, ROOMS } from '../Rooms.js';
import { roomGroup, camera } from '../engine/renderer.js';
import { H } from '../engine/fx.js';
import { HM } from './hudMetrics.js';
import { avatarObj } from '../engine/avatar.js';
import { glowSprite, makeTextSprite, clearGroup } from '../engine/materials.js';
import { A } from '../AudioSystem.js';
import { player, stopAuto, updateCam, resetPlayerForPrelude } from '../player.js';
import { voRun, voStop, voPreload, VO } from './voice.js';
import { fade } from './hud.js';
import { toast } from './toast.js';

export const PRE = { grp: null, home: null, ring: null, halo: null, beam: null, lab: null, dots: [] };
/* El rótulo 3D del círculo («DECIDIR LA FRASE»…) flota a 3,9 m. En celulares compactos, vistos desde atrás de la
   avatar, se proyectaba bajo los botones «Volver» y «Saltar locución» y solo asomaban letras sueltas. Ahora baja
   lo justo para quedar bajo la franja del HUD medida (HM.top), nunca por debajo de la cabeza de la avatar; si ni
   así cabe, se desvanece en vez de quedar cortado. En pantallas con sitio no cambia nada. */
const LAB_H = 3.9, _lv = new THREE.Vector3();
function labelFit(dt) {
  const lab = PRE.lab, g = PRE.grp.position; if (!lab) return;
  const sy = h => { _lv.set(g.x, g.y + h, g.z).project(camera); return _lv.z < 1 ? (-_lv.y * .5 + .5) * H : null };
  const top = HM.top + 26, hMin = Math.min(LAB_H, 1.78 * (avatarObj.scale.y || 1) + .5), y1 = sy(LAB_H), y0 = sy(hMin); let h = LAB_H, op = 1;
  if (y1 !== null && y0 !== null && y1 < top) { h = y0 > y1 + 1 ? clamp(LAB_H - (top - y1) / (y0 - y1) * (LAB_H - hMin), hMin, LAB_H) : hMin; if (y0 < top) op = clamp(1 - (top - y0) / 40, 0, 1) }
  lab.position.y = damp(lab.position.y, h, 6, dt); lab.material.opacity = damp(lab.material.opacity, op, 8, dt)
}
export function preBuild(id) {
  const r = ROOMS[id - 1];
  const floorY = r?.floorY ?? r?.start?.y ?? 0;
  const tx = r?.trigger?.x ?? 0;
  const tz = r?.trigger?.z ?? 0;
  const g = new THREE.Group();
  g.position.set(tx, floorY, tz);
  roomGroup.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PRELUDE.trigR, .07, 10, 72), new THREE.MeshBasicMaterial({ color: PALE, transparent: true, opacity: .9 })); ring.rotation.x = Math.PI / 2; ring.position.y = .06; g.add(ring);
  const halo = glowSprite(LIME, PRELUDE.trigR * 3.4, .12); halo.position.y = .3; g.add(halo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .04, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = 6; g.add(beam);
  const lab = makeTextSprite(TRIG_LABEL[id], '#efeadb', 6.2, 34, true); lab.position.set(0, LAB_H, 0); lab.material.transparent = true; g.add(lab);
  const dots = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: LIME })); m.scale.setScalar(0); g.add(m); dots.push(m) }
  Object.assign(PRE, { grp: g, ring, halo, beam, lab, dots })
}
/* `narrate = false` prepara la sala en silencio mientras el preloader tapa
   la escena; la locución arranca después, cuando el nivel ya es visible,
   para que el usuario no se pierda las primeras palabras. */
export function initPrelude(id, narrate = true) {
  const r = ROOMS[id - 1];
  const floorY = r?.floorY ?? r?.start?.y ?? 0;
  const gp = r?.gameAvatarPos;
  PRE.home = gp
    ? new THREE.Vector3(gp.x, gp.y ?? floorY, gp.z)
    : new THREE.Vector3(0, floorY, 0);
  PRE.homeYaw = gp?.yaw ?? 0;
  preBuild(id);
  const startPos = {
    x: r?.start?.x ?? PRELUDE.start.x,
    y: r?.start?.y ?? floorY,
    z: r?.start?.z ?? PRELUDE.start.z,
    yaw: r?.start?.yaw ?? Math.PI
  };
  resetPlayerForPrelude(startPos, floorY);
  avatarObj.position.copy(player); avatarObj.rotation.y = startPos.yaw;
  stopAuto(); A.ambient?.set(.35, .8); updateCam();
  voPreload(id);   // la grabación de la voz se pide ya, mientras la cortina aún tapa la sala
  if (narrate) voRun(id);
}

/* La voz se lanza desde `flow.js` justo después del fundido del preloader. */
export function startPreludeVoice(id) { voRun(id) }
export function updatePrelude(dt) {
  if (!PRE.grp) return;
  const id = S.room, r = ROOMS[id - 1], floorY = r?.floorY ?? r?.start?.y ?? 0;
  const tx = r?.trigger?.x ?? 0, tz = r?.trigger?.z ?? 0;
  const trigR = r?.trigger?.r ?? PRELUDE.trigR;
  const d = Math.hypot(player.x - tx, player.z - tz), near = d < trigR, armed = VO.armed;

  PRE.ring.material.color.setHex(armed ? LIME : PALE);
  PRE.ring.scale.setScalar(1 + .04 * Math.sin(T * 3));
  PRE.halo.material.opacity = armed ? .4 + .2 * Math.sin(T * 3) : .12;
  PRE.beam.material.opacity = armed ? .12 + .04 * Math.sin(T * 3) : .04;
  labelFit(dt);

  const sx = r?.start?.x ?? PRELUDE.start.x, sz = r?.start?.z ?? PRELUDE.start.z;
  PRE.dots.forEach((m, i) => {
    const f = ((i / PRE.dots.length) + T * .3) % 1;
    const sc = armed && d > trigR + 1.5 ? Math.sin(f * Math.PI) : 0;
    m.position.set(lerp(sx, tx, f) * .9, floorY + .16, lerp(sz, tz, f) * .9);
    m.scale.setScalar(sc);
  });

  const pr = $('prompt');
  if (armed && near) {
    const m = `${TRIG_LABEL[id]}${TOUCH ? '' : ' <kbd>E</kbd>'}`;
    if (pr.dataset.m !== m) { pr.dataset.m = m; pr.innerHTML = m; }
    pr.classList.add('show');
  } else pr.classList.remove('show');

  const co = $('coach');
  let msg = '';
  if (!VO.active && !near) msg = TOUCH ? 'Camina hasta el círculo de luz · toca el suelo o usa el círculo' : 'Camina hasta el círculo de luz · clic en el suelo o <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>';
  if (msg) { if (co.dataset.m !== msg) { co.innerHTML = msg; co.dataset.m = msg; } co.classList.add('show'); } else { co.classList.remove('show'); co.dataset.m = ''; }
}
export function enterZone() {
  if (S.phase !== 'prelude' || S.busy) return;
  const r = ROOMS[S.room - 1];
  const tx = r?.trigger?.x ?? 0, tz = r?.trigger?.z ?? 0;
  const trigR = r?.trigger?.r ?? PRELUDE.trigR;
  if (!VO.armed) { toast('Escucha hasta el final, o pulsa «Saltar locución»'); return; }
  if (Math.hypot(player.x - tx, player.z - tz) >= trigR) { toast('Acércate al círculo de luz'); return; }
  S.busy = true; voStop(); stopAuto(); fade(() => {
    if (PRE.grp) { clearGroup(PRE.grp); roomGroup.remove(PRE.grp) } PRE.grp = null; PRE.lab = null; $('prompt').classList.remove('show'); $('coach').classList.remove('show');
    avatarObj.position.copy(PRE.home);
    avatarObj.rotation.y = PRE.homeYaw ?? 0;
    S.phase = 'brief'; $('brief').classList.add('show'); A.ambient?.set(0, .4); S.busy = false;
  });
}
