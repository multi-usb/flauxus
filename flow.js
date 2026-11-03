/* ======================================================================
   FLAUXUS — flow.js
   Flujo del museo: inicio, entrada a cada Momento, ficha, final y vuelta
   al atrio. Es el único módulo que decide cambios de fase.
   ====================================================================== */
import * as THREE from 'three';
import { $, sleep, TOUCH, LIME, LIMEH, V3, qs } from './core/util.js';
import { entry, ENTRIES, CARDS, HAND, LS, seen, PRELUDE } from './core/config.js';
import { S, rooms, skinKind, bumpRoomGen } from './core/state.js';
import { W, H, burst, ringFx, shake } from './engine/fx.js';
import {
  A, ensureAudio, startAmbient, newBus, killBus, tone, sting,
  recOk, trackFiles, Rec, loadRec
} from './AudioSystem.js';
import { ROOMS, IMPL } from './Rooms.js';
import { world, roomGroup, camera } from './engine/renderer.js';
import { lightingManager } from './engine/lighting.js';
import { avatarObj, setAvatar } from './engine/avatar.js';
import { groundController } from './engine/ground.js';
import { assetManager } from './AssetManager.js';
import { mat, glowSprite, clearGroup } from './engine/materials.js';
import { paintHuella } from './atrium/atrium.js';
import {
  camCur, camLook, stopAuto, placePlayerAtSpawn,
  placePlayerAtAtrium, setRoomFloor
} from './player.js';
import { setRoomInfo, hint, renderProgress, fade, titleCard, ctlRow, hideRoomDom } from './ui/hud.js';
import { initPrelude } from './ui/prelude.js';
import { showEpilogue } from './ui/epilogue.js';
import { toast } from './ui/toast.js';

export let cur = null;

