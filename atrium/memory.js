/* ======================================================================
   FLAUXUS — atrium/memory.js
   La memoria del atrio: cada Momento completado deja una huella visible.

   El atrio consulta el progreso real (S.completed, que ahora se guarda en
   el navegador — core/state.js) y enciende lo que corresponde:

     1 · DO   El sonido bello    → el aro de resonancia con su columna de aire
     2 · RE   El pulso           → un metrónomo que late
     3 · MI   El fraseo          → un atril con su partitura y dos arcos de frase
     4 · FA♯  El cuerpo          → los campos concéntricos + motas verdes por todo el atrio
     5 · SOL♯ El unicornio cyborg→ el núcleo con sus anillos orbitales
     6 · LA♯  MataЯ al padre     → hojas de partitura que circulan por el atrio + luciérnagas moradas

   Cada objeto es el elemento más reconocible de su sala (los mismos que
   construye rooms/<ID>.js), reducido y suspendido junto a su escalera.

   Reglas técnicas:
   · Todo se construye UNA vez (oculto) y solo cambia de visibilidad: no hay
     duplicados ni crecimiento de memoria al volver al atrio.
   · Geometrías pequeñas y materiales compartidos; las partículas son un
     único Points por efecto, animadas en el shader (engine/sky.js).
   · Al completar una sala, su huella aparece con una animación; al
     reiniciar el progreso, todo se apaga.
   ====================================================================== */
import * as THREE from 'three';
import { LIME } from '../core/util.js';
import { createFireflies } from '../engine/sky.js';

const V3 = THREE.Vector3;
const M = { items: [], motes: null, flies: null, sheets: null, sheetItems: [], built: false, placed: false };
const _o = new THREE.Object3D();

function scoreTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#e6dfcf'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(40,36,30,.6)'; x.lineWidth = 1;
  for (let s = 0; s < 4; s++) { const y0 = 34 + s * 56; for (let l = 0; l < 5; l++) { x.beginPath(); x.moveTo(18, y0 + l * 6); x.lineTo(238, y0 + l * 6); x.stroke() } x.fillStyle = 'rgba(30,28,24,.8)'; for (let n = 0; n < 8; n++) { x.beginPath(); x.ellipse(34 + n * 26, y0 + (n * 7 % 5) * 6, 4, 3, -.4, 0, 6.283); x.fill() } }
  x.strokeStyle = 'rgba(194,254,11,.9)'; x.lineWidth = 4; x.beginPath(); x.moveTo(30, 214); x.lineTo(226, 150); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildAtriumMemory(world) {
  M.items = []; M.placed = false; M.built = true;
  const lime = new THREE.MeshBasicMaterial({ color: LIME });
  const limeSoft = new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending });
  const pale = new THREE.MeshBasicMaterial({ color: 0xefeadb });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1c16, roughness: .55, metalness: .35 });
  const paperTex = scoreTexture();
  const paper = new THREE.MeshBasicMaterial({ map: paperTex, side: THREE.DoubleSide });
  const mk = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m };

  /* 1 · DO: aro de resonancia + columna de aire */
  const g1 = new THREE.Group();
  const ring1 = mk(new THREE.TorusGeometry(.62, .03, 8, 48), lime); ring1.rotation.x = Math.PI / 2; g1.add(ring1);
  g1.add(mk(new THREE.CylinderGeometry(.025, .025, 2.6, 6), limeSoft, 0, .2, 0));
  const breath = mk(new THREE.SphereGeometry(.14, 12, 10), pale); g1.add(breath);
  g1.userData.tick = (t) => { const k = 1 + Math.sin(t * 1.6) * .12; ring1.scale.setScalar(k); breath.scale.setScalar(.8 + Math.sin(t * 1.6) * .35) };

  /* 2 · RE: metrónomo */
  const g2 = new THREE.Group();
  const body = mk(new THREE.ConeGeometry(.42, 1.1, 4), dark, 0, 0, 0); body.rotation.y = Math.PI / 4; g2.add(body);
  const arm = new THREE.Group(); arm.position.y = -.42; const rod = mk(new THREE.BoxGeometry(.03, 1.25, .03), lime, 0, .62, .24); arm.add(rod); arm.add(mk(new THREE.BoxGeometry(.13, .1, .06), pale, 0, .9, .24)); g2.add(arm);
  const beat = mk(new THREE.TorusGeometry(.6, .015, 6, 40), limeSoft.clone(), 0, -.55, 0); beat.rotation.x = Math.PI / 2; g2.add(beat);
  g2.userData.tick = (t) => { const ph = t * Math.PI * 1.6; arm.rotation.z = Math.sin(ph) * .42; const p = Math.pow(Math.abs(Math.cos(ph)), 8); beat.scale.setScalar(1 + p * .35); beat.material.opacity = .2 + p * .5 };

  /* 3 · MI: atril con partitura + arcos de frase */
  const g3 = new THREE.Group();
  g3.add(mk(new THREE.CylinderGeometry(.025, .025, 1.3, 8), dark, 0, -.35, 0));
  for (let i = 0; i < 3; i++) { const leg = mk(new THREE.BoxGeometry(.03, .03, .5), dark, 0, -1, 0); leg.rotation.y = i * 2.094; leg.translateZ(.22); g3.add(leg) }
  const desk = mk(new THREE.BoxGeometry(.78, .56, .03), dark, 0, .45, .04); desk.rotation.x = -.32; g3.add(desk);
  const sheet = mk(new THREE.PlaneGeometry(.66, .46), paper, 0, .46, .065); sheet.rotation.x = -.32; g3.add(sheet);
  const arcs = [0, 1].map(i => { const a = mk(new THREE.TorusGeometry(.75 + i * .2, .014, 6, 40, Math.PI), i ? pale : lime, 0, .85, 0); g3.add(a); return a });
  g3.userData.tick = (t) => arcs.forEach((a, i) => { a.rotation.y = Math.sin(t * .5 + i) * .5; a.scale.setScalar(1 + Math.sin(t * 1.1 + i * 1.7) * .06) });

  /* 4 · FA♯: campos concéntricos */
  const g4 = new THREE.Group();
  const fields = [.35, .6, .85].map((r, i) => { const a = mk(new THREE.RingGeometry(r - .035, r, 40), i === 1 ? pale : lime); a.material = a.material.clone(); a.material.side = THREE.DoubleSide; a.material.transparent = true; a.rotation.x = -Math.PI / 2; g4.add(a); return a });
  g4.userData.tick = (t) => fields.forEach((a, i) => { a.position.y = Math.sin(t * 1.3 - i * .9) * .16; a.material.opacity = .55 + .45 * Math.sin(t * 1.3 - i * .9) });

  /* 5 · SOL♯: núcleo con anillos orbitales */
  const g5 = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x15170f, emissive: 0x4a5200, emissiveIntensity: 1.6, metalness: .4, roughness: .25 });
  g5.add(mk(new THREE.SphereGeometry(.36, 20, 14), coreMat));
  const orb = [0x19c6d9, LIME, 0xff4fb8].map((c, i) => { const a = mk(new THREE.TorusGeometry(.56 + i * .13, .012, 6, 48), new THREE.MeshBasicMaterial({ color: c })); a.rotation.set(i * 1.1, i * .7, 0); g5.add(a); return a });
  g5.userData.tick = (t, dt) => { orb.forEach((a, i) => { a.rotation.x += dt * (.5 + i * .2); a.rotation.y += dt * (.3 + i * .15) }); coreMat.emissiveIntensity = 1.4 + Math.sin(t * 2.2) * .5 };

  /* 6 · LA♯: tres hojas de partitura en abanico */
  const g6 = new THREE.Group();
  const fan = [-1, 0, 1].map(i => { const s = mk(new THREE.PlaneGeometry(.5, .64), paper, i * .34, 0, -Math.abs(i) * .12); s.rotation.y = -i * .45; g6.add(s); return s });
  g6.userData.tick = (t) => fan.forEach((s, i) => { s.position.y = Math.sin(t * .9 + i * 1.3) * .1; s.rotation.z = Math.sin(t * .6 + i) * .08 });

  [g1, g2, g3, g4, g5, g6].forEach((g, i) => {
    g.visible = false; g.scale.setScalar(.001);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false } });
    world.add(g);
    M.items.push({ g, id: i + 1, k: 0, want: 0, base: new V3(), ph: i * 1.3 });
  });

  /* Efectos de todo el atrio */
  M.motes = createFireflies({ n: 110, rMin: 4, rMax: 23, yMin: 1.6, yMax: 8, colorA: LIME, colorB: 0xe9ff9a, size: .2 });
  M.motes.points.visible = false; M.motes.k = 0; M.motes.want = 0; world.add(M.motes.points);
  M.flies = createFireflies({ n: 90, rMin: 5, rMax: 22, yMin: 1.8, yMax: 9, colorA: 0xb07bff, colorB: 0xff7ad9, size: .24 });
  M.flies.points.visible = false; M.flies.k = 0; M.flies.want = 0; world.add(M.flies.points);

  /* Hojas que circulan por el atrio (LA♯): una InstancedMesh de 14 hojas en una órbita alta y ancha,
     por fuera y por encima de las escaleras: no cruzan la cámara ni las rutas del jugador. */
  const N = 14, sg = new THREE.PlaneGeometry(1.1, 1.4, 6, 2), sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / .55; sp.setZ(i, (1 - u * u) * .12) }
  sg.computeVertexNormals();
  M.sheets = new THREE.InstancedMesh(sg, paper, N); M.sheets.instanceMatrix.setUsage(THREE.DynamicDrawUsage); M.sheets.frustumCulled = false; M.sheets.visible = false; M.sheets.k = 0; M.sheets.want = 0;
  M.sheetItems = Array.from({ length: N }, (_, i) => ({ a: i / N * 6.2832, r: 15 + (i % 3) * 2.2, y: 8.5 + (i % 4) * 1.1, ph: i * 2.1, sp: .05 + (i % 3) * .012 }));
  world.add(M.sheets);
}

