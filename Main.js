/* ======================================================================
   FLAUXUS — Main.js (Entry Point)
   Solo inicializa módulos, cablea la entrada y ejecuta el bucle.
   El motor vive en engine/, el atrio en atrium/, la UI en ui/, el
   movimiento en player.js y el flujo de salas en flow.js.
   ====================================================================== */
import { $, clamp, lerp, damp, rand, lerpAngle, TOUCH, qs, V3, LIME, LIMEH, PAPER, PALE, FONT, SERIF } from './core/util.js';
import { T, tickTime } from './core/time.js';
import { QUALITY, CARDS, OPLIST, HAND, EXPERIMENT } from './core/config.js';
import { S, roomGen } from './core/state.js';
import { ptr, keys, ptrActive } from './core/inputState.js';
import { A, ensureAudio, setMuted, audioLevel } from './AudioSystem.js';
import { navInit, navVizUpdate } from './NavMesh.js';
import { ROOMS, roomsInit, roomsUpdate } from './Rooms.js';
import { GX } from './GameContext.js';
import { scene, renderer, camera, composer, bloom, roomGroup, BG, BGT } from './engine/renderer.js';
import { mat, makeDust, glowSprite, makeTextSprite } from './engine/materials.js';
import { ctx, W, H, DPR, resize2d, burst, ringFx, ftext, shake, glowCircle, bolt, toScreen, fxUpdate, fxDraw, decayShake, getShake } from './engine/fx.js';
import { avatarObj, animAvatar } from './engine/avatar.js';
import { lightingManager, rimSet } from './engine/lighting.js';
import { groundController, setAtriumFBXObj } from './engine/ground.js';
import { stairGroups, makeAtrium, paintHuella } from './atrium/atrium.js';
import { hint, setRoomInfo, renderProgress, reshowRoomInfo } from './ui/hud.js';
import { toast } from './ui/toast.js';
import { updatePrelude, enterZone } from './ui/prelude.js';
import {
  rig, player, vel, moveInput, updateCam, updateAtrium, roomCamera, walkNext, walkTo,
  clickToGo, tryJump, setLookHold, setCamDt, setPlayerCallbacks, resetPlayerPhysics, stairLocal
} from './player.js';
import { startGame, tryEnter, enterRoom, startRoom, leaveRoom, afterDone, cur, bootGame, finish } from './flow.js';
import { initDebug, perfTick, adaptRes, perfEl } from './ui/debug.js';

/* ======================================================================
   CONTEXTO COMPARTIDO + NAVMESH
   ====================================================================== */
setPlayerCallbacks({ enterRoom });

navInit({
  player, vel, stairGroups, S, scene, qs, clamp, stairLocal,
  setAtriumFBXObj, resetPlayerPhysics,
  navCal: Object.fromEntries(ROOMS.map(r => [r.id, r.nav || {}]))
});

GX._set({
  renderer, S, roomGroup, avatarObj, camera, bloom, scene, mat, makeDust,
  glowSprite, makeTextSprite, animAvatar, rimSet, ctx2d: ctx, W, H, DPR,
  burst, ringFx, ftext, shake, glowCircle, bolt, toScreen,
  LIME, LIMEH, PAPER, SERIF, FONT, PALE, CARDS, OPLIST, HAND, EXPERIMENT,
  QUALITY,
  V3, clamp, lerp, damp, rand, lerpAngle, TOUCH, ptr, keys, ptrActive,
  hint, toast, finish, moveInput, groundController,
  roomGen, T, $
});
roomsInit();
makeAtrium();

/* ======================================================================
   ENTRADA (pointer unificado: mouse + táctil)
   ====================================================================== */
