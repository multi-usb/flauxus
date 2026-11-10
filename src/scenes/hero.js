import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createPortal } from './portal.js';
import { createWall } from './wall.js';
import { createGrid } from './grid.js';

const VERDE = 0xc2fe0b;
const HEAD_TOP = 1.92; // el modelo mide 1,90 m con el cuerno

// Escena del Momento 1. Un protagonista al centro; lo que se mueve es la cámara.
export async function createHero({ glbBuffer, profile, channels }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 4, profile.mobile ? 15 : 17);

  const camera = new THREE.PerspectiveCamera(profile.mobile ? 42 : 34, 1, 0.1, 90);

  // Luz: una clave dura fija en el mundo, delante-arriba-izquierda de ella. Como la cámara gira y la luz no,
  // el recorrido pasa solo de contraluz (espalda) a luz lateral (perfil) a luz frontal (frente).
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-1.6, 3.2, 4.2);
  // Dos contraluces de color definen el volumen del traje sin teñir la piel: lima a un lado,
  // cian al otro. Su alcance corto los mantiene concentrados en María Clara.
  const limeRim = new THREE.PointLight(VERDE, 2.4, 8, 2);
  limeRim.position.set(-2.2, 2.25, -0.8);
  const cyanRim = new THREE.PointLight(0x48dff5, 2.2, 8, 2);
  cyanRim.position.set(2.1, 2.5, -1.1);
  const softFill = new THREE.PointLight(0xc2fe0b, 0.65, 7, 2);
  softFill.position.set(0, 1.25, 3.3);
  scene.add(ambient, key, limeRim, cyanRim, softFill);

  // ---------- María Clara ----------
  const gltf = await parseGLB(glbBuffer);
  const source = gltf.scene;
  const box = new THREE.Box3().setFromObject(source);
  source.position.y -= box.min.y; // pivote en los pies (el GLB lo trae en el centro del cuerpo)

  const figure = new THREE.Group();
  figure.add(source);
  scene.add(figure);

  // Línea de escaneo: por encima de ella se ve el personaje con su textura; por debajo, una silueta carbón
  // ("datos sin cargar"). Dos planos de corte, costo casi nulo.
  const clipTex = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HEAD_TOP);
  const clipSil = new THREE.Plane(new THREE.Vector3(0, -1, 0), HEAD_TOP);
  const silhouetteMaterial = new THREE.MeshLambertMaterial({ color: 0x383838, clippingPlanes: [clipSil] });

  const silhouettes = [];
  const meshes = [];
  source.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material.map || null;
    if (map) {
      map.generateMipmaps = true;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.magFilter = THREE.LinearFilter;
      map.anisotropy = 4;
      map.needsUpdate = true;
    }
    o.material = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.45,
      metalness: 0.25,
      side: THREE.DoubleSide,
      clippingPlanes: [clipTex],
    });
    meshes.push(o);
    const sil = new THREE.Mesh(o.geometry, silhouetteMaterial);
    sil.matrixAutoUpdate = false;
    o.updateMatrix();
    sil.matrix.copy(o.matrix);
    o.parent.add(sil);
    silhouettes.push(sil);
  });

  const scanRing = createScanRing();
  scene.add(scanRing);

  // Fondo con resplandor verde atmosférico idéntico al diseño (detrás de la retícula)
  const bgGlow = createHeroGlow();
  bgGlow.position.set(0, 1.4, -0.6);
  scene.add(bgGlow);

  // Retícula radar polar concéntrica del Hero, centrada detrás de su pecho.
  const reticle = createHeroReticle();
  reticle.position.set(0, 1.42, -0.15);
  scene.add(reticle);

  // Lluvia lenta de palabras de identidad detrás de ella: ESCUCHA · RECORRE · INTERVIENE
  const wordsRain = createWordsRain({ mobile: profile.mobile, reducedMotion: profile.reducedMotion });
  scene.add(wordsRain.group);

  // ---------- Profundidad ----------
  // Piso: retícula retro de perspectiva infinita (reacciona a cámara, cursor, scroll y bombo).
  const grid = createGrid({ mobile: profile.mobile, reducedMotion: profile.reducedMotion });
  scene.add(grid.mesh);
  // Portal JUEGA YA delante de ella (ella lo mira): misma escena, plano secuencia continuo.
  const portal = createPortal(scene, { channels, mobile: profile.mobile });
  // Pantalla monumental detrás de ella (Momento 1)
  const wall = createWall(scene, { mobile: profile.mobile, tri: profile.model === 'mobile' ? '20.584' : '61.752' });

  // Halo: un anillo verde plano detrás de la cabeza, siempre de frente a la cámara (se ubica en gl.js).
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.47, 96),
    new THREE.MeshBasicMaterial({ color: VERDE, fog: false, side: THREE.DoubleSide }),
  );
  halo.visible = false;
  scene.add(halo);

  // ---------- Estado ----------
  function setScan(y) {
    clipTex.constant = -y;
    clipSil.constant = y;
    scanRing.position.y = y;
    scanRing.visible = y > -0.02 && y < HEAD_TOP - 0.01;
    const silVisible = y > -0.02;
    for (const s of silhouettes) s.visible = silVisible;
  }
  setScan(HEAD_TOP);

  function setAspect(aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, key, ambient, portal, halo, wall, grid, reticle, bgGlow, wordsRain, figure, meshes, silhouetteMaterial, setScan, setAspect, HEAD_TOP };
}

