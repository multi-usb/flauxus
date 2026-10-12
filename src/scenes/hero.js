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

  // Lluvia 3D de conceptos de identidad: ESCUCHA · RECORRE · INTERVIENE en el vacío espacial
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

// Lluvia 3D de conceptos de identidad: ESCUCHA · RECORRE · INTERVIENE en el vacío espacial
function createWordsRain({ mobile = false, reducedMotion = false } = {}) {
  const group = new THREE.Group();
  group.renderOrder = -1;

  // Solo las tres palabras de identidad — nada más
  const wordList = [
    { text: 'ESCUCHA', type: 'h' },
    { text: 'RECORRE', type: 'h' },
    { text: 'INTERVIENE', type: 'h' },
  ];

  const textureCache = new Map();
  function getTexture(item) {
    const key = `${item.text}_${item.type}`;
    if (textureCache.has(key)) return textureCache.get(key);

    // High-resolution canvas (2× font size) for crisp text at any zoom
    const fontSize = 80;
    const padding = 32;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (item.type === 'v') {
      const chars = item.text.split(' ');
      const charH = fontSize * 1.3;
      canvas.width = 160;
      canvas.height = Math.ceil(chars.length * charH + padding * 2);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `800 ${fontSize}px "Space Grotesk", "Martian Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Pass 1: wide outer lime halo
      ctx.shadowColor = '#c2fe0b';
      ctx.shadowBlur = 42;
      ctx.fillStyle = 'rgba(194, 254, 11, 0.45)';
      chars.forEach((c, idx) => ctx.fillText(c, 80, padding + idx * charH + charH * 0.5));

      // Pass 2: focused mid glow
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(194, 254, 11, 0.78)';
      chars.forEach((c, idx) => ctx.fillText(c, 80, padding + idx * charH + charH * 0.5));

      // Pass 3: crisp white core
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#ffffff';
      chars.forEach((c, idx) => ctx.fillText(c, 80, padding + idx * charH + charH * 0.5));

    } else {
      canvas.height = 128;
      ctx.font = `800 ${fontSize}px "Space Grotesk", "Martian Mono", monospace`;
      const w = ctx.measureText(item.text).width;
      canvas.width = Math.ceil(w + padding * 2);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `800 ${fontSize}px "Space Grotesk", "Martian Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const cy = 64;

      // Pass 1: wide outer lime halo
      ctx.shadowColor = '#c2fe0b';
      ctx.shadowBlur = 50;
      ctx.fillStyle = 'rgba(194, 254, 11, 0.40)';
      ctx.fillText(item.text, padding, cy);

      // Pass 2: focused mid glow
      ctx.shadowBlur = 24;
      ctx.fillStyle = 'rgba(194, 254, 11, 0.82)';
      ctx.fillText(item.text, padding, cy);

      // Pass 3: crisp white core
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(item.text, padding, cy);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    // 2× canvas → divide by 260 to keep same 3D world size
    const res = { tex, w: canvas.width / 260, h: canvas.height / 260 };
    textureCache.set(key, res);
    return res;
  }

  const items = [];
  // Sistema de calles: 3 calles verticales, palabras escalonadas dentro de cada calle
  // para que NUNCA coincidan ni en X ni en Y.
  const laneCount = mobile ? 2 : 3;
  const perLane   = Math.ceil(9 / laneCount); // máximo filas por calle
  const xSpan     = mobile ? 2.6 : 3.4;
  const ySpan     = 6.0; // rango total de caída
  const yStep     = ySpan / 3; // separación entre palabras de la misma calle (≥ 2 u)

  for (let i = 0; i < (mobile ? 6 : 9); i++) {
    const itemData = wordList[i % wordList.length];
    const { tex, w, h } = getTexture(itemData);

    const baseOpacity = 0.38 + Math.random() * 0.42;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: baseOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    const geom = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geom, mat);

    // Asignar calle fija (determinista) y escalonar Y dentro de ella
    const lane    = i % laneCount;
    const rowInLane = Math.floor(i / laneCount);
    const laneX   = -xSpan / 2 + (lane + 0.5) * (xSpan / laneCount);
    const jitter  = (Math.random() - 0.5) * 0.18; // micro-variación para no verse rígido
    const x       = laneX + jitter;
    const y       = -1.0 + rowInLane * yStep + Math.random() * 0.4;
    const z       = -0.5 - Math.random() * 1.8;

    mesh.position.set(x, y, z);
    group.add(mesh);

    items.push({
      mesh,
      mat,
      baseOpacity,
      lane,
      laneX,       // X base de la calle — se mantiene en respawn
      speed: 0.14 + Math.random() * 0.18, // velocidad más uniforme
      swaySpeed: 0.4 + Math.random() * 0.6,
      swayOffset: Math.random() * Math.PI * 2,
      initX: x,
    });
  }

  function update(dt, time, beat = 0) {
    if (reducedMotion) return;
    const beatMultiplier = 1 + beat * 0.75;

    for (const it of items) {
      it.mesh.position.y -= it.speed * dt * beatMultiplier;
      // Sway muy sutil para no salirse de la calle
      it.mesh.position.x = it.laneX + Math.sin(time * it.swaySpeed + it.swayOffset) * 0.06;
      it.mat.opacity = Math.min(0.95, it.baseOpacity * (1 + beat * 0.4));

      if (it.mesh.position.y < -1.8) {
        // Vuelve a aparecer arriba en su misma calle.
        // Busca la Y más alta de su calle para asegurarse de dejar distancia.
        let topY = 4.2;
        for (const other of items) {
          if (other !== it && other.lane === it.lane) {
            if (other.mesh.position.y > topY) topY = other.mesh.position.y;
          }
        }
        it.mesh.position.y = topY + yStep + Math.random() * 0.5;
        it.initX = it.laneX + (Math.random() - 0.5) * 0.18;
        it.mesh.position.x = it.initX;
      }
    }
  }

  return { group, update };
}