const isUI = e => !!(e.target.closest && e.target.closest('.ui,button,.lcard,.breath'));
let tap = null;
addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.type = e.pointerType || 'mouse'; ptr.ui = isUI(e) });
addEventListener('pointerdown', e => {
  if (isUI(e)) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.type = e.pointerType || 'mouse'; ptr.down = true;
  if (S.phase === 'atrium' || S.phase === 'prelude') tap = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; else if (S.phase === 'play') cur?.onDown?.(e)
});
addEventListener('pointerup', e => {
  ptr.down = false;
  if (tap && e.pointerId === tap.id && (S.phase === 'atrium' || S.phase === 'prelude') && performance.now() - tap.t < 450 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12 && (e.pointerType === 'touch' || e.button === 0)) clickToGo(e.clientX, e.clientY); tap = null
});
addEventListener('pointercancel', () => { ptr.down = false; tap = null });
// cámara opcional (escritorio): arrastrar con botón derecho/central orbita, rueda = zoom
let orbit = null; const orbitOK = () => S.phase === 'atrium' || S.phase === 'prelude';
addEventListener('pointerdown', e => { if ((e.button === 2 || e.button === 1) && orbitOK() && !isUI(e)) { orbit = { x: e.clientX, y: e.clientY, id: e.pointerId }; tap = null; e.preventDefault() } });
addEventListener('pointermove', e => { if (!orbit || e.pointerId !== orbit.id) return; rig.yaw += (e.clientX - orbit.x) * .005; rig.pitch = clamp(rig.pitch + (e.clientY - orbit.y) * .004, -.5, .3); orbit.x = e.clientX; orbit.y = e.clientY; rig.hold = 1.6 });
const orbitEnd = e => { if (orbit && e.pointerId === orbit.id) orbit = null };
addEventListener('pointerup', orbitEnd); addEventListener('pointercancel', orbitEnd);
addEventListener('contextmenu', e => { if (orbitOK()) e.preventDefault() });
addEventListener('wheel', e => { if (!orbitOK() || isUI(e)) return; rig.dist = clamp(rig.dist + Math.sign(e.deltaY) * .4, 3.2, 10) }, { passive: true });
addEventListener('blur', () => { keys.clear(); ptr.down = false; tap = null; setLookHold(false) });
const lookEl = $('btnLook'); lookEl.addEventListener('pointerdown', e => { setLookHold(true); lookEl.setPointerCapture(e.pointerId) });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => lookEl.addEventListener(n, () => setLookHold(false)));
addEventListener('keydown', e => {
  const c = e.code; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c) && !(e.target.tagName === 'BUTTON' && c === 'Space' && !((S.phase === 'atrium' || S.phase === 'prelude') && !$('help').classList.contains('show')))) e.preventDefault();
  if (e.repeat) { keys.add(c); return } keys.add(c);
  if (c === 'KeyM') { if (ensureAudio()) setMuted(!A.muted); return }
  if (c === 'KeyH' || c === 'Escape') { toggleHelp(); return }
  if ($('help').classList.contains('show')) return;
  if (S.phase === 'intro' && (c === 'Enter' || c === 'Space')) { startGame(); return }
  if (S.phase === 'atrium' || S.phase === 'prelude') {
    if (c === 'Space') { tryJump(); return }
    if (S.phase === 'atrium') {
      if (c === 'KeyE' || c === 'Enter') tryEnter();
      else if (c === 'KeyC' && !e.ctrlKey && !e.metaKey && !e.altKey) walkNext();
    } else if (c === 'KeyE' || c === 'Enter') enterZone();
    else if (c === 'KeyQ') leaveRoom();
  }
  else if (S.phase === 'brief') { if (c === 'Enter' || c === 'Space') startRoom(); else if (c === 'KeyQ') leaveRoom() }
  else if (S.phase === 'play') { if (c === 'KeyQ') leaveRoom(); else cur?.onKey?.(c, e) }
  else if (S.phase === 'done' && (c === 'Enter' || c === 'Space')) afterDone()
});
addEventListener('keyup', e => keys.delete(e.code));
function toggleHelp() { $('help').classList.toggle('show') }
$('btnHelp').onclick = toggleHelp; $('helpClose').onclick = toggleHelp; $('btnSound').onclick = () => { ensureAudio(); setMuted(!A.muted) };
$('btnWalk').innerHTML = `Ir a la siguiente sala${TOUCH ? '' : ' <kbd>C</kbd>'}`; $('btnWalk').onclick = () => { $('btnWalk').blur(); walkNext() };
$('btnStart').onclick = startGame; $('prompt').onclick = () => S.phase === 'prelude' ? enterZone() : tryEnter(); $('btnBack').onclick = () => leaveRoom();
$('introHow').innerHTML = TOUCH ? `<span class="tchip">Tocar</span><span>El suelo: el avatar camina solo</span><span class="tchip">Círculo</span><span>Caminar con el pulgar</span><span class="tchip">Botón</span><span>«Ir a la siguiente sala» te lleva al portal</span><span class="tchip">Dedo</span><span>Tocar y arrastrar dentro de cada sala</span>` : `<span><kbd>Clic</kbd></span><span>En el suelo: el avatar camina solo</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Caminar · <kbd>Shift</kbd> corre</span><span><kbd>Espacio</kbd></span><span>Saltar</span><span><kbd>C</kbd></span><span>Llévame a la siguiente sala</span><span><kbd>E</kbd></span><span>Entrar al portal cercano</span><span><kbd>M</kbd> <kbd>H</kbd></span><span>Silenciar · ayuda</span>`;
$('helpBody').innerHTML = TOUCH ? `<div class="ctl"><span class="keys"><span class="tchip">Tocar</span></span><span>Tocar el suelo: caminar hasta ahí</span></div><div class="ctl"><span class="keys"><span class="tchip">Círculo</span></span><span>Caminar</span></div><div class="ctl"><span class="keys"><span class="tchip">⟳</span></span><span>Mantener para girar la vista (opcional)</span></div><div class="ctl"><span class="keys"><span class="tchip">Botón</span></span><span>«Ir a la siguiente sala» · «Entrar»</span></div>` : `<div class="ctl"><span class="keys"><kbd>Clic</kbd></span><span>Caminar hasta el punto del suelo</span></div><div class="ctl"><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Caminar · <kbd>Shift</kbd> correr</span></div><div class="ctl"><span class="keys"><kbd>Espacio</kbd></span><span>Saltar</span></div><div class="ctl"><span class="keys"><kbd>C</kbd></span><span>Ir solo a la siguiente sala</span></div><div class="ctl"><span class="keys"><kbd>←</kbd><kbd>→</kbd></span><span>Girar la vista (opcional; se orienta sola)</span></div><div class="ctl"><span class="keys"><kbd>E</kbd></span><span>Entrar a la sala</span></div><div class="ctl"><span class="keys"><kbd>Q</kbd></span><span>Volver al atrio</span></div><div class="ctl"><span class="keys"><kbd>M</kbd></span><span>Silenciar</span></div><div class="ctl"><span class="keys"><kbd>H</kbd><kbd>Esc</kbd></span><span>Esta ayuda</span></div>`;
if (!TOUCH) $('btnBack').innerHTML = '← Volver al atrio <kbd class="dk">Q</kbd>';
window.walkNext = walkNext; window.walkTo = walkTo; window.enterRoom = enterRoom; window.player = player; window.stairGroups = stairGroups; window.S = S;

