/* ======================================================================
   FLAUXUS — Sala 6 · LA♯ — MataЯ al padre
   La partitura deja de ser página cerrada: extrae, interviene y reensambla.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { createFireflies } from '../engine/sky.js';
import { GX } from '../GameContext.js';
import { recOk, pad, tone, hiss, playClip, stopClips, A, regionFor, splitRegion, recPeaks, wfImg, ensureAudio, fmt } from '../AudioSystem.js';
import { S, roomGroup, avatarObj, camera, clamp, bloom, animAvatar, burst, ringFx, ftext, shake, LIMEH, PAPER, hint, toast, finish, roomGen, mat, T, $ } from './context.js';

export const meta = {
  key: 'la',
  id: 6, note: 'LA♯4', short: 'LA♯', title: 'MataЯ al padre', desc: 'La partitura deja de ser página cerrada: extrae, interviene y reensambla.', source: 'CPE Bach Intervención.wav', audio: 'real', color: 0xc2fe0b, hex: '#c2fe0b', avatar: 'body',
  /* Altura de suelo, inicio y activación frente a la mesa de trabajo */
  floorY: 1.40,
  start: { x: 0.0, y: 1.40, z: -6.8, yaw: 0 },      // Spawn en el extremo opuesto (Z negativo), mirando hacia el centro
  trigger: { x: 0.0, z: 4.8, r: 1.8 },             // Aumentado a 4.8 para alejarlo más de la mesa
  preludeR: 11.0,
  /* Posición del avatar durante el minijuego (de pie en el suelo junto a la mesa) */
  gameAvatarPos: { x: 0.0, y: 1.40, z: -2.1, yaw: 0 },
  /* Collider de la mesa central de trabajo (ancho ~3.0m x largo ~2.0m + margen del avatar) */
  isBlocked(x, z) {
    return Math.abs(x) < 1.85 && Math.abs(z) < 1.35;
  },
  goal: 'La grabación se corta en fragmentos reales. Toca uno para oírlo, arrástralos al pentagrama para componer otra secuencia, escúchala y entrégala.',
  ctl: [[['Clic = oír'], ['Toca = oír'], 'Escuchar un fragmento'], [['Arrastrar'], ['Arrastrar'], 'Fragmento → pentagrama']],
  light: {
    /* Fondo del nivel: #221e1d (ya no negro), compartido por las seis salas. */
    bg: 0x221e1d, fog: .024, exp: .95, env: .25, hemi: [0xf0e0d8, 0x241818, .3], key: { c: 0xffe4d4, i: .9, p: [8, 18, 10] }, rim: { c: 0xc2fe0b, base: 2, k: 8 }, bloomT: .82,
    /* La morada es la luz narrativa de la sala (`m: 1`): en táctil solo hay una puntual y debe ser esta. Allí
       acompaña a María Clara (`follow`: desfase en metros, por detrás y por encima) para bañarla en todo el recorrido. */
    pts: [{ c: 0xff4422, e: 1.3, r: 6, p: [6, 5, -4] }, { c: 0x8844ff, e: 1.0, r: 6, p: [0, 3, -6], m: 1, follow: [.9, 2.1, -2.3] }], spot: { c: 0xffeedd, e: 1.3, r: 16, p: [0, 16, 0], t: [0, 0, -2], ang: .8, pen: .4 }
  },
  /* Huella de LA: los cuatro espacios compuestos y el tajo del cincel. */
  motif(x, m, cx, cy, s) { (m.slots || []).forEach((sl, i) => { x.globalAlpha = .45 + sl * .1; x.fillRect(cx - s * .8 + i * s * .45, cy - s * .4 - sl * s * .06, s * .3, s * .8 + sl * s * .06) }); x.globalAlpha = 1; if (m.cuts) { x.strokeStyle = PAPER; x.beginPath(); x.moveTo(cx - s, cy + s * .6); x.lineTo(cx + s, cy - s * .6); x.stroke() } },
  /* Calibración del atrio: círculo guía y aro del portal. */
  nav: {
    cue: { x: -1.45, z: 0.34, y: 0.0 }, // LA#4 (centro del pie de la escalera diagonal)
    portal: { x: 0.0, y: 0.0, z: 0.0, scale: 1.0, rotY: 0 }
  },
  vo: {
    trigger: 'INTERVENIR LA PARTITURA',
    text: [
      {
        "t": "En este proyecto, la idea de matar al padre es una metáfora que funciona como detonante creativo y se refiere a cómo, desde mi posición de intérprete, asumo un lugar de autoridad frente a la tradición, al compositor como figura ideal y a la obra como ente cerrado, y tomo agencia sobre mi instrumento, las técnicas instrumental y compositiva, los rituales de enunciación y, sobre todo, las obras.",
        "src": "Carrusel 3 · lámina 3"
      },
      {
        "t": "Planteo la exploración de esa agencia desde el concepto de intervención, que, dentro de las prácticas artísticas de los siglos XX y XXI, se refiere a acciones o performaces en los que se interactúa con objetos o espacios preexistentes (entre ellos obras) para modificarlos o generar nuevos sentidos a partir de ellos.",
        "src": "Carrusel 3 · lámina 4 (literal; «performaces» así en el original)"
      },
      {
        "t": "Así, busco intervenir obras del repertorio canónico para flauta con elementos propios de la práctica contemporánea (técnicas extendidas, electrónica e improvisación) para generar nuevas interpretaciones desde una perspectiva no sólo centrada en la partitura, sino también en su tradición interpretativa, sus referencias y la manera en la que yo, como intérprete, elijo relacionarme con ellas.",
        "src": "Carrusel 3 · lámina 5"
      }
    ],
    files: ['Voz_LAs4_1', 'Voz_LAs4_2', 'Voz_LAs4_3']
  }
};