export function startGame() {
  if (S.phase !== 'intro') return; ensureAudio(); startAmbient(); $('intro').classList.add('hide'); setTimeout(() => $('intro').style.display = 'none', 650); S.phase = 'atrium'; S.sessionStart = performance.now();
  placePlayerAtSpawn(Math.PI); renderProgress(); setAvatar(skinKind(0));
  seen.add(entry); LS.set('flauxus.entries.v1', [...seen]); showUnlock();
  assetManager.warm(1); // Precarga el modelo de DO en segundo plano mientras estás en el atrio
}
export function showUnlock() {
  const d = ENTRIES[entry]; if (!d.skill) return; const el = $('unlock');
  const extra = entry === 'cards' ? `<span class="cards">${HAND.map(c => CARDS[c].n).join(' · ')}</span>` : '';
  el.innerHTML = `<div class="k">Habilidad desbloqueada</div><strong>${d.skill}</strong><span>${d.blurb}</span>${extra}`;
  setTimeout(() => { el.classList.add('show'); tone(783.99, .5, 'sine', .04, 0, A.master); tone(1174.66, .7, 'sine', .03, .09, A.master) }, 1100);
  setTimeout(() => el.classList.remove('show'), 9500)
}
export const ROOM_MAP = Object.fromEntries(ROOMS.flatMap(r => [[r.key, r.id], [r.key + '4', r.id]]));
const roomParam = qs.get('room');
export const directRoom = roomParam ? (parseInt(roomParam, 10) || ROOM_MAP[roomParam.toLowerCase()] || 0) : 0;
export function initDirectRoom() {
  if (directRoom >= 1 && directRoom <= 6) {
    setTimeout(() => {
      startGame();
      setTimeout(() => enterRoom(directRoom), 400);
    }, 150);
  }
}
export function tryEnter() { if (S.phase !== 'atrium') return; if (!S.nearby) { toast('Acércate a un portal, o pulsa «Ir a la siguiente sala»'); return } enterRoom(S.nearby) }
export const GO_LABEL = `Empezar${TOUCH ? '' : ' <span style="opacity:.6;font-weight:500">· Enter</span>'}`;
export function noteRec(id) {
  if (!recOk(id)) { toast('No encontré ' + trackFiles.get(id) + ' junto al HTML · uso sonido provisional'); return }
  if (Rec.fb.has(id) && !S.rfNote) { S.rfNote = true; toast('Modo básico: para el procesado completo abre el prototipo desde un servidor (http), no desde file://') }
}
export function enterRoom(id) {
  if (S.busy) return; S.busy = true; const r = rooms[id - 1]; fade(async () => {
    stopAuto(); S.room = id; S.phase = PRELUDE.enabled ? 'prelude' : 'brief'; cur = IMPL[id];
    world.visible = false; roomGroup.visible = true; clearGroup(roomGroup); bumpRoomGen(); groundController.reset(); groundController.roomObj = null;
    lightingManager.setMode('room', id);
    const floorY = r.start?.y ?? 0;
    groundController.roomFloorY = floorY;
    setAvatar(skinKind(id)); avatarObj.position.set(0, floorY, 0); avatarObj.rotation.y = 0; avatarObj.scale.setScalar(1);
    /* Invisible collision floor for raycasting */
    const f = new THREE.Mesh(new THREE.CircleGeometry(18, 64), mat(0x12130d, { roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.y = floorY - 0.02; f.material.transparent = true; f.material.opacity = 0; f.visible = true; roomGroup.add(f); setRoomFloor(f);
    const disc = glowSprite(LIME, 14, .2); disc.material.depthTest = false; disc.position.y = floorY + 0.05; disc.renderOrder = -1; roomGroup.add(disc);

    // Esperar a que el escenario cargue y se monte antes de mostrar la escena y hablar
    await cur.build();

    camera.fov = 62; camera.updateProjectionMatrix(); camCur.copy(cur.camPos || new V3(0, 2.3, 8.6)); camLook.copy(cur.camLook || new V3(0, 1.7, 0));
    setRoomInfo(`Momento ${id} · ${r.note}`, r.title, r.desc);
    $('sourceChip').style.display = 'block'; $('sourceChip').innerHTML = r.audio === 'real' ? `♪ <b>${r.source}</b>` : `♪ ${r.source}`;
    $('roomUI').classList.add('active'); hideRoomDom(); hint(''); $('btnBack').style.display = 'block'; $('prompt').classList.remove('show'); $('coach').classList.remove('show'); $('compass').style.display = 'none';
    A.ambient?.set(0, .4);
    const pend = r.audio === 'pending' ? `<div class="pend">Audio provisional · pendiente de validar con María Clara</div>` : r.audio === 'none' ? `<div class="pend">Sonido procedural · esta sala no tiene grabación</div>` : '';
    const hlTitle = r.title.replace(/^(\S+)/, '<span class="hl">$1</span>');
    $('brief').innerHTML = `<div class="k">Momento ${id} de 6 · ${r.note}</div><h2>${hlTitle}</h2><p>${r.goal}</p>${pend}${ctlRow(r)}<button class="btn" id="btnGo">${GO_LABEL}</button>`;
    if (!PRELUDE.enabled) $('brief').classList.add('show'); renderProgress(); titleCard(r);
    const need = r.audio === 'real', go = $('btnGo'); S.ready = !need; go.onclick = startRoom;
    if (need) { go.disabled = true; go.textContent = 'Preparando la grabación…'; Promise.race([loadRec(id), sleep(9000)]).then(() => { if (S.room !== id) return; S.ready = true; go.disabled = false; go.innerHTML = GO_LABEL; noteRec(id) }) }
    if (PRELUDE.enabled) initPrelude(id);
    S.busy = false;
  });
}
export function startRoom() { if (S.phase !== 'brief' || !S.ready) return; document.activeElement?.blur?.(); ensureAudio(); newBus(); S.phase = 'play'; S.playStart = performance.now(); $('brief').classList.remove('show'); $('btnSkip').style.display = 'none'; cur.start(); tone(660, .12, 'sine', .04, 0, A.master) }

export function finish(m, lines, skipped = false) {
  if (S.phase !== 'play') return; S.phase = 'done'; S.completed.add(S.room); S.metrics[S.room] = { ...m, skipped, duration: (performance.now() - S.playStart) / 1000 };
  cur.stop?.(); sting(); shake(14); paintHuella();
  const f = $('flash'); f.style.background = '#c9d000'; f.style.opacity = '.16'; f.classList.remove('on'); setTimeout(() => { f.style.opacity = ''; f.style.background = '' }, 260);
  burst(W / 2, H / 2, LIMEH, 60, 420, 1.1, 4); ringFx(W / 2, H / 2, '#fff', 20, 320, .9, 3); hint(''); hideRoomDom(); renderProgress();
  const r = rooms[S.room - 1];
  $('done').innerHTML = `<div class="stamp">${skipped ? 'Saltada' : 'Hecho'}</div><div class="k">Momento completado · ${r.note}</div><h2>${r.title}</h2>${(skipped ? [['Sala', 'saltada']] : lines).map(l => `<div class="stat"><span>${l[0]}</span><u></u><b>${l[1]}</b></div>`).join('')}<button class="btn" id="btnNext">${S.room === 6 ? 'Ver mi partitura' : 'Volver al atrio'}${TOUCH ? '' : ' <span style="opacity:.6;font-weight:500">· Enter</span>'}</button>`;
  setTimeout(() => { if (S.phase === 'done') { $('done').classList.add('show'); $('btnNext').onclick = afterDone } }, 650)
}
export function afterDone() { if (S.phase !== 'done') return; if (S.room === 6) showEpilogue(); else leaveRoom() }
export function leaveRoom() {
  if (S.busy || !S.room) return; S.busy = true; fade(() => {
    cur?.stop?.(); killBus(); hideRoomDom(); $('roomUI').classList.remove('active'); $('btnBack').style.display = 'none'; $('sourceChip').style.display = 'none';
    roomGroup.visible = false; world.visible = true; bumpRoomGen(); groundController.reset(); groundController.roomFloorY = null; groundController.roomObj = null; setAvatar(skinKind(0)); avatarObj.scale.setScalar(1); S.room = 0; cur = null; S.phase = 'atrium';
    lightingManager.setMode('atrium');
    placePlayerAtAtrium();
    setRoomInfo('Atrio central', 'El museo imposible', 'Seis escaleras flotan alrededor del centro. Haz clic en el suelo para caminar y sigue la que late: cada una lleva a un momento distinto.'); A.ambient?.set(1, 1); renderProgress(); S.busy = false; hint('')
  })
}
$('btnSkip').onclick = () => { if (S.phase === 'play') { cur.stop?.(); finish({}, [], true) } };
