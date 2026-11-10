/* ======================================================================
   FLAUXUS — Sala 5 · SOL♯ — El unicornio cyborg
   Cuerpo, sensor y máquina: captura los tres puntos y haz reaccionar el espacio.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { createHologram } from '../engine/hologram.js';
import { createGalaxy } from '../engine/sky.js';
import { GX } from '../GameContext.js';
import { HM, measureHud } from '../ui/hudMetrics.js';
import { pad, tone, pluck, hiss, A } from '../AudioSystem.js';
import { roomGroup, avatarObj, camera, bloom, mat, animAvatar, ctx, W, H, burst, ringFx, shake, glowCircle, bolt, LIME, LIMEH, PAPER, SERIF, damp, clamp, TOUCH, ptr, ptrActive, hint, toast, finish, T, roomGen, groundController } from './context.js';

/* Medidas tomadas del FBX de SOL tras el fit:
   - la plataforma principal queda a y≈0.234;
   - la terraza en espiral bajo la posición de juego (0, 1.5) tiene la cima
     a y≈0.358. */
const SOL_FLOOR = 0.234, SOL_DAIS = 0.358;

export const meta = {
  key: 'sol',
  id: 5, note: 'SOL♯4', short: 'SOL♯', title: 'El unicornio cyborg', desc: 'Cuerpo, sensor y máquina: captura los tres puntos y haz reaccionar el espacio.', source: 'sonido procedural · sin grabación', audio: 'none', color: 0xc2fe0b, hex: '#c2fe0b', avatar: 'cyborg',
  /* El suelo central del FBX queda a y≈0.23 tras el fit; el avatar y la
     cámara se elevan con él. SOL tiene terrazas a distintas alturas, así
     que el suelo sale del propio escenario en vez de una única tarima: al
     subir la espiral las botas acompañan el desnivel y no quedan flotando
     ni hundidas.
     Antes se hacía con `floorRay`: un rayo contra la malla del escenario
     cada 25 cm de paseo. Esa malla tiene 318.604 triángulos sin estructura
     de aceleración: cada rayo costaba ~32 ms en escritorio (medido) y, al
     caminar, caía uno cada dos o tres cuadros: de ahí los tirones del
     preludio. Ahora las caras pisables se rasterizan UNA vez, bajo el
     preloader, en un mapa de alturas (`floorMap`, el mismo mecanismo de
     RE): cada consulta lee cuatro celdas. El rango vertical (−0,3…1,25 m)
     cubre la tarima, todas las terrazas (0,20–0,74 m) y los bancos
     (1,05 m), a los que el rayo ya dejaba subir desde la terraza vecina
     (0,49 m). El escalón máximo de 55 cm que aplicaba el rayo lo aplica
     ahora el movimiento (ground.js · roomStepBlocked): desde la tarima
     de 0,23 m el banco es un obstáculo, no un peldaño. */
  floorY: 0.23,
  floorMap: { cell: .1, radius: 13, baseY: .3, below: .6, above: .95 },
  start: { x: 0, y: SOL_FLOOR, z: 4.2, yaw: Math.PI },
  /* Antes 6.8: el paseo quedaba encerrado en el centro. 12.0 aprovecha las
     terrazas intermedias (radio visible ≈14.5) sin llegar al borde. */
  preludeR: 12.0,
  trigger: { x: 0, z: 0, r: 2.2 },
  /* La pose de juego se apoya en la cima de la terraza (0.358), no en la
     tarima baja. `plantFeet` corrige luego los pocos centímetros que el
     clip de idle mueve los tobillos. */
  gameAvatarPos: { x: 0, y: SOL_DAIS, z: 1.5, yaw: 0 },
  goal: 'Tres sensores flotan alrededor del cuerpo. Mantén el cursor (o el dedo) sobre cada uno hasta que el anillo se llene y se conecte.',
  ctl: [[['Mouse'], ['Dedo'], 'Seguir y mantener sobre el sensor']],
  light: {
    /* Fondo del nivel: #221e1d (ya no negro), compartido por las seis salas. */
    bg: 0x221e1d, fog: .024, exp: 1.0, env: .25, hemi: [0xdde4f0, 0x1a1e26, .3], key: { c: 0xe8f0ff, i: .8, p: [8, 16, 8] }, rim: { c: 0xc2fe0b, base: 2, k: 8 }, bloomT: .8,
    pts: [{ c: 0xc2fe0b, e: 2.0, r: 3.2, p: [0, 3.2, -3] }, { c: 0xaaccff, e: 1.0, r: 5, p: [4, 5, 2] }], spot: { c: 0xfffaec, e: 1.2, r: 14, p: [0, 14, 2], t: [0, 1.5, 0], ang: .9, pen: .5 }
  },
  /* Huella de SOL: el orden en que se conectaron los tres sensores. */
  motif(x, m, cx, cy, s) { const o = m.order || [0, 1, 2], P = [[cx - s * .7, cy + s * .5], [cx + s * .7, cy + s * .5], [cx, cy - s * .7]]; x.beginPath(); o.forEach((k, i) => { if (i) x.lineTo(P[k][0], P[k][1]); else x.moveTo(P[k][0], P[k][1]) }); x.stroke(); P.forEach(q => { x.beginPath(); x.arc(q[0], q[1], s * .1, 0, 6.283); x.fill() }) },
  /* Calibración del atrio: círculo guía y aro del portal. */
  nav: {
    cue: { x: -2.47, z: -1.82, y: 0.0 }, // SOL#4 (centro del pie de la escalera diagonal)
    portal: { x: 1.0, y: 0.2, z: 1.3, scale: 0.7, rotY: 10 }
  },
  vo: {
    trigger: 'CONECTAR EL CUERPO',
    text: [
      {
        "t": "Nadie me lo dijo explícitamente, tardé años en desenmarañar esa tensión incómoda y encontrar este conflicto iluminador. Ahora queda el vacío de entender que no importa qué haga, nunca estaré en gracia con todos. Entonces puedo hacer lo que quiera.",
        "src": "Carrusel 1 · lámina 8"
      }
    ],
    files: ['Voz_SOLs4']
  }
};

