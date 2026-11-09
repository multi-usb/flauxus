/* ======================================================================
   FLAUXUS — flow.js
   Flujo del museo: inicio, entrada a cada Momento, ficha, final y vuelta
   al atrio. Es el único módulo que decide cambios de fase.
   ====================================================================== */
import * as THREE from 'three';
import { $, sleep, TOUCH, LIME, LIMEH, V3, qs } from './core/util.js';
import { entry, ENTRIES, CARDS, HAND, LS, seen, PRELUDE } from './core/config.js';
import { S, rooms, skinKind, bumpRoomGen, saveProgress } from './core/state.js';
import { W, H, burst, ringFx, shake } from './engine/fx.js';
import {
  A, ensureAudio, startAmbient, newBus, killBus, tone, sting,
  recOk, trackFiles, Rec, loadRec
} from './AudioSystem.js';
import { ROOMS, IMPL } from './Rooms.js';
import { world, roomGroup, camera, renderer, composer, scene, BG, BGT } from './engine/renderer.js';
import { lightingManager } from './engine/lighting.js';
import { avatarObj, setAvatar } from './engine/avatar.js';
import { groundController } from './engine/ground.js';
import { mat, glowSprite, clearGroup } from './engine/materials.js';
import { paintHuella, atriumReady, refreshAtriumMemory, stairGroups } from './atrium/atrium.js';
import {
  camCur, camLook, stopAuto, placePlayerAtSpawn,
  placePlayerAtAtrium, setRoomFloor
} from './player.js';
import { setRoomInfo, hint, renderProgress, titleCard, ctlRow, hideRoomDom } from './ui/hud.js';
import { initPrelude, startPreludeVoice } from './ui/prelude.js';
import { loaderShow, loaderText, loaderStage, loaderFinish, loaderHide, loaderError } from './ui/loader.js';
import { assetManager } from './AssetManager.js';
import { showEpilogue } from './ui/epilogue.js';
import { toast } from './ui/toast.js';

export let cur = null;

/* ======================================================================
   PREPARACIÓN BAJO EL PRELOADER
   `warmScene()` compila materiales y dibuja el primer frame antes de que la
   cortina se retire. Es la diferencia entre "ya cargó" y "ya se puede
   jugar": evita el tirón de shaders y el frame vacío al descubrir la sala.
   ====================================================================== */
let starting = false;
const nextFrame = () => new Promise(res => requestAnimationFrame(res));

async function warmScene(limit = 14000) {
  try {
    await Promise.race([renderer.compileAsync(scene, camera), sleep(limit)]);
  } catch (e) {
    console.warn('Precompilado de escena', e);
  }
  try {
    if (composer) composer.render(0); else renderer.render(scene, camera);
  } catch (e) {
    console.warn('Primer render', e);
  }
  await nextFrame();
  await nextFrame();
}

function hideIntro() {
  const intro = $('intro');
  if (!intro || intro.style.display === 'none') return;
  intro.classList.add('hide');
  setTimeout(() => { intro.style.display = 'none' }, 650);
}

/* `booted` separa dos momentos que antes estaban mezclados:
   1) el preloader carga atrio + avatar + shaders ANTES de la portada;
   2) «Entrar al museo» solo cambia de fase, sin volver a tapar la escena. */
let booted = false, booting = null;