/* ======================================================================
   LOOP
   ====================================================================== */
let lastTime = performance.now();
function frame() {
  requestAnimationFrame(frame); if (perfEl) renderer.info.reset();
  roomsUpdate(); // refresca las referencias dinámicas de Rooms.js (W, H, S, ptr, etc.)
  GX.W = W; GX.H = H; GX.DPR = DPR; GX.T = T; GX.roomGen = roomGen; // actualiza GX cada frame
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, .05);
  lastTime = now;
  tickTime(dt); setCamDt(dt); adaptRes(dt);
  if (document.body.dataset.phase !== S.phase) { if (S.phase === 'atrium' || S.phase === 'prelude') reshowRoomInfo(); document.body.dataset.phase = S.phase } // jerarquía de la interfaz (style.css)
  BG.lerp(BGT, 1 - Math.exp(-3 * dt)); audioLevel();
  const wantJoy = TOUCH && (S.phase === 'atrium' || S.phase === 'prelude' || (S.phase === 'play' && S.room === 4)); if (document.body.classList.contains('joy-on') !== wantJoy) document.body.classList.toggle('joy-on', wantJoy);
  if (S.room && cur?.ambient) cur.ambient(dt, T); // animación de fondo de la sala (p. ej. el holograma de SOL), en preludio y juego
  if (S.phase === 'atrium' || S.phase === 'intro' || S.phase === 'prelude') { updateAtrium(dt); if (S.phase === 'prelude') { updatePrelude(dt); if (bloom) bloom.strength = .45 } }
  else if (S.room && cur) { roomCamera(dt, cur); cur.update3d?.(dt, T); lightingManager.update(avatarObj.position, dt, false); if (S.phase === 'play') { cur.update?.(dt); if (performance.now() - S.playStart > 45000) $('btnSkip').style.display = 'block' } }
  if (S.phase === 'atrium' && bloom) bloom.strength = .45;
  decayShake(dt);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.save(); if (getShake() > .1) ctx.translate((Math.random() - .5) * getShake(), (Math.random() - .5) * getShake());
  if (S.room && cur && S.phase === 'play' && cur.draw) cur.draw(); fxUpdate(dt); fxDraw(); ctx.restore();
  if (composer) composer.render(dt); else renderer.render(scene, camera);
  navVizUpdate(dt); perfTick(dt)
}

setRoomInfo('Atrio central', 'El museo imposible', 'Seis escaleras flotan alrededor del centro. Haz clic en el suelo para caminar y sigue la que late: cada una lleva a un momento distinto.'); renderProgress(); updateCam();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); resize2d() });

initDebug();
frame();
/* La cortina ya está visible: carga el museo completo antes de mostrar la
   portada (o entra directo al Momento si la URL trae `?room=`). */
bootGame();

window.paintHuella = paintHuella;