function parseGLB(buffer) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((resolve, reject) => loader.parse(buffer, '/models/', resolve, reject));
}

// Anillo verde del escaneo + dos marcas de HUD a los lados.
function createScanRing() {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: VERDE, fog: false });
  const pts = [];
  const seg = 64;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.34));
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  const ticks = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.62, 0, 0), new THREE.Vector3(-0.9, 0, 0),
    new THREE.Vector3(0.62, 0, 0), new THREE.Vector3(0.9, 0, 0),
    new THREE.Vector3(0, 0, -0.42), new THREE.Vector3(0, 0, -0.62),
    new THREE.Vector3(0, 0, 0.42), new THREE.Vector3(0, 0, 0.62),
  ]);
  group.add(new THREE.LineSegments(ticks, mat));
  return group;
}

// Resplandor ambiental 3D en esquinas idéntico al diseño de referencia
function createHeroGlow() {
  const geom = new THREE.PlaneGeometry(16, 12);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        // Resplandor derecho suave que baña la atmósfera lateral
        float d1 = distance(vUv, vec2(0.96, 0.28));
        float g1 = smoothstep(0.55, 0.0, d1) * 0.28;
        // Resplandor inferior izquierdo bajo los pies de la figura
        float d2 = distance(vUv, vec2(0.06, 0.10));
        float g2 = smoothstep(0.46, 0.0, d2) * 0.26;
        vec3 col = vec3(0.58, 0.96, 0.04);
        gl_FragColor = vec4(col * (g1 + g2), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = -2;
  return mesh;
}

// Radar polar milimétrico del diseño: anillos concéntricos + radios que forman celdas
function createHeroReticle() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0xa8fe0b,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });

  const ringsGroup = new THREE.Group();
  const spokesGroup = new THREE.Group();
  group.add(ringsGroup);
  group.add(spokesGroup);

  const ringCount = 8;
  const minR = 0.26;
  const stepR = 0.058;
  const maxR = minR + (ringCount - 1) * stepR;

  // 1. Anillos concéntricos
  for (let ring = 0; ring < ringCount; ring++) {
    const radius = minR + ring * stepR;
    const points = [];
    const segs = 96;
    for (let i = 0; i <= segs; i++) {
      const angle = (i / segs) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    ringsGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  // 2. Líneas radiales / radios que cruzan los anillos formando la cuadrícula de radar
  const spokes = [];
  const spokeCount = 24; // cada 15 grados
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    spokes.push(
      new THREE.Vector3(Math.cos(angle) * minR, Math.sin(angle) * minR, 0),
      new THREE.Vector3(Math.cos(angle) * maxR, Math.sin(angle) * maxR, 0),
    );
  }

  // 3. Marcas de graduación exteriores
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    spokes.push(
      new THREE.Vector3(Math.cos(angle) * maxR, Math.sin(angle) * maxR, 0),
      new THREE.Vector3(Math.cos(angle) * (maxR + 0.04), Math.sin(angle) * (maxR + 0.04), 0),
    );
  }

  spokesGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), material));

  // Telemetría sonora viva: rotación hipnótica ultra-lenta + respiración y pulso con el audio
  group.update = function(dt, time, beat = 0) {
    spokesGroup.rotation.z += dt * 0.038;
    const pulse = 1 + beat * 0.035 + Math.sin(time * 1.6) * 0.012;
    ringsGroup.scale.set(pulse, pulse, 1);
  };

  return group;
}