export async function startGame() {
  if (S.phase !== 'intro' || starting) return false;
  /* La portada aparece cuando la cortina empieza a fundirse, unos 380 ms
     antes de que `bootGame()` termine de resolver. Si el usuario entra en
     ese instante, se espera el mismo arranque en vez de perder el gesto. */
  if (!booted) { await bootGame(); if (!booted) return false; }
  starting = true;
  try {
    document.activeElement?.blur?.();
    /* El gesto del usuario reanuda el AudioContext que `bootGame()` dejó
       preparado en silencio. */
    ensureAudio(); startAmbient();
    hideIntro();
    S.phase = 'atrium'; S.sessionStart = performance.now();
    placePlayerAtSpawn(Math.PI);
    renderProgress();
    seen.add(entry); LS.set('flauxus.entries.v1', [...seen]);
    showUnlock();
    /* Sin precarga en segundo plano: `FBXLoader.parse` + `optimize()`
       recorren el modelo de la sala en el hilo principal y congelan el
       primer paso del jugador. La sala se carga entera bajo el preloader
       de `enterRoom()`, donde la espera no rompe la experiencia. */
    return true;
  } finally {
    starting = false;
  }
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
/* ======================================================================
   ARRANQUE · EL PRELOADER VA ANTES DE LA PORTADA
   La cortina ya está visible desde el HTML. `bootGame()` espera el atrio
   completo (FBX + NavMesh), el avatar del atrio y la compilación de shaders;
   recién ahí la levanta y deja ver la portada con su cámara giratoria sobre
   una escena realmente cargada. Por eso «Entrar al museo» ya no muestra
   ningún preloader: no queda nada pendiente.
   En modo `?room=` no hay portada: la misma cortina encadena atrio → Momento
   y se retira cuando la sala, su avatar y su grabación están listos.
   ====================================================================== */
export function bootGame() {
  if (booted) return Promise.resolve(true);
  if (booting) return booting;

  const direct = directRoom >= 1 && directRoom <= 6 ? directRoom : 0;
  const roomMeta = direct ? rooms[direct - 1] : null;

  booting = (async () => {
    /* Reutiliza la cortina que ya cubre el primer paint: no hay destello de
       escena vacía entre el HTML y la ejecución de este módulo. */
    await loaderShow({
      kicker: direct ? `Momento ${direct} de 6 · ${roomMeta.note}` : 'Atrio central',
      title: direct ? roomMeta.title : 'El museo imposible',
      sub: direct ? 'Abriendo el Momento' : 'Preparando el museo'
    });
    /* En la entrada directa no habrá un gesto previo: se prepara el audio acá.
       En el arranque normal lo hace `startGame()`, ya dentro del clic. */
    if (direct) ensureAudio();
    try {
      loaderStage(16, 'Cargando el atrio y tu avatar');
      await Promise.all([atriumReady, setAvatar(skinKind(0))]);
      if (assetManager.failed.has('atrium')) throw new Error('No se pudo descargar el atrio');
      /* La luz, la niebla y el fondo ya están calculados; fijar el color
         exacto evita que el primer frame descubra un resto del anterior. */
      BG.copy(BGT);
      /* Deja al jugador en su spawn antes de la portada para que la cámara
         giratoria encuadre el atrio definitivo, no el centro provisional. */
      placePlayerAtSpawn(Math.PI);
      loaderStage(64, 'Acomodando la luz del museo');
      await warmScene(14000);

      if (direct) {
        hideIntro();
        ensureAudio(); startAmbient();
        S.phase = 'atrium'; S.sessionStart = performance.now();
        seen.add(entry); LS.set('flauxus.entries.v1', [...seen]);
        renderProgress();
        loaderStage(80, 'Abriendo el Momento');
        await enterRoom(direct, { loaderOn: true });
        booted = true;
        showUnlock();
        return true;
      }

      loaderStage(96, 'Todo listo');
      await loaderFinish();
      booted = true;
      /* La música ambiental arranca con el gesto de «Entrar al museo».
         Ninguna sala se precarga en segundo plano: su FBX se parsea bajo
         el preloader de `enterRoom()` para no congelar la caminata. */
      return true;
    } catch (e) {
      console.error('bootGame', e);
      /* Aviso claro en la cortina: reintentar (recarga) o seguir con lo que haya cargado. */
      loaderError('No pudimos preparar el museo. Revisa tu conexión e inténtalo de nuevo.', [
        { label: 'Reintentar', primary: true, onClick: () => location.reload() },
        { label: 'Continuar así', onClick: () => loaderHide() }
      ]);
      /* La portada sigue disponible aunque falle el precalentado; el flujo
         de entrada conserva sus propias esperas como red de seguridad. */
      booted = true;
      return false;
    } finally {
      booting = null;
    }
  })();
  return booting;
}
export function tryEnter() { if (S.phase !== 'atrium') return; if (!S.nearby) { toast('Acércate a un portal, o pulsa «Ir a la siguiente sala»'); return } enterRoom(S.nearby) }
export const GO_LABEL = `Empezar${TOUCH ? '' : ' <span style="opacity:.6;font-weight:500">· Enter</span>'}`;
export function noteRec(id) {
  if (!recOk(id)) { toast('No encontré ' + trackFiles.get(id) + ' junto al HTML · uso sonido provisional'); return }
  if (Rec.fb.has(id) && !S.rfNote) { S.rfNote = true; toast('Modo básico de sonido: abre la experiencia desde su página web para escucharla completa') }
}
export async function enterRoom(id, { loaderOn = false } = {}) {
  if (S.busy) return;
  S.busy = true;
  const r = rooms[id - 1];
  let need = false, go = null;

  /* La cortina se abre ANTES de tocar la escena. Si venimos de una entrada
     directa, el preloader ya está opaco y solo cambia de texto. */
  if (loaderOn) {
    loaderText({
      kicker: `Momento ${id} de 6 · ${r.note}`,
      title: r.title,
      sub: 'Abriendo el Momento'
    });
  } else {
    await loaderShow({
      kicker: `Momento ${id} de 6 · ${r.note}`,
      title: r.title,
      sub: 'Abriendo el Momento'
    });
  }

  try {
    S.ready = false;
    stopAuto(); S.room = id; S.phase = PRELUDE.enabled ? 'prelude' : 'brief'; cur = IMPL[id];
    world.visible = false; roomGroup.visible = true; clearGroup(roomGroup); bumpRoomGen(); groundController.reset(); groundController.roomObj = null;
    lightingManager.setMode('room', id);
    /* Fondo exacto #221e1d desde el primer frame visible. */
    BG.copy(BGT);
    const floorY = r.floorY ?? r.start?.y ?? 0;
    groundController.roomFloorY = floorY;
    const avatarReady = setAvatar(skinKind(id)); avatarObj.position.set(0, floorY, 0); avatarObj.rotation.y = 0; avatarObj.scale.setScalar(1);
    /* Invisible collision floor for raycasting */
    const f = new THREE.Mesh(new THREE.CircleGeometry(18, 64), mat(0x12130d, { roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.y = floorY - 0.02; f.material.transparent = true; f.material.opacity = 0; f.visible = true; roomGroup.add(f); setRoomFloor(f);
    const disc = glowSprite(LIME, 14, .2); disc.material.depthTest = false; disc.position.y = floorY + 0.05; disc.renderOrder = -1; roomGroup.add(disc);

    /* Escenario, avatar y grabación viajan en paralelo bajo el preloader. */
    loaderStage(38, 'Construyendo el escenario');
    need = r.audio === 'real';
    const audioReady = need ? loadRec(id) : Promise.resolve();
    await Promise.all([Promise.resolve(cur.build?.()), avatarReady]);
    if (assetManager.failed.has(id)) throw new Error('No se pudo descargar el escenario');

    loaderStage(62, 'Ajustando luces y cámara');
    camera.fov = 62; camera.updateProjectionMatrix(); camCur.copy(cur.camPos || new V3(0, 2.3, 8.6)); camLook.copy(cur.camLook || new V3(0, 1.7, 0));
    setRoomInfo(`Momento ${id} · ${r.note}`, r.title, r.desc);
    $('sourceChip').style.display = 'block'; $('sourceChip').innerHTML = r.audio === 'real' ? `♪ <b>${r.source}</b>` : `♪ ${r.source}`;
    $('roomUI').classList.add('active'); hideRoomDom(); hint(''); $('btnBack').style.display = 'block'; $('prompt').classList.remove('show'); $('coach').classList.remove('show'); $('compass').style.display = 'none';
    A.ambient?.set(0, .4);
    const pend = r.audio === 'pending' ? `<div class="pend">Audio provisional · pendiente de validar con María Clara</div>` : r.audio === 'none' ? `<div class="pend">Sonido procedural · esta sala no tiene grabación</div>` : '';
    const hlTitle = r.title.replace(/^(\S+)/, '<span class="hl">$1</span>');
    $('brief').innerHTML = `<div class="k">Momento ${id} de 6 · ${r.note}</div><h2>${hlTitle}</h2><p>${r.goal}</p>${pend}${ctlRow(r)}<button class="btn" id="btnGo">${GO_LABEL}</button>`;
    if (!PRELUDE.enabled) $('brief').classList.add('show');
    renderProgress();
    go = $('btnGo'); go.onclick = startRoom;
    go.disabled = need; if (need) go.textContent = 'Preparando la grabación…';

    /* La grabación forma parte de "listo para jugar": si todavía no está
       decodificada, el nivel no se descubre. El tope de 30 s evita una
       espera infinita si el archivo no existe o la red se cuelga. */
    if (need) {
      loaderStage(74, 'Cargando la grabación del Momento');
      const slow = setTimeout(() => loaderStage(82, 'La grabación es larga · un momento más'), 5000);
      await Promise.race([audioReady, sleep(30000)]);
      clearTimeout(slow);
    }

    /* Preludio / ficha listos, pero todavía ocultos. */
    if (PRELUDE.enabled) initPrelude(id, false);

    loaderStage(90, 'Preparando la imagen');
    await warmScene(15000);
    loaderStage(97, 'Todo listo');
    await loaderFinish();

    S.ready = true;
    go.disabled = false; go.innerHTML = GO_LABEL;
    if (need) noteRec(id);
    /* La locución recién empieza cuando la sala ya es visible. */
    if (PRELUDE.enabled) startPreludeVoice(id);
    titleCard(r);
  } catch (e) {
    console.error('enterRoom', id, e);
    S.ready = true;
    if (go) { go.disabled = false; go.innerHTML = GO_LABEL }
    /* La sala no quedó lista: la cortina avisa y ofrece reintentar o volver al atrio. */
    loaderError('No pudimos abrir este Momento. Revisa tu conexión e inténtalo de nuevo.', [
      { label: 'Reintentar', primary: true, onClick: () => enterRoom(id, { loaderOn: true }) },
      { label: 'Volver al atrio', onClick: () => leaveRoom() }
    ]);
  } finally {
    S.busy = false;
  }
}
export function startRoom() { if (S.phase !== 'brief' || !S.ready) return; document.activeElement?.blur?.(); ensureAudio(); newBus(); S.phase = 'play'; S.playStart = performance.now(); $('brief').classList.remove('show'); $('btnSkip').style.display = 'none'; cur.start(); tone(660, .12, 'sine', .04, 0, A.master) }

export function finish(m, lines, skipped = false) {
  if (S.phase !== 'play') return; S.phase = 'done'; S.completed.add(S.room); S.metrics[S.room] = { ...m, skipped, duration: (performance.now() - S.playStart) / 1000 }; saveProgress();
  cur.stop?.(); sting(); shake(14); paintHuella();
  const f = $('flash'); f.style.background = '#c2fe0b'; f.style.opacity = '.16'; f.classList.remove('on'); setTimeout(() => { f.style.opacity = ''; f.style.background = '' }, 260);
  burst(W / 2, H / 2, LIMEH, 60, 420, 1.1, 4); ringFx(W / 2, H / 2, '#fff', 20, 320, .9, 3); hint(''); hideRoomDom(); renderProgress();
  const r = rooms[S.room - 1];
  $('done').innerHTML = `<div class="stamp">${skipped ? 'Saltada' : 'Hecho'}</div><div class="k">Momento completado · ${r.note}</div><h2>${r.title}</h2>${(skipped ? [['Sala', 'saltada']] : lines).map(l => `<div class="stat"><span>${l[0]}</span><u></u><b>${l[1]}</b></div>`).join('')}<button class="btn" id="btnNext">${S.room === 6 ? 'Ver mi partitura' : 'Volver al atrio'}${TOUCH ? '' : ' <span style="opacity:.6;font-weight:500">· Enter</span>'}</button>`;
  setTimeout(() => { if (S.phase === 'done') { $('done').classList.add('show'); $('btnNext').onclick = afterDone } }, 650)
}
export function afterDone() { if (S.phase !== 'done') return; if (S.room === 6) showEpilogue(); else leaveRoom() }
export async function leaveRoom() {
  if (S.busy || !S.room) return;
  S.busy = true;
  await loaderShow({
    kicker: 'Atrio central',
    title: 'El museo imposible',
    sub: 'Volviendo al atrio'
  });
  try {
    cur?.stop?.(); killBus(); hideRoomDom(); $('roomUI').classList.remove('active'); $('btnBack').style.display = 'none'; $('sourceChip').style.display = 'none';
    roomGroup.visible = false; world.visible = true; bumpRoomGen(); groundController.clearRoom(); clearGroup(roomGroup);
    S.room = 0; cur = null; S.phase = 'atrium';
    lightingManager.setMode('atrium');
    BG.copy(BGT);
    loaderStage(36, 'Reuniendo el atrio y tu avatar');
    await Promise.all([setAvatar(skinKind(0)), atriumReady]);
    avatarObj.scale.setScalar(1);
    placePlayerAtAtrium();
    /* El atrio recuerda: aparece (animada) la huella de la sala recién completada. */
    refreshAtriumMemory(S.completed, stairGroups);
    setRoomInfo('Atrio central', 'El museo imposible', 'Seis escaleras flotan alrededor del centro. Haz clic en el suelo para caminar y sigue la que late: cada una lleva a un momento distinto.');
    A.ambient?.set(1, 1); renderProgress(); hint('');
    loaderStage(82, 'Acomodando la luz del atrio');
    await warmScene(12000);
    loaderStage(97, 'Todo listo');
    await loaderFinish();
    /* Igual que al entrar al museo: no se precargan salas mientras el
       jugador camina. El FBX se parsea bajo la cortina de la próxima
       entrada para no bloquear la caminata del atrio. */
  } catch (e) {
    console.error('leaveRoom', e);
    loaderError('No pudimos volver al atrio. Inténtalo de nuevo.', [
      { label: 'Reintentar', primary: true, onClick: () => location.reload() }
    ]);
  } finally {
    S.busy = false;
  }
}
$('btnSkip').onclick = () => { if (S.phase === 'play') { cur.stop?.(); finish({}, [], true) } };