export const LA = (() => {
  const NAMES = ['Fragmento A', 'Fragmento B', 'Fragmento C', 'Fragmento D', 'Fragmento E', 'Fragmento F'];
  let bounds = [], wf = [], slots = [null, null, null, null], tray = [], cuts = new Map(), playing = false, listened = false, drag = null, ghost = null, endDrag = null, chisel = false, papers = [], real = false, fbPad = null;
  // Cincel: 1 = invertido · 2 = tajo y separación (corta a la mitad, deja un silencio y la 2ª mitad vuelve al revés)
  let progRaf = 0, progTimer = 0;
  function paintProg(p, on) {
    const el = $('laProg'); if (!el) return;
    el.classList.toggle('on', !!on);
    const b = el.firstElementChild;
    if (b) b.style.width = (clamp(p, 0, 1) * 100).toFixed(2) + '%';
    el.setAttribute('aria-valuenow', String(Math.round(clamp(p, 0, 1) * 100)))
  }
  function stopProg() {
    cancelAnimationFrame(progRaf); progRaf = 0; clearTimeout(progTimer); progTimer = 0;
    paintProg(0, false)
  }
  function runProg(dur) {
    stopProg();
    const d = Math.max(.08, dur || 0), t0 = performance.now();
    paintProg(0, true);
    const tick = now => {
      const p = clamp((now - t0) / (d * 1000), 0, 1);
      paintProg(p, true);
      if (p < 1) { progRaf = requestAnimationFrame(tick); return }
      progRaf = 0;
      progTimer = setTimeout(() => { progTimer = 0; paintProg(0, false) }, 260)
    };
    progRaf = requestAnimationFrame(tick)
  }
  function playFrag(i, when = 0, short = false) {
    const m = cuts.get(i) || 0, s = bounds[i], e = short ? Math.min(bounds[i + 1], s + 1.2) : bounds[i + 1];
    let d;
    if (m === 1) d = playClip(6, s, e, { when, reverse: true, rate: .9, wet: .3 });
    else if (m === 2) { const mid = (s + e) / 2; let a = playClip(6, s, mid, { when, wet: .12 }); a += .32; a += playClip(6, mid, e, { when: when + a, reverse: true, wet: .35 }); d = a }
    else d = playClip(6, s, e, { when, wet: .1 });
    if (!playing && when === 0) runProg(d);
    return d
  }
  function status() { const n = slots.filter(s => s !== null).length; $('laStatusText').textContent = `${n} de 4 espacios compuestos` + (cuts.size ? ` · ${cuts.size} intervenido${cuts.size > 1 ? 's' : ''}` : ''); $('laListen').disabled = n < 4 || playing || !real; $('laConfirm').style.display = (listened && !playing) || (!real && n === 4) ? 'block' : 'none' }
  function cardEl(i, asGhost) {
    const c = document.createElement('div'); c.className = 'lcard' + (cuts.has(i) ? ' cut' : '') + (!asGhost && drag && drag.i === i ? ' lifted' : ''); c.dataset.i = i; if (cuts.has(i)) c.dataset.tag = cuts.get(i) === 1 ? 'invertido' : 'tajo';
    c.innerHTML = `<strong>${NAMES[i]}</strong><img src="${wf[i]}" alt="" draggable="false"><div class="tiny">${fmt(bounds[i])} – ${fmt(bounds[i + 1])}</div>`; if (!asGhost) c.addEventListener('pointerdown', e => onCard(e, i)); return c
  }
  function render() {
    const fr = $('laFrame'); fr.innerHTML = ''; slots.forEach((c, i) => { const el = document.createElement('div'); el.className = 'slot' + (c !== null ? ' full' : ''); if (c === null) el.textContent = ['I', 'II', 'III', 'IV'][i]; else el.appendChild(cardEl(c)); fr.appendChild(el) });
    const tr = $('tray'); tr.innerHTML = ''; tray.forEach(c => tr.appendChild(cardEl(c))); status()
  }
  function slotEl(x, y) { return [...document.querySelectorAll('#laFrame .slot')].find(s => { const r = s.getBoundingClientRect(); return x > r.left - 14 && x < r.right + 14 && y > r.top - 14 && y < r.bottom + 14 }) }
  function removeFrom(i) { const si = slots.indexOf(i); if (si >= 0) slots[si] = null; const ti = tray.indexOf(i); if (ti >= 0) tray.splice(ti, 1) }
  function onCard(e, i) {
    if (S.phase !== 'play' || playing) return; e.preventDefault();
    if (chisel) { const n = ((cuts.get(i) || 0) + 1) % 3; if (n) cuts.set(i, n); else cuts.delete(i); hiss(.2, .08, 5000, 0, A.master); shake(n ? 5 : 2); burst(e.clientX, e.clientY, LIMEH, n ? 22 : 8, 260, .6, 3); toast(n === 1 ? 'Cincel · invertido' : n === 2 ? 'Cincel · tajo y separación' : 'Cincel · fragmento restaurado'); if (real && n) { stopClips(); playFrag(i, 0, true) } listened = false; render(); return }
    /* ARRASTRE. Un solo arrastre a la vez: con un fragmento en el aire, otro dedo (o la palma) sobre una tarjeta no
       abre un segundo arrastre. Antes lo abría, pisaba la tarjeta fantasma del primero y esta se quedaba pegada en
       pantalla para siempre (y al soltar saltaba un error que dejaba la interfaz a medias). */
    if (endDrag) return;
    /* Punto de agarre en coordenadas de la tarjeta SIN transformar. Con ratón la tarjeta está inclinada y levantada
       por el «hover»: su caja en pantalla es mayor que la tarjeta y está corrida; medir con ella desplazaba y
       agrandaba el fragmento al levantarlo. Se deshace esa transformación alrededor del centro de la caja. */
    const card = e.currentTarget, w = card.offsetWidth, h = card.offsetHeight, r = card.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    const m = new DOMMatrix(getComputedStyle(card).transform), det = m.a * m.d - m.b * m.c || 1, cx = sx - (r.left + r.width / 2), cy = sy - (r.top + r.height / 2);
    const ox = clamp((m.d * cx - m.c * cy) / det + w / 2, 0, w), oy = clamp((m.a * cy - m.b * cx) / det + h / 2, 0, h);
    let moved = false;
    const g = ghost = cardEl(i, true); g.classList.add('drag'); g.style.width = w + 'px'; g.style.height = h + 'px';
    /* La tarjeta fantasma se mueve solo con transform (sin recalcular la maquetación en cada evento) y gira y crece
       alrededor del punto agarrado: ese punto queda exactamente bajo el dedo, se agarre por donde se agarre. */
    g.style.transformOrigin = ox + 'px ' + oy + 'px';
    const place = (x, y) => { g.style.transform = `translate3d(${x - ox}px,${y - oy}px,0) scale(1.1) rotate(-3deg)` };
    const slotsEl = () => document.querySelectorAll('#laFrame .slot');
    /* La captura mantiene el gesto aunque el puntero salga de la ventana o del marco de la landing. */
    try { card.setPointerCapture(pid) } catch { }
    const mv = ev => {
      if (ev.pointerId !== pid) return;
      /* Al despegar NO se vuelve a pintar la bandeja (antes se reconstruía entera y se destruía la tarjeta que tenía
         el puntero): basta con atenuar la original. */
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 7) { moved = true; drag = { i }; card.classList.add('lifted'); place(ev.clientX, ev.clientY); $('laUI').appendChild(g) } // dentro de #laUI: hereda la letra y el relleno de las tarjetas de cada formato
      if (moved) { place(ev.clientX, ev.clientY); const s = slotEl(ev.clientX, ev.clientY); slotsEl().forEach(x => x.classList.toggle('hover', x === s)) }
    };
    /* Fin del gesto. `drop` = se soltó de verdad; sin él (pointercancel, la ventana pierde el foco, la sala se
       cierra) el fragmento vuelve a su sitio y nada cambia: antes una cancelación lo «soltaba» donde estuviera. */
    const end = (ev, drop) => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); removeEventListener('blur', cancel);
      try { card.releasePointerCapture(pid) } catch { }
      endDrag = null; g.remove(); if (ghost === g) ghost = null; drag = null; card.classList.remove('lifted'); slotsEl().forEach(x => x.classList.remove('hover'));
      if (!drop) return;
      if (!moved) { if (real) { stopClips(); playFrag(i) } return } // toque = oír el fragmento
      const s = slotEl(ev.clientX, ev.clientY);
      if (s) {
        const si = [...slotsEl()].indexOf(s); const prev = slots[si]; removeFrom(i); if (prev !== null && prev !== i) tray.push(prev); slots[si] = i;
        burst(ev.clientX, ev.clientY, LIMEH, 16, 220, .5, 3); ringFx(ev.clientX, ev.clientY, LIMEH, 10, 80, .4, 2); ftext(ev.clientX, ev.clientY - 40, 'encaja', LIMEH, 18); if (real) { stopClips(); playFrag(i, 0, true) }
      }
      else { removeFrom(i); tray.push(i); tone(180, .08, 'triangle', .04, 0, A.master) }
      listened = false; render()
    };
    const up = ev => { if (ev.pointerId === pid) end(ev, S.phase === 'play' && !playing) };
    const cancel = ev => { if (ev?.pointerId === undefined || ev.pointerId === pid) end(ev, false) };
    endDrag = () => end(null, false);
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cancel); addEventListener('blur', cancel)
  }
  function play() {
    if (slots.some(s => s === null) || playing || !real) return; playing = true; status(); ensureAudio(); stopClips(); let t = 0; const els = [...document.querySelectorAll('#laFrame .slot')];
    slots.forEach((i, k) => { const d = playFrag(i, t); setTimeout(() => { els.forEach(x => x.classList.remove('playing')); els[k]?.classList.add('playing'); const rc = els[k]?.getBoundingClientRect(); if (rc) burst(rc.left + rc.width / 2, rc.top + rc.height / 2, LIMEH, 14, 200, .5, 3) }, t * 1000); t += d + .12 });
    runProg(t);
    hint('Escuchando tu reensamblaje…'); setTimeout(() => { document.querySelectorAll('#laFrame .slot').forEach(x => x.classList.remove('playing')); playing = false; listened = true; status(); hint('Puedes reordenar y volver a escuchar, o entregar la obra.') }, t * 1000 + 300)
  }
  const getFloorY = () => meta.floorY ?? 1.40;

  /* ---------- Hojas de partitura suspendidas ----------
     Antes: seis biombos de caja + tubos (≈ 60 mallas, geometrías y materiales nuevos por panel).
     Ahora: hojas de papel curvadas con textura de partitura, en dos anillos concéntricos que orbitan
     despacio en sentidos opuestos. Una geometría y un material compartidos; cada anillo es una sola
     InstancedMesh (2 llamadas de dibujo en total). Las hojas flotan por encima de los biombos fijos del
     escenario y de la espiral de la cámara (que sube hasta ~4,2 m): nunca la atraviesan ni chocan con
     los paneles del modelo. Se inclinan hacia el centro para leerse desde abajo. */
  let paperTex = null;
  function paperTexture() {
    if (paperTex) return paperTex;
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#e6dfcf'; x.fillRect(0, 0, 512, 512);
    // fibras y manchas leves del papel
    for (let i = 0; i < 1400; i++) { const g = 200 + Math.random() * 40 | 0; x.fillStyle = `rgba(${g},${g - 8},${g - 24},${Math.random() * .08})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1) }
    const edge = x.createRadialGradient(256, 256, 160, 256, 256, 380); edge.addColorStop(0, 'rgba(120,100,60,0)'); edge.addColorStop(1, 'rgba(120,100,60,.28)'); x.fillStyle = edge; x.fillRect(0, 0, 512, 512);
    // pentagramas con notas: una partitura «intervenida»
    x.strokeStyle = 'rgba(40,36,30,.55)'; x.lineWidth = 1.4;
    for (let st = 0; st < 6; st++) {
      const y0 = 58 + st * 74;
      for (let l = 0; l < 5; l++) { x.beginPath(); x.moveTo(34, y0 + l * 8); x.lineTo(478, y0 + l * 8); x.stroke() }
      x.fillStyle = 'rgba(30,28,24,.75)';
      for (let n = 0; n < 11; n++) { const nx = 70 + n * 38 + Math.random() * 10, ny = y0 + (Math.random() * 9 | 0) * 4; x.beginPath(); x.ellipse(nx, ny, 5, 3.6, -.4, 0, 6.283); x.fill(); x.fillRect(nx + 4, ny - 26, 1.4, 26) }
    }
    // un tajo verde: la intervención de María Clara sobre la obra
    x.strokeStyle = 'rgba(194,254,11,.85)'; x.lineWidth = 5; x.beginPath(); x.moveTo(60, 430); x.lineTo(450, 300); x.stroke();
    paperTex = new THREE.CanvasTexture(c); paperTex.colorSpace = THREE.SRGBColorSpace; paperTex.anisotropy = 4;
    return paperTex;
  }
  /* Hoja curvada (como papel que se comba): plano subdividido doblado en arco. */
  function paperGeometry(w, h) {
    const g = new THREE.PlaneGeometry(w, h, 12, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (w / 2); p.setZ(i, (1 - u * u) * .22 + Math.sin(p.getY(i) * 1.3) * .04) }
    g.computeVertexNormals();
    return g;
  }
  const RINGS = [
    { n: 8, r: 6.6, w: 1.9, h: 2.1, y: 6.6, bob: .18, speed: .035, pitch: .38 },   // anillo interior (antes: seis biombos)
    { n: 12, r: 9.4, w: 1.4, h: 1.7, y: 7.8, bob: .3, speed: -.022, pitch: .46 }    // anillo exterior, más alto, en sentido contrario
  ];
  const _po = new THREE.Object3D(); _po.rotation.order = 'YXZ'; // primero mira al centro, luego se inclina
  /* Del preludio al juego: en el preludio las hojas flotan libres por la sala (form = 0); al empezar el Momento
     se ordenan poco a poco en sus anillos (form → 1 en ~6 s). Se interpola posición y giro: sin saltos. */
  const _pf = new THREE.Object3D(), _v = new THREE.Vector3(), _q = new THREE.Quaternion();
  let form = 0, forming = false, flies = null;
  const TOUCH_LOW = matchMedia('(pointer:coarse)').matches;
  const _camPos = new THREE.Vector3(), _camLook = new THREE.Vector3();

  return {
    noParallax: true,
    // Cámara en espiral 3D continua alrededor del eje Y
    cam() {
      const fy = getFloorY();
      const ang = T * 0.15; // Velocidad de giro alrededor del centro (~50s por vuelta completa)

      // Variación armónica de radio y altura para generar la espiral tridimensional
      const r = 9.0 + Math.sin(T * 0.2) * 1.4; // El radio oscila suavemente entre 6.6m y 9.4m
      const y = fy + 3.2 + Math.cos(T * 0.2) * 1.0; // La altura sube y baja entre fy+2.2m y fy+4.2m

      /* Pantallas verticales: el campo horizontal es estrecho y María Clara, a 2,1 m del eje de giro, barría la
         pantalla de borde a borde (y se salía a medias). La mirada se desplaza de la mesa hacia ella en proporción
         a lo vertical que sea la pantalla: en horizontal y escritorio sigue centrada en la mesa. */
      const w = clamp((1.1 - (camera.aspect || 1.6)) / .5, 0, 1) * .62, gz = (meta.gameAvatarPos?.z ?? -2.1) * w;
      _camPos.set(Math.sin(ang) * r, y, Math.cos(ang) * r + gz);
      _camLook.set(0, fy + 1.4, gz); // Enfoca continuamente a la mesa central y al avatar
      return { pos: _camPos, look: _camLook };
    },
    build() {
      const fy = getFloorY();

      // Hojas de partitura suspendidas en anillos concéntricos (ver paperTexture / RINGS)
      papers = []; form = 0; forming = false;
      /* Luciérnagas moradas (engine/sky.js): un solo Points animado en el shader; recogen la luz violeta de la sala. */
      flies = createFireflies({ n: TOUCH_LOW ? 60 : 130, rMin: 2.6, rMax: 13, yMin: fy + .5, yMax: fy + 6.5, colorA: 0xa56bff, colorB: 0xff7ad9, size: .2 });
      roomGroup.add(flies.points);
      const pt = paperTexture();
      /* un leve brillo propio: papel bajo luz de escena, legible aunque flote sobre los focos */
      const paperMat = mat(0xffffff, { map: pt, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: .14, roughness: .92, metalness: 0, side: THREE.DoubleSide });
      for (const R of RINGS) {
        const im = new THREE.InstancedMesh(paperGeometry(R.w, R.h), paperMat, R.n);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false;
        const items = [];
        for (let i = 0; i < R.n; i++) items.push({ a: (i / R.n) * Math.PI * 2 + (R.speed < 0 ? .26 : 0), ph: i * 1.1 + R.r, tilt: (Math.random() - .5) * .18 });
        roomGroup.add(im);
        papers.push({ R, im, items });
      }

      // Colocar al avatar de pie en el piso detrás de la mesa
      const gp = meta.gameAvatarPos || { x: 0, y: fy, z: -2.1, yaw: 0 };
      avatarObj.position.set(gp.x, gp.y ?? fy, gp.z);
      avatarObj.rotation.y = gp.yaw ?? 0;
      avatarObj.scale.setScalar(1.1);

      /* Room 6 FBX + iluminación (retornamos la promesa para sincronizar con la cortina) */
      return placeFBX(6, roomGroup, 16, { roughness: 0.78, metalness: 0.16 }, () => roomGen);
    },
    start() {
      forming = true; // las hojas dejan de vagar y buscan su formación
      const fy = getFloorY();
      const gp = meta.gameAvatarPos || { x: 0, y: fy, z: -2.1, yaw: 0 };
      avatarObj.position.set(gp.x, gp.y ?? fy, gp.z);
      avatarObj.rotation.y = gp.yaw ?? 0;

      endDrag?.(); cuts = new Map(); playing = false; listened = false; drag = null; chisel = false; real = recOk(6); stopProg();
      const reg = regionFor(6); bounds = splitRegion(6, reg.from, reg.to, 6); wf = [0, 1, 2, 3, 4, 5].map(i => wfImg(recPeaks(6, bounds[i], bounds[i + 1], 36)));
      slots = [null, null, null, null]; tray = [0, 1, 2, 3, 4, 5]; if (!real) { fbPad = pad([110, 165, 220], .05); fbPad.set(1) }
      $('laUI').style.display = 'block'; const cb = $('chiselBtn'); cb.style.display = S.mod.has('chisel') ? 'block' : 'none'; cb.classList.remove('on'); cb.classList.toggle('nudge', S.mod.has('chisel')); cb.textContent = '✂ Cincel'; if (S.mod.has('chisel')) setTimeout(() => { if (S.phase === 'play' && S.room === 6) toast('Cincel de Deconstrucción listo · actívalo para intervenir') }, 900);
      cb.onclick = () => { chisel = !chisel; cb.classList.remove('nudge'); cb.classList.toggle('on', chisel); cb.textContent = chisel ? '✂ Cincel activo' : '✂ Cincel'; hint(chisel ? 'Cincel activo: toca un fragmento · 1 toque invierte · 2 toques lo parte y separa · 3 lo restaura' : 'Toca un fragmento para oírlo · arrástralo al pentagrama') };
      $('laListen').onclick = play; $('laConfirm').onclick = () => finish({ slots: [...slots], cuts: cuts.size }, [['Secuencia', slots.map(i => NAMES[i].slice(-1)).join(' · ')], ['Fragmentos intervenidos', cuts.size ? `${cuts.size} (${[...cuts.values()].filter(v => v === 1).length} invertido · ${[...cuts.values()].filter(v => v === 2).length} tajo)` : '0']]);
      render(); hint(real ? 'Toca un fragmento para oírlo · arrástralo al pentagrama' : 'No encontré la grabación: modo provisional (compón la secuencia y entrégala)')
    },
    update() { },
    /* Cada cuadro de la sala, también en el preludio: hojas y luciérnagas. */
    ambient(dt, t3) {
      const fy = getFloorY();
      if (forming && form < 1) form = Math.min(1, form + dt / 6);
      const k = form * form * (3 - 2 * form);
      let n = 0;
      for (const { R, im, items } of papers) {
        items.forEach((it, i) => {
          /* formación: órbita lenta en su anillo (sentidos opuestos), flotación y balanceo de papel */
          const ang = it.a + t3 * R.speed;
          _po.position.set(Math.cos(ang) * R.r, fy + R.y + Math.sin(t3 * .55 + it.ph) * R.bob, Math.sin(ang) * R.r);
          _po.rotation.set(R.pitch + Math.sin(t3 * .4 + it.ph) * .08 + it.tilt, -ang - Math.PI / 2, Math.cos(t3 * .33 + it.ph) * .06);
          if (k < 1) {
            /* vuelo libre: cada hoja deriva por la sala en una espiral propia que se abre y se cierra,
               sube y baja, y da vueltas sobre sí misma — objetos suspendidos, sin rumbo fijo */
            const s = n * 2.399, fa = s + t3 * (.07 + (n % 5) * .018) * (n % 2 ? 1 : -1), fr = 7.4 + 2.6 * Math.sin(t3 * .11 + s);
            _pf.position.set(Math.cos(fa) * fr, fy + 3.3 + 2.1 * (.5 + .5 * Math.sin(t3 * .19 + s * 1.7)) + Math.sin(t3 * .7 + s) * .25, Math.sin(fa) * fr);
            _pf.rotation.set(t3 * (.21 + (n % 3) * .06) + s, t3 * (.13 + (n % 4) * .04) + s * 2, Math.sin(t3 * .3 + s) * .8);
            _v.copy(_po.position); _q.copy(_po.quaternion);
            _po.position.lerpVectors(_pf.position, _v, k); _po.quaternion.slerpQuaternions(_pf.quaternion, _q, k);
          }
          _po.updateMatrix(); im.setMatrixAt(i, _po.matrix); n++;
        });
        im.instanceMatrix.needsUpdate = true;
      }
      flies?.update(t3, GX.renderer);
    },
    update3d(dt, t3) {
      animAvatar(avatarObj, 0, t3, true, A.lvl);
      if (bloom) bloom.strength = .55;
    },
    draw() { }, stop() { endDrag?.(); $('laUI').style.display = 'none'; ghost?.remove(); ghost = null; stopClips(); stopProg() }
  }
})();