export const SOL = (() => {
  const _camPos = new THREE.Vector3(), _camLook = new THREE.Vector3();
  /* Holograma y galaxia se crean UNA vez y se reutilizan en cada visita (la nebulosa se hornea una sola vez);
     sus geometrías y materiales llevan la marca `keep` para que clearGroup() no los libere al salir. */
  let holo = null, sky = null;
  const keepAll = g => g.traverse(o => { if (o.geometry) o.geometry.userData.keep = true; if (o.material) o.material.userData.keep = true });
  const names = ['Muñeca I', 'Muñeca II', 'Cabeza'], HR = 1.0; let orbs = [], cap = [], hold = [0, 0, 0], capT = [0, 0, 0], core, rings = [], order = [], pending = false;
  /* Identidad: verde (acción, conectado), cian (llamada «tócame») y rosado (carga en curso). */
  const CYAN = '#19c6d9', PINK = '#ff4fb8', INK = 'rgba(13,14,9,';
  /* Radio de captura en píxeles CSS: 64 en táctil (área de 128 px, muy por encima de los 48 px mínimos) y 50 con
     ratón. El dibujo del sensor mide 30 px de radio: el área táctil es mayor que lo que se ve. */
  const hitR = () => TOUCH ? 64 : 50;
  /* El puntero nace en el centro de la pantalla con tipo «mouse» (core/inputState.js). Hasta que el usuario no
     lo mueve o toca de verdad no cuenta: si no, el sensor que pasa por el centro se conectaba solo al empezar. */
  let armed = false, px0 = 0, py0 = 0;
  const pointing = () => armed && ptrActive();
  const v3 = new THREE.Vector3(), anch = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  const proj = (o, out) => { o.getWorldPosition(v3).project(camera); out.x = (v3.x * .5 + .5) * W; out.y = (-v3.y * .5 + .5) * H; return out }; // sin vectores ni objetos nuevos por cuadro
  /* getWorldPosition ya actualiza la cadena de padres de cada articulación: no hace falta recalcular las
     matrices del esqueleto por segunda vez en el cuadro (lo hacía animAvatar un instante antes). */
  const anchors = () => { camera.updateMatrixWorld(); const j = avatarObj.userData.joints; proj(j.wl, anch[0]); proj(j.wr, anch[1]); proj(j.head, anch[2]); return anch };
  /* Los sensores no salen del cuadro ni se meten bajo la franja del HUD (medida en vivo: GX.uiTop). El de la
     cabeza lleva el rótulo ENCIMA del aro (debajo caía sobre la cara de la avatar): reserva 28 px más arriba. */
  const headTop = () => (GX.uiTop || 0) + 78;
  const keepX = x => clamp(x, 48, W - 48), keepY = (y, i) => clamp(y, i === 2 ? headTop() : (GX.uiTop || 0) + 50, H - 96);
  /* Desfase lateral de los sensores de muñeca respecto a la articulación: 16 % del ancho, mínimo 92 px. */
  const sideX = () => Math.max(W * .16, 92);
  /* ---- Los tres sensores no se montan ----
     Antes solo se separaban las dos muñecas entre sí; el de la cabeza quedaba a 65–113 px de ellas en todos los
     celulares (el área táctil mide 2 × 64 px), y en horizontal a su misma altura: un dedo cargaba dos a la vez.
     Ahora los tres destinos se resuelven juntos: cada par queda a 2·hitR + 8 px o más. Primero se abre a lo
     ancho (las muñecas se apartan de la cabeza y entre sí); lo que el ancho de la pantalla no da se resuelve a
     lo alto (la muñeca baja, la cabeza sube), siempre dentro del cuadro. Sale del radio táctil y del tamaño real
     de la pantalla: no hay posiciones por resolución. Los sensores ya conectados no cuentan (viajan a su
     articulación y dejan de ser tocables). */
  const tgt = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  function spread() {
    const D = 2 * hitR() + 8, need = d => Math.sqrt(Math.max(0, D * D - d * d)), L = tgt[0], R = tgt[1], C = tgt[2], x0 = 48, x1 = W - 48;
    for (let i = 0; i < 3; i++) { tgt[i].x = keepX(tgt[i].x); tgt[i].y = keepY(tgt[i].y, i) }
    for (let pass = 0; pass < 2; pass++) {
      if (!cap[0] && !cap[1]) {
        const n = need(R.y - L.y); if (R.x - L.x < n) { const m = (L.x + R.x) / 2; L.x = m - n / 2; R.x = m + n / 2; if (L.x < x0) { R.x += x0 - L.x; L.x = x0 } if (R.x > x1) { L.x -= R.x - x1; R.x = x1 } L.x = keepX(L.x) }
      }
      if (!cap[2]) for (let i = 0; i < 2; i++) {
        if (cap[i]) continue; const w = tgt[i], s = i ? 1 : -1;
        const n = need(w.y - C.y); if (s * (w.x - C.x) < n) w.x = keepX(C.x + s * n);
        const n2 = need(w.x - C.x); if (w.y - C.y < n2) { w.y = keepY(C.y + n2, i); if (w.y - C.y < n2) C.y = keepY(w.y - n2, 2) }
      }
    }
  }
  /* Destino de cada sensor: su articulación proyectada + desfase (+ una oscilación lenta si k = 1), ya separados. */
  function targets(a, k) {
    for (let i = 0; i < 3; i++) {
      const side = i === 0 ? -1 : i === 1 ? 1 : 0;
      tgt[i].x = a[i].x + side * sideX() + k * Math.sin(T * .9 + i * 2) * W * .025;
      tgt[i].y = a[i].y + (i === 2 ? -H * .17 : -H * .03) + k * Math.cos(T * .7 + i * 1.7) * H * .03;
    }
    spread(); return tgt
  }
  /* Solo carga UN sensor a la vez: el más cercano al puntero dentro de su radio. */
  let nearI = -1;
  function nearest() { nearI = -1; if (!pointing()) return; let bd = hitR(); for (let i = 0; i < 3; i++) { if (cap[i] || !orbs[i]) continue; const d = Math.hypot(ptr.x - orbs[i].x, ptr.y - orbs[i].y); if (d < bd) { bd = d; nearI = i } } }

  /* ---- Rayos contra el escenario (tocar el suelo para caminar) ----
     player.js lanza un rayo contra toda la sala en cada toque del preludio. Contra los 318.604 triángulos del
     escenario eran ~32 ms por toque en escritorio. El escenario es un relieve (una sola cota pisable por punto),
     así que el rayo se resuelve marchando sobre el mapa de alturas: mismo punto de impacto, coste despreciable. */
  const _hp = new THREE.Vector3();
  function stageRaycast(rc, hits) {
    const g = groundController, m = g.roomMap; if (!m) return;
    const o = rc.ray.origin, d = rc.ray.direction; if (d.y >= -1e-4) return;
    const far = Math.min(rc.far, 90), step = .15; let t0 = rc.near || 0, h = g.roomMapHeight(o.x + d.x * t0, o.z + d.z * t0);
    if (h !== null && o.y + d.y * t0 <= h) return;              // el rayo nace bajo el suelo: no hay cara que mirar
    for (let t = t0 + step; t <= far; t += step) {
      h = g.roomMapHeight(o.x + d.x * t, o.z + d.z * t);
      if (h !== null && o.y + d.y * t <= h) {
        let a = t0, b = t; for (let i = 0; i < 7; i++) { const c = (a + b) * .5, hc = g.roomMapHeight(o.x + d.x * c, o.z + d.z * c); if (hc !== null && o.y + d.y * c <= hc) b = c; else a = c }
        _hp.copy(d).multiplyScalar(b).add(o);
        hits.push({ distance: b, point: _hp.clone(), object: this, face: null }); return;
      }
      t0 = t;
    }
  }

  /* ---- Encuadre del holograma ----
     Piezas de interfaz de la mitad alta de la pantalla (pestañas, «Volver», «Saltar», pista, título de sala,
     marca y botones de esquina). Las mide ui/hudMetrics.js en la lectura compartida del HUD (HM.sky) y
     engine/hologram.js escala la figura para que quepa bajo las que tiene encima: no hay valores por
     resolución, y al girar el teléfono o al aparecer y desaparecer un botón el encuadre se recalcula solo. */
  let hudFresh = false;
  /* ---- El núcleo no tapa el holograma ----
     En celulares en vertical la figura se encoge para caber bajo la franja del HUD y queda más estrecha que el
     núcleo verde, que está en la misma línea de mirada: en 360×640 no se veía en todo el preludio. Cuando la
     figura cabría entera detrás del núcleo se desplaza a un costado, lo justo para asomar junto a él y sin
     salirse del cuadro. Sale de los tamaños reales en pantalla (núcleo y figura proyectados): en horizontal y en
     escritorio, donde la figura desborda de sobra al núcleo, el desplazamiento es cero y sigue centrada. */
  const HOLO_X = 0, HOLO_Z = -110, _hf = new THREE.Vector3(), _hr = new THREE.Vector3(), _hv = new THREE.Vector3();
  let holoOff = NaN, holoSide = -1;
  function holoAside(dt, fy) {
    let want = 0;
    camera.updateMatrixWorld(); camera.getWorldDirection(_hf); _hr.setFromMatrixColumn(camera.matrixWorld, 0);
    const tanH = Math.tan(camera.fov * Math.PI / 360) * (camera.aspect || 1);
    _hv.copy(core.position).sub(camera.position); const zc = _hv.dot(_hf), cx = _hv.dot(_hr);
    _hv.set(HOLO_X, fy, HOLO_Z).sub(camera.position); const zh = _hv.dot(_hf), hx = _hv.dot(_hr);
    if (zc > 1 && zh > 1) {
      const c = cx / (zc * tanH), ch = 1.7 * core.scale.x / (zc * tanH), h = hx / (zh * tanH), hh = holo.halfNDC; // centros y semianchos (NDC)
      const k = clamp((ch * 1.6 - hh) / (ch * .6), 0, 1);       // 1: la figura cabe tras el núcleo · 0: lo desborda de sobra
      if (k > 0 && hh > 0 && Math.abs(h - c) < ch + hh) {
        if (c > .12) holoSide = -1; else if (c < -.12) holoSide = 1; // hacia el lado con más cuadro libre (con histéresis)
        const lim = Math.max(0, 1 - hh), t = clamp(c + holoSide * (ch + hh * .8), -lim, lim);
        want = (t - h) * zh * tanH * k;
      }
    }
    holoOff = holoOff === holoOff && dt > 0 ? damp(holoOff, want, 2.5, dt) : want;
    holo.place(HOLO_X + _hr.x * holoOff, fy - 80, HOLO_Z + _hr.z * holoOff, fy);
  }
  /* Apoyo fino de las botas. El clip idle sube y baja los tobillos unos
     4 cm; si la raíz se deja fija, en unas fases las botas flotan y en
     otras se hunden en la terraza. Se mide la punta del pie más baja y se
     corrige la raíz para que la suela quede exactamente sobre `fy`.
     `SOL_TOE_SOLE` es la distancia vertical medida, a escala 1.5, entre la
     base del dedo y la suela del cyborg (≈0.174 m). */
  const SOL_TOE_SOLE = .174;
  const _soleV3 = new THREE.Vector3();
  const soleNames = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot'];
  function plantFeet(fy) {
    const u = avatarObj.userData;
    if (!u?.bones) return;
    let low = Infinity;
    for (const n of soleNames) {
      const b = u.bones.get(n);
      if (!b) continue;
      const y = b.getWorldPosition(_soleV3).y;
      if (y < low) low = y;
    }
    if (!isFinite(low)) return;
    /* rel es la altura del hueso respecto de la raíz; al recolocar la raíz
       la relación no cambia, así que la corrección es estable frame a frame. */
    const rel = low - avatarObj.position.y;
    avatarObj.position.y = fy - rel + SOL_TOE_SOLE;
  }
  return {
    /* Encuadre del juego: antes (0, 2.63, 9) quedaba demasiado cerca de una avatar a escala 1,5. Ahora la cámara
       se aleja ~1,5 m, sube un poco y mira al pecho: entran la avatar completa, los tres sensores y el núcleo.
       En pantallas verticales se aleja más para que los sensores laterales no salgan del cuadro. */
    camPos: new THREE.Vector3(0, 3.0, 10.6), camLook: new THREE.Vector3(0, 2.45, 0),
    cam() {
      const a = camera.aspect || 1.6, k = a < .8 ? 1.45 : a < 1.1 ? 1.18 : 1;
      /* la mirada sube (2.45 → 3.7): el horizonte baja y el cielo —galaxia y holograma— ocupa más cuadro */
      const y0 = 3.2 + (k - 1) * 1.2, z0 = 1.5 + 9.1 * k; let ly = 3.7;
      /* Pantallas verticales: la franja del HUD ocupa mucha altura y entre ella y el horizonte no cabía el
         holograma a un tamaño legible (128 px de alto en 360×640). La mirada sube lo justo para que el horizonte
         baje hasta dejar sitio a la figura al ancho de la pantalla: franja del HUD + alto de la figura
         (0,64 × ancho), con el horizonte como mucho al 62 % del alto para que la avatar y sus botas sigan en
         cuadro. Sale del aspecto y del HUD medido, y se funde con el encuadre horizontal entre aspecto 0,8 y 1. */
      if (a < 1) {
        const hud = clamp((GX.uiTop || 0) / Math.max(1, H), 0, .4), h = clamp(hud + .64 * a + .02, .5, .62), w = clamp((1 - a) / .2, 0, 1);
        ly = Math.max(ly, ly + (y0 + z0 * (2 * h - 1) * Math.tan(camera.fov * Math.PI / 360) - ly) * w);
      }
      _camPos.set(0, y0, z0); _camLook.set(0, ly, 0);
      return { pos: _camPos, look: _camLook };
    },
    build() {
      const fy = meta.floorY ?? 0, gp = meta.gameAvatarPos;
      avatarObj.scale.setScalar(1.5);
      /* La terraza de juego está elevada: colocar la raíz en la cima evita
         que las botas nazcan dentro de la espiral mientras carga la sala. */
      avatarObj.position.set(gp.x, gp.y ?? fy, gp.z);
      core = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 20), mat(0x15170f, { emissive: 0x4a5200, emissiveIntensity: .8, metalness: .4, roughness: .25 })); core.position.set(0, fy + 3.2, -3); roomGroup.add(core);
      rings = []; for (let i = 0; i < 9; i++) { const g = new THREE.Mesh(new THREE.TorusGeometry(2.1 + i * .4, .02, 6, 60), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xefeadb : LIME, transparent: true, opacity: .25 })); g.rotation.x = Math.random() * Math.PI; g.rotation.y = Math.random() * Math.PI; g.position.copy(core.position); roomGroup.add(g); rings.push(g) }
      /* Galaxia procedural (engine/sky.js): nebulosa horneada + dos capas de estrellas + polvo orbitando el holograma. */
      if (!sky) { sky = createGalaxy(GX.renderer, { low: TOUCH, orbitCenter: new THREE.Vector3(0, fy + 16, -110), orbitRadius: 52, pivotY: fy }); keepAll(sky.group) }
      roomGroup.add(sky.group);
      /* Holograma monumental (engine/hologram.js): la cyborg de ~130 m tocando la flauta detrás del escenario;
         la cintura queda a la altura del horizonte: el torso y la flauta se alzan sobre la plataforma.
         Es un impostor (se dibuja pequeña a una textura y se proyecta en un plano): domina el cielo sin el coste
         de una malla gigante. No colisiona ni participa del minijuego. */
      if (!holo) holo = createHologram(GX.renderer, { low: TOUCH, height: 172 });
      /* El cuarto argumento es la línea del horizonte: al encuadrarse, la figura se escala desde su cintura. */
      holo.place(HOLO_X, fy - 80, HOLO_Z, fy); holo.setPresence(.95); holo.refit(); hudFresh = false; holoOff = NaN; roomGroup.add(holo.group);
      /* Escenario real de SOL: plataforma circular de terrazas. Al terminar de colocarlo se rasteriza su piso en
         el mapa de alturas (todavía bajo el preloader) y sus mallas pasan a resolver los rayos sobre ese mapa. */
      return placeFBX(5, roomGroup, 16, { roughness: .9, metalness: .05 }, () => roomGen)
        .then(obj => { if (obj && groundController.buildRoomMap(obj, meta.floorMap)) obj.traverse(o => { if (o.isMesh) o.raycast = stageRaycast }); return obj });
    },
    start() {
      holo?.setPresence(.6); // durante el minijuego el holograma cede protagonismo a los sensores
      cap = [false, false, false]; hold = [0, 0, 0]; capT = [0, 0, 0]; order = []; pending = false; orbs = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]; const p = pad([55, 110, 165], .09, 'sawtooth'); p.set(.5);
      armed = false; px0 = ptr.x; py0 = ptr.y;
      hint(TOUCH ? 'Mantén el dedo sobre cada sensor hasta que el anillo se llene' : 'Mantén el cursor sobre cada sensor hasta que el anillo se llene');
      nearI = -1; const t = targets(anchors(), 0); orbs.forEach((o, i) => { o.x = t[i].x; o.y = t[i].y })
    },
    update(dt) {
      const a = anchors(), t = targets(a, 1); let n = 0;
      if (!armed && (ptr.down || ptr.x !== px0 || ptr.y !== py0)) armed = true;
      /* Pantallas bajas: la avatar se encuadra por debajo del sitio que necesita el sensor de la cabeza (la cámara
         lee este límite en player.js · composeFrame). Al bajar ella baja también el horizonte: más cielo. */
      HM.sceneTop = cap[2] ? 0 : headTop() + 40;
      nearest();
      orbs.forEach((o, i) => {
        if (cap[i]) { o.x = damp(o.x, a[i].x, 5, dt); o.y = damp(o.y, a[i].y, 5, dt); capT[i] += dt; n++ }
        else {
          o.x = damp(o.x, t[i].x, 4, dt); o.y = damp(o.y, t[i].y, 4, dt); const inside = nearI === i;
          if (inside) { hold[i] += dt; if (Math.floor(hold[i] * 5) !== Math.floor((hold[i] - dt) * 5)) tone(300 + hold[i] * 400 + i * 80, .05, 'sine', .03) } else hold[i] = Math.max(0, hold[i] - dt * .8);
          if (hold[i] >= HR) { cap[i] = true; order.push(i); burst(o.x, o.y, LIMEH, 50, 420, 1, 4); ringFx(o.x, o.y, '#fff', 20, 200, .8, 3); shake(7); pluck([220, 330, 523][i], 0, .9, .1, A.master); hiss(.25, .06, 6000, 0, A.master); toast(names[i] + ' conectada') }
        }
      });
      avatarObj.userData.glowBase = 1.5 + n * 1.2; hint(`Sensores conectados ${n} de 3`);
      if (n === 3 && !pending) { pending = true; setTimeout(() => finish({ order: [...order] }, [['Sensores', '3 de 3'], ['Orden de conexión', order.map(i => names[i]).join(' → ')]]), 900) }
    },
    /* Se llama en cada cuadro de la sala (preludio y juego): el holograma baila desde que se entra. */
    ambient(dt, t3) {
      /* El holograma se encuadra con la cámara real (preludio y juego) y con la franja del HUD: se ve completo
         en vertical, en horizontal y al girar el teléfono. El polvo que lo orbita acompaña su tamaño. */
      if (holo) { if (!hudFresh) { hudFresh = true; measureHud(W, H) } if (core) holoAside(dt, meta.floorY ?? 0); holo.fit(camera, HM.sky, HM.skyN, dt); sky?.setOrbitScale(holo.scale) }
      sky?.update(dt, t3); holo?.update(dt, t3, A.lvl || 0, camera)
    },
    /* Solo para pruebas (?debug expone la sala activa): estado del holograma y posición de los sensores. */
    dbg() { return { holo: holo?.debug ?? null, box: holo?.debug.box(camera) ?? null, hud: HM.sky.slice(0, HM.skyN).map(r => ({ x0: +r.x0.toFixed(3), x1: +r.x1.toFixed(3), b: +r.b.toFixed(3) })), orbs: orbs.map((o, i) => ({ x: Math.round(o.x), y: Math.round(o.y), cap: !!cap[i], hold: +hold[i].toFixed(2) })), hitR: hitR(), armed, map: !!groundController.roomMap } },
    update3d(dt, t3) { let n = 0; for (let i = 0; i < 3; i++) if (cap[i]) n++; core.scale.setScalar(1 + n * .12 + Math.sin(t3 * 3) * .03); core.material.emissiveIntensity = .8 + n * 1.4; rings.forEach((r, i) => { r.rotation.z += dt * (.2 + i * .05) * (1 + n); r.material.opacity = .15 + n * .15 }); avatarObj.rotation.y = Math.sin(t3 * .4) * .25; animAvatar(avatarObj, 0, t3, true, n / 3); plantFeet(meta.gameAvatarPos?.y ?? meta.floorY ?? 0); if (bloom) bloom.strength = .5 + n * .25 },
    draw() {
      const R = 30, on = pointing();
      for (let i = 0; i < 3; i++) {
        const o = orbs[i]; if (!o) continue;
        if (cap[i]) {
          /* CONECTADO: disco verde macizo con marca de verificación, aro cian y rayo hacia la articulación. */
          const k = Math.min(1, capT[i] * 4), r = 15 + (1 - k) * 10;
          bolt(o.x, o.y, anch[i].x, anch[i].y, LIMEH, 10, 16);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowCircle(anch[i].x, anch[i].y, 50, 'rgba(194,254,11,.5)', 'rgba(194,254,11,0)'); ctx.restore();
          ctx.fillStyle = LIMEH; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, 6.283); ctx.fill();
          ctx.strokeStyle = CYAN; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.x, o.y, r + 6, 0, 6.283); ctx.stroke();
          ctx.strokeStyle = '#0d0e09'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(o.x - 7, o.y + .5); ctx.lineTo(o.x - 2, o.y + 5.5); ctx.lineTo(o.x + 7.5, o.y - 5); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
          continue;
        }
        const p = hold[i] / HR, inside = on && nearI === i, ph = T * 1.15 + i * .9, beat = .5 + .5 * Math.sin(T * 3 + i * 2.1);
        /* 1 · fondo oscuro: separa el sensor de la galaxia y del holograma (cian/rosado) sea cual sea lo que haya detrás */
        ctx.fillStyle = INK + (p > 0 ? .8 : .66) + ')'; ctx.beginPath(); ctx.arc(o.x, o.y, p > 0 ? 50 : R + 9, 0, 6.283); ctx.fill();
        /* 2 · halo verde que respira */
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowCircle(o.x, o.y, 66, `rgba(194,254,11,${(.2 + beat * .1 + p * .35).toFixed(3)})`, 'rgba(194,254,11,0)'); ctx.restore();
        /* 3 · llamada «tócame»: un aro cian que se abre y se apaga (se detiene al cargar) */
        if (p === 0) { const w = ph % 1; ctx.globalAlpha = (1 - w) * .85; ctx.strokeStyle = CYAN; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, R + 4 + w * 24, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1 }
        /* 4 · aro principal verde + cuatro muescas de mira que giran despacio */
        ctx.strokeStyle = LIMEH; ctx.lineWidth = inside ? 4 : 3; ctx.beginPath(); ctx.arc(o.x, o.y, R + beat * 1.5 + (inside ? 3 : 0), 0, 6.283); ctx.stroke();
        ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = T * .5 + i + k * 1.5708, c = Math.cos(a), sn = Math.sin(a); ctx.moveTo(o.x + c * (R - 9), o.y + sn * (R - 9)); ctx.lineTo(o.x + c * (R - 3), o.y + sn * (R - 3)) } ctx.stroke();
        /* 5 · núcleo: verde con centro blanco; crece con la carga */
        ctx.fillStyle = LIMEH; ctx.beginPath(); ctx.arc(o.x, o.y, 8 + p * 10 + beat, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x, o.y, 3, 0, 6.283); ctx.fill();
        /* 6 · CARGANDO: pista tenue + arco rosado grueso con cabeza blanca */
        if (p > 0) {
          const a1 = -Math.PI / 2 + 6.283 * p;
          ctx.strokeStyle = 'rgba(239,234,219,.22)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(o.x, o.y, 42, 0, 6.283); ctx.stroke();
          ctx.strokeStyle = PINK; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(o.x, o.y, 42, -Math.PI / 2, a1); ctx.stroke(); ctx.lineCap = 'butt';
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x + Math.cos(a1) * 42, o.y + Math.sin(a1) * 42, 4, 0, 6.283); ctx.fill();
        }
        /* 7 · rótulo sobre pastilla oscura */
        ctx.font = `600 13px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(names[i]).width + 16, ly = o.y + (p > 0 ? 68 : 58) * (i === 2 ? -1 : 1); // «Cabeza»: rótulo encima del aro
        ctx.fillStyle = INK + '.78)'; ctx.fillRect(o.x - tw / 2, ly - 10, tw, 20); ctx.fillStyle = inside ? LIMEH : PAPER; ctx.fillText(names[i], o.x, ly + .5); ctx.textBaseline = 'alphabetic';
        if (on && !inside && hold[i] === 0) { ctx.strokeStyle = 'rgba(194,254,11,.3)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(ptr.x, ptr.y); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.setLineDash([]) }
      }
      if (on) { ctx.lineWidth = 1; ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 5, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(239,234,219,.5)'; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 12, 0, 6.283); ctx.stroke() }
    },
    stop() { HM.sceneTop = 0 }
  }
})();