/* Posición de cada huella: suspendida a un lado del pie de su escalera (se calcula cuando el atrio ya está
   calibrado, porque el NavMesh recoloca escaleras y portales al cargar el modelo). */
function place(stairGroups) {
  M.items.forEach((it, i) => {
    const g = stairGroups[i]; if (!g) return;
    g.updateMatrixWorld(true);
    it.base.copy(g.localToWorld(new V3(i % 2 ? -3.4 : 3.4, 3.9, 1.6)));
  });
  M.placed = true;
}

/** Enciende/apaga según el progreso. `instant` = sin animación (al arrancar o al restaurar una partida guardada). */
export function refreshAtriumMemory(completed, stairGroups, instant = false) {
  if (!M.built) return;
  if (!M.placed || instant) place(stairGroups);
  for (const it of M.items) { it.want = completed.has(it.id) ? 1 : 0; if (instant) it.k = it.want }
  M.motes.want = completed.has(4) ? 1 : 0; M.flies.want = completed.has(6) ? 1 : 0; M.sheets.want = completed.has(6) ? 1 : 0;
  if (instant) { M.motes.k = M.motes.want; M.flies.k = M.flies.want; M.sheets.k = M.sheets.want }
}

const ease = k => k * k * (3 - 2 * k);
export function updateAtriumMemory(dt, t, renderer) {
  if (!M.built) return;
  for (const it of M.items) {
    if (it.k !== it.want) it.k = Math.max(0, Math.min(1, it.k + (it.want > it.k ? dt / 1.8 : -dt / .8)));
    const on = it.k > 0; if (it.g.visible !== on) it.g.visible = on; if (!on) continue;
    const e = ease(it.k);
    it.g.scale.setScalar(Math.max(.001, e * 2.1));
    /* al aparecer sube desde abajo girando; luego flota y gira despacio */
    it.g.position.set(it.base.x, it.base.y - (1 - e) * 1.6 + Math.sin(t * .8 + it.ph) * .16, it.base.z);
    it.g.rotation.y = t * .25 + it.ph + (1 - e) * 5;
    it.g.userData.tick?.(t, dt);
  }
  for (const fx of [M.motes, M.flies]) {
    if (fx.k !== fx.want) fx.k = Math.max(0, Math.min(1, fx.k + (fx.want > fx.k ? dt / 3 : -dt)));
    const on = fx.k > 0; if (fx.points.visible !== on) fx.points.visible = on;
    if (on) { fx.gain = fx.k; fx.update(t, renderer) }
  }
  const s = M.sheets;
  if (s.k !== s.want) s.k = Math.max(0, Math.min(1, s.k + (s.want > s.k ? dt / 4 : -dt)));
  const on = s.k > 0; if (s.visible !== on) s.visible = on;
  if (on) {
    const e = ease(s.k);
    M.sheetItems.forEach((it, i) => {
      const a = it.a + t * it.sp;
      _o.position.set(Math.cos(a) * it.r, it.y + Math.sin(t * .5 + it.ph) * .6 - (1 - e) * 4, Math.sin(a) * it.r);
      _o.rotation.set(.3 + Math.sin(t * .4 + it.ph) * .25, -a - Math.PI / 2 + Math.sin(t * .23 + it.ph) * .5, Math.cos(t * .31 + it.ph) * .2);
      _o.scale.setScalar(Math.max(.001, e));
      _o.updateMatrix(); s.setMatrixAt(i, _o.matrix);
    });
    s.instanceMatrix.needsUpdate = true;
  }
}
