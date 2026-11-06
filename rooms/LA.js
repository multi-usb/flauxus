/* ======================================================================
   FLAUXUS — Sala 6 · LA♯ — MataЯ al padre
   La partitura deja de ser página cerrada: extrae, interviene y reensambla.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { recOk, pad, tone, hiss, playClip, stopClips, A, regionFor, splitRegion, recPeaks, wfImg, ensureAudio, fmt } from '../AudioSystem.js';
import { S, roomGroup, avatarObj, bloom, animAvatar, burst, ringFx, ftext, shake, LIMEH, PAPER, hint, toast, finish, roomGen, mat, T, $ } from './context.js';

export const meta = {
  key: 'la',
  id: 6, note: 'LA♯4', short: 'LA♯', title: 'MataЯ al padre', desc: 'La partitura deja de ser página cerrada: extrae, interviene y reensambla.', source: 'CPE Bach Intervención.wav', audio: 'real', color: 0xc9d000, hex: '#c9d000', avatar: 'body',
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
    bg: 0x221e1d, fog: .024, exp: .95, env: .25, hemi: [0xf0e0d8, 0x241818, .3], key: { c: 0xffe4d4, i: .9, p: [8, 18, 10] }, rim: { c: 0xc9d000, base: 2, k: 8 }, bloomT: .82,
    pts: [{ c: 0xff4422, e: 1.3, r: 6, p: [6, 5, -4] }, { c: 0x8844ff, e: 1.0, r: 6, p: [0, 3, -6] }], spot: { c: 0xffeedd, e: 1.3, r: 16, p: [0, 16, 0], t: [0, 0, -2], ang: .8, pen: .4 }
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
  let bounds = [], wf = [], slots = [null, null, null, null], tray = [], cuts = new Map(), playing = false, listened = false, drag = null, ghost = null, chisel = false, papers = [], real = false, fbPad = null;
  // Cincel: 1 = invertido · 2 = tajo y separación (corta a la mitad, deja un silencio y la 2ª mitad vuelve al revés)
  function playFrag(i, when = 0, short = false) {
    const m = cuts.get(i) || 0, s = bounds[i], e = short ? Math.min(bounds[i + 1], s + 1.2) : bounds[i + 1];
    if (m === 1) return playClip(6, s, e, { when, reverse: true, rate: .9, wet: .3 });
    if (m === 2) { const mid = (s + e) / 2; let d = playClip(6, s, mid, { when, wet: .12 }); d += .32; d += playClip(6, mid, e, { when: when + d, reverse: true, wet: .35 }); return d }
    return playClip(6, s, e, { when, wet: .1 })
  }
  function status() { const n = slots.filter(s => s !== null).length; $('laStatus').textContent = `${n} de 4 espacios compuestos` + (cuts.size ? ` · ${cuts.size} intervenido${cuts.size > 1 ? 's' : ''}` : ''); $('laListen').disabled = n < 4 || playing || !real; $('laConfirm').style.display = (listened && !playing) || (!real && n === 4) ? 'block' : 'none' }
  function cardEl(i, asGhost) {
    const c = document.createElement('div'); c.className = 'lcard' + (cuts.has(i) ? ' cut' : '') + (!asGhost && drag && drag.i === i ? ' lifted' : ''); c.dataset.i = i; if (cuts.has(i)) c.dataset.tag = cuts.get(i) === 1 ? 'invertido' : 'tajo';
    c.innerHTML = `<strong>${NAMES[i]}</strong><img src="${wf[i]}" alt=""><div class="tiny">${fmt(bounds[i])} – ${fmt(bounds[i + 1])}</div>`; if (!asGhost) c.addEventListener('pointerdown', e => onCard(e, i)); return c
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
    const r = e.currentTarget.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = sx - r.left, oy = sy - r.top, pid = e.pointerId; let moved = false;
    ghost = cardEl(i, true); ghost.classList.add('drag'); ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
    const mv = ev => {
      if (ev.pointerId !== pid) return; if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 7) { moved = true; document.body.appendChild(ghost); drag = { i }; render() }
      if (moved) { ghost.style.left = (ev.clientX - ox) + 'px'; ghost.style.top = (ev.clientY - oy) + 'px'; const s = slotEl(ev.clientX, ev.clientY); document.querySelectorAll('#laFrame .slot').forEach(x => x.classList.toggle('hover', x === s)) }
    };
    const up = ev => {
      if (ev.pointerId !== pid) return; removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!moved) { ghost = null; if (real) { stopClips(); playFrag(i) } return } // toque = oír el fragmento
      const s = slotEl(ev.clientX, ev.clientY); ghost.remove(); ghost = null; drag = null;
      if (s) {
        const si = [...document.querySelectorAll('#laFrame .slot')].indexOf(s); const prev = slots[si]; removeFrom(i); if (prev !== null && prev !== i) tray.push(prev); slots[si] = i;
        burst(ev.clientX, ev.clientY, LIMEH, 16, 220, .5, 3); ringFx(ev.clientX, ev.clientY, LIMEH, 10, 80, .4, 2); ftext(ev.clientX, ev.clientY - 40, 'encaja', LIMEH, 18); if (real) { stopClips(); playFrag(i, 0, true) }
      }
      else { removeFrom(i); tray.push(i); tone(180, .08, 'triangle', .04, 0, A.master) }
      listened = false; render()
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up)
  }
  function play() {
    if (slots.some(s => s === null) || playing || !real) return; playing = true; status(); ensureAudio(); stopClips(); let t = 0; const els = [...document.querySelectorAll('#laFrame .slot')];
    slots.forEach((i, k) => { const d = playFrag(i, t); setTimeout(() => { els.forEach(x => x.classList.remove('playing')); els[k]?.classList.add('playing'); const rc = els[k]?.getBoundingClientRect(); if (rc) burst(rc.left + rc.width / 2, rc.top + rc.height / 2, LIMEH, 14, 200, .5, 3) }, t * 1000); t += d + .12 });
    hint('Escuchando tu reensamblaje…'); setTimeout(() => { document.querySelectorAll('#laFrame .slot').forEach(x => x.classList.remove('playing')); playing = false; listened = true; status(); hint('Puedes reordenar y volver a escuchar, o entregar la obra.') }, t * 1000 + 300)
  }
  const getFloorY = () => meta.floorY ?? 1.40;

  // Generador de biombos que replican los paneles del modelo (tubos oscuros + lienzo beige)
  function createExhibitionPanel(w = 2.3, h = 2.2) {
    const g = new THREE.Group();
    const poleMat = mat(0x1a1c16, { roughness: 0.6, metalness: 0.35 });
    const boardMat = mat(0xd4cdba, { roughness: 0.88, metalness: 0.05, side: THREE.DoubleSide });

    // Panel central de lienzo / papel
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), boardMat);
    board.position.y = h * 0.5 + 0.2;
    g.add(board);

    // Parantes laterales tubulares de soporte
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, h + 0.6, 12);
    const poleL = new THREE.Mesh(poleGeo, poleMat);
    poleL.position.set(-w * 0.5 - 0.04, (h + 0.6) * 0.5, 0);
    const poleR = new THREE.Mesh(poleGeo, poleMat);
    poleR.position.set(w * 0.5 + 0.04, (h + 0.6) * 0.5, 0);
    g.add(poleL);
    g.add(poleR);

    // Abrazaderas metálicas de fijación
    const clampGeo = new THREE.BoxGeometry(0.11, 0.06, 0.11);
    for (const py of [h * 0.25 + 0.2, h * 0.75 + 0.2]) {
      const bL = new THREE.Mesh(clampGeo, poleMat);
      bL.position.set(-w * 0.5 - 0.04, py, 0);
      const bR = new THREE.Mesh(clampGeo, poleMat);
      bR.position.set(w * 0.5 + 0.04, py, 0);
      g.add(bL);
      g.add(bR);
    }
    return g;
  }

  return {
    noParallax: true,
    // Cámara en espiral 3D continua alrededor del eje Y
    cam() {
      const fy = getFloorY();
      const ang = T * 0.15; // Velocidad de giro alrededor del centro (~50s por vuelta completa)

      // Variación armónica de radio y altura para generar la espiral tridimensional
      const r = 9.0 + Math.sin(T * 0.2) * 1.4; // El radio oscila suavemente entre 6.6m y 9.4m
      const y = fy + 3.2 + Math.cos(T * 0.2) * 1.0; // La altura sube y baja entre fy+2.2m y fy+4.2m

      return {
        pos: new THREE.Vector3(Math.sin(ang) * r, y, Math.cos(ang) * r),
        look: new THREE.Vector3(0, fy + 1.4, 0) // Enfoca continuamente a la mesa central y al avatar
      };
    },
    build() {
      const fy = getFloorY();

      // Paneles móviles estilizados ubicados cerca del perímetro del escenario
      papers = [];
      const panelCount = 6;
      const orbitR = 9.2; // Radio cercano a los paneles fijos del FBX

      for (let i = 0; i < panelCount; i++) {
        const p = createExhibitionPanel(2.4, 2.2);
        const a = (i / panelCount) * Math.PI * 2;
        p.position.set(Math.cos(a) * orbitR, fy + 0.15, Math.sin(a) * orbitR);
        p.rotation.y = -a + Math.PI / 2;
        p.userData = { baseAngle: a, orbitR, phase: i * 1.1 };
        roomGroup.add(p);
        papers.push(p);
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
      const fy = getFloorY();
      const gp = meta.gameAvatarPos || { x: 0, y: fy, z: -2.1, yaw: 0 };
      avatarObj.position.set(gp.x, gp.y ?? fy, gp.z);
      avatarObj.rotation.y = gp.yaw ?? 0;

      cuts = new Map(); playing = false; listened = false; drag = null; chisel = false; real = recOk(6);
      const reg = regionFor(6); bounds = splitRegion(6, reg.from, reg.to, 6); wf = [0, 1, 2, 3, 4, 5].map(i => wfImg(recPeaks(6, bounds[i], bounds[i + 1], 36)));
      slots = [null, null, null, null]; tray = [0, 1, 2, 3, 4, 5]; if (!real) { fbPad = pad([110, 165, 220], .05); fbPad.set(1) }
      $('laUI').style.display = 'block'; const cb = $('chiselBtn'); cb.style.display = S.mod.has('chisel') ? 'block' : 'none'; cb.classList.remove('on'); cb.classList.toggle('nudge', S.mod.has('chisel')); cb.textContent = '✂ Cincel'; if (S.mod.has('chisel')) setTimeout(() => { if (S.phase === 'play' && S.room === 6) toast('Cincel de Deconstrucción listo · actívalo para intervenir') }, 900);
      cb.onclick = () => { chisel = !chisel; cb.classList.remove('nudge'); cb.classList.toggle('on', chisel); cb.textContent = chisel ? '✂ Cincel activo' : '✂ Cincel'; hint(chisel ? 'Cincel activo: toca un fragmento · 1 toque invierte · 2 toques lo parte y separa · 3 lo restaura' : 'Toca un fragmento para oírlo · arrástralo al pentagrama') };
      $('laListen').onclick = play; $('laConfirm').onclick = () => finish({ slots: [...slots], cuts: cuts.size }, [['Secuencia', slots.map(i => NAMES[i].slice(-1)).join(' · ')], ['Fragmentos intervenidos', cuts.size ? `${cuts.size} (${[...cuts.values()].filter(v => v === 1).length} invertido · ${[...cuts.values()].filter(v => v === 2).length} tajo)` : '0']]);
      render(); hint(real ? 'Toca un fragmento para oírlo · arrástralo al pentagrama' : 'No encontré la grabación: modo provisional (compón la secuencia y entrégala)')
    },
    update() { },
    update3d(dt, t3) {
      const fy = getFloorY();
      // Órbita y cabeceo sutil de los biombos cerca del borde
      papers.forEach(p => {
        const u = p.userData;
        const curAngle = u.baseAngle + t3 * 0.035;
        p.position.set(
          Math.cos(curAngle) * u.orbitR,
          fy + 0.15 + Math.sin(t3 * 0.7 + u.phase) * 0.1,
          Math.sin(curAngle) * u.orbitR
        );
        p.rotation.y = -curAngle + Math.PI / 2;
      });
      animAvatar(avatarObj, 0, t3, true, A.lvl);
      if (bloom) bloom.strength = .55;
    },
    draw() { }, stop() { $('laUI').style.display = 'none'; ghost?.remove(); ghost = null; stopClips() }
  }
})();