// Lluvia lenta de palabras detrás de María Clara: ESCUCHA · RECORRE · INTERVIENE.
// Cada palabra es un plano con su textura (se dibuja una sola vez) que cae despacio en el espacio 3D, DETRÁS de
// ella: la profundidad la oculta tras su cuerpo, así que nunca tapa su rostro. Por cuadro solo cambian posición
// y opacidad (nada se vuelve a dibujar ni a subir a la GPU) y todo viaja en el mismo lienzo: cero capas nuevas.
//  · Ritmo: cada palabra tiene su propia duración de caída (≈ 26–46 s por pantalla; las lejanas, más lentas y
//    tenues), su retardo de entrada y una deriva lateral leve. Entran y salen con fundido: nada aparece de golpe.
//  · Composición adaptable: tamaño, calles y recorrido se calculan del encuadre real (layout), no de coordenadas
//    por resolución. En vertical, palabras anchas que asoman a ambos lados de ella; en horizontal, cuatro calles.
//  · Lectura: una palabra que pasa por detrás del texto o del botón del héroe se atenúa (setAvoid), y si dos
//    palabras se cruzan, la más lejana cede: no hay acumulación de brillo.
//  · Reposo: gl.js solo la actualiza en el Momento 1; el director detiene el bucle con la pestaña oculta o el
//    juego abierto. Con movimiento reducido queda como una composición fija.
function createWordsRain({ mobile = false, reducedMotion = false } = {}) {
  const group = new THREE.Group();
  group.renderOrder = -1;

  // Solo las tres palabras de identidad — nada más
  const WORDS = ['ESCUCHA', 'RECORRE', 'INTERVIENE'];
  const FONT = '800 80px "Space Grotesk", "Martian Mono", sans-serif';
  const PAD = 88; // margen de la textura: el resplandor se apaga antes del borde (sin franjas recortadas)
  const CELL = 58; // ancho reservado por letra: el lienzo no cambia de tamaño cuando llega la tipografía

  const textures = WORDS.map((text) => {
    const canvas = document.createElement('canvas');
    canvas.width = PAD * 2 + CELL * text.length;
    canvas.height = PAD * 2 + 80;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const t = { text, canvas, tex, ink: 0.8 };
    drawWord(t);
    return t;
  });
  function drawWord(t) {
    const { canvas, text } = t;
    const g = canvas.getContext('2d');
    const max = canvas.width - PAD * 2;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.font = FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 4;
    // halo lima amplio y suave → halo corto → núcleo claro (no blanco puro: es fondo, no titular)
    g.shadowColor = '#c2fe0b';
    g.shadowBlur = 34;
    g.fillStyle = 'rgba(194, 254, 11, 0.30)';
    g.fillText(text, cx, cy, max);
    g.shadowBlur = 12;
    g.fillStyle = 'rgba(194, 254, 11, 0.55)';
    g.fillText(text, cx, cy, max);
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(238, 255, 200, 0.92)';
    g.fillText(text, cx, cy, max);
    t.ink = Math.min(max, g.measureText(text).width) / canvas.width; // parte del lienzo que ocupa la tinta
    t.tex.needsUpdate = true;
  }
  // La tipografía puede llegar después de crear la escena: se redibuja una vez, con el mismo tamaño de lienzo.
  document.fonts?.load(FONT).then(() => textures.forEach(drawWord)).catch(() => {});

  const N = mobile ? 5 : 8; // menos palabras en celular
  const GOLD = 0.61803;
  const items = [];
  for (let i = 0; i < N; i++) {
    const t = textures[i % textures.length];
    const depth = (i * GOLD) % 1; // 0 = cerca de ella, 1 = lejos
    const mat = new THREE.MeshBasicMaterial({
      map: t.tex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, t.canvas.height / t.canvas.width), mat);
    mesh.position.z = -0.8 - depth * 1.9;
    group.add(mesh);
    items.push({
      mesh,
      mat,
      t,
      depth,
      base: 0.46 - depth * 0.2, // las lejanas, más tenues
      // segundos que tarda en cruzar la pantalla: las lejanas caen más despacio (paralaje)
      period: (26 + depth * 14) * (0.92 + Math.random() * 0.2),
      phase: (i / N + (Math.random() - 0.5) * 0.08 + 1) % 1, // repartidas en la caída desde el primer cuadro
      delay: 0.5 + i * 0.6 + Math.random() * 0.4, // entrada progresiva (s)
      sway: 0.14 + Math.random() * 0.16, // rad/s de la deriva lateral
      swayAt: Math.random() * Math.PI * 2,
      jitter: Math.random() - 0.5,
      size: Math.random(),
      k: 1, // atenuación suavizada (texto del héroe / cruce con otra palabra)
      rect: [0, 0, 0, 0],
      lane: 0, hw: 1, top: 0, travel: 1, h: 0.1,
    });
  }

  // Encuadre de referencia (primer plano del Momento 1): de ahí salen el tamaño, las calles y el recorrido.
  // key = [t, azimut, distancia, altura de cámara, altura de mira, …] (gl.js · M1)
  let laid = false;
  function layout({ aspect, fov, key }) {
    const tan = Math.tan((fov * Math.PI) / 360);
    const narrow = aspect < 0.9; // ventana vertical
    const lanes = narrow ? [-0.16, 0.16] : [-0.72, -0.3, 0.3, 0.72]; // centro de cada calle (fracción del medio ancho)
    // parte del ancho que ocupa ella (≈ 0,75 m con los brazos en jarra) en el plano de la figura
    const her = Math.min(1, 0.75 / (2 * tan * key[2] * aspect));
    items.forEach((it, i) => {
      const d = key[2] - it.mesh.position.z; // distancia cámara → plano de la palabra
      const hh = tan * d;
      const hw = hh * aspect;
      const cy = key[3] + (key[4] - key[3]) * (d / key[2]);
      it.lane = lanes[i % lanes.length];
      it.hw = hw;
      // ancho de la tinta como fracción del ancho visible: en vertical asoma a ambos lados de ella
      const outer = Math.abs(it.lane) > 0.5;
      const frac = narrow
        ? Math.min(0.86, Math.max(0.34, her + 0.04 + it.size * 0.16))
        : (outer ? 0.2 : 0.15) + it.size * 0.06;
      const w = (frac * 2 * hw) / it.t.ink;
      it.mesh.scale.setScalar(w);
      it.h = w * (it.t.canvas.height / it.t.canvas.width);
      it.top = cy + hh + it.h / 2;
      it.travel = hh * 2 + it.h;
    });
    laid = true;
  }

  // Zonas de texto del héroe en pantalla (0..1, y hacia abajo): detrás de ellas las palabras se atenúan.
  let avoid = [];
  function setAvoid(rects) { avoid = rects || []; }

  const v = new THREE.Vector3();
  const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
  const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  let age = 0;

  // fade: presencia global (se apaga con el giro de cámara hacia el portal); textFade: cuánto texto del héroe queda.
  function update(dt, time, beat = 0, camera = null, { fade = 1, textFade = 1 } = {}) {
    if (!laid) return;
    const still = reducedMotion;
    if (!still) age += dt;

    for (const it of items) {
      if (!still) it.phase = (it.phase + dt / it.period) % 1;
      const p = it.phase;
      const drift = still ? 0 : Math.sin(time * it.sway + it.swayAt) * 0.045;
      it.mesh.position.x = (it.lane + it.jitter * 0.1 + drift) * it.hw;
      it.mesh.position.y = it.top - p * it.travel;
      // rectángulo de la tinta en pantalla (para no pasar encendida por detrás del texto ni de otra palabra)
      if (camera) {
        const hx = (it.mesh.scale.x * it.t.ink) / 2;
        const hy = it.h * 0.16;
        v.set(it.mesh.position.x + group.position.x - hx, it.mesh.position.y + hy, it.mesh.position.z).project(camera);
        const x0 = (v.x + 1) / 2; const y0 = (1 - v.y) / 2;
        v.set(it.mesh.position.x + group.position.x + hx, it.mesh.position.y - hy, it.mesh.position.z).project(camera);
        it.rect[0] = x0; it.rect[1] = y0; it.rect[2] = (v.x + 1) / 2; it.rect[3] = (1 - v.y) / 2;
      }
    }

    for (const it of items) {
      let target = 1;
      if (camera) {
        const r = it.rect;
        const area = Math.max(1e-6, (r[2] - r[0]) * (r[3] - r[1]));
        // cuánto de la palabra cae sobre texto, o cuánto de un bloque pequeño (la miniatura) queda bajo la palabra
        let covered = 0;
        for (const a of avoid) {
          const o = overlap(r, a);
          covered = Math.max(covered + o / area, (0.5 * o) / Math.max(1e-6, (a[2] - a[0]) * (a[3] - a[1])));
        }
        target = 1 - 0.84 * smooth(covered / 0.18) * textFade;
        // cruce con otra palabra: la más lejana cede
        for (const other of items) {
          if (other === it || other.depth > it.depth) continue;
          if (overlap(r, other.rect) > 0) { target = Math.min(target, 0.15); break; }
        }
      }
      it.k = still ? target : it.k + (target - it.k) * (1 - Math.exp(-dt / 0.45));
      const p = it.phase;
      const envelope = smooth(p / 0.16) * (1 - smooth((p - 0.8) / 0.2)); // entra y sale con fundido
      const intro = still ? 1 : smooth((age - it.delay) / 2.4);
      it.mat.opacity = it.base * envelope * intro * it.k * fade * (1 + beat * 0.08);
      it.mesh.visible = it.mat.opacity > 0.004;
    }
  }

  // Solo para pruebas (?fps): estado de cada palabra y zonas que evita.
  const debug = () => ({
    avoid,
    words: items.map((it) => ({ text: it.t.text, phase: +it.phase.toFixed(4), opacity: +it.mat.opacity.toFixed(3), k: +it.k.toFixed(2), rect: it.rect.map((n) => +n.toFixed(3)), z: +it.mesh.position.z.toFixed(2) })),
  });

  return { group, update, layout, setAvoid, debug };
}
