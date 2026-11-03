/* ======================================================================
   FLAUXUS — atrium/atrium.js
   Atrio central: escaleras radiales, portales, huella y bloques orbitales.
   Toda la geometría provisional vive aquí; el NavMesh aporta las medidas.
   ====================================================================== */
import * as THREE from 'three';
import { ROOMS } from '../Rooms.js';
import { S, bumpAtriumGen, roomGen } from '../core/state.js';
import { LIME, LIMEH, SERIF, rand } from '../core/util.js';
import { QUALITY } from '../core/config.js';
import { world } from '../engine/renderer.js';
import { clearGroup, mat, glowSprite, makeTextSprite, makeDust, GLOW } from '../engine/materials.js';
import { onAtriumLoaded } from '../NavMesh.js';
import { placeFBX } from '../AssetManager.js';
import { drawMotif } from '../rooms/motif.js';

/* Calibración de la huella del atrio (antes vivía en NavMesh.js). */
export const HUELLA_CONFIG = {
  x: -1.3,        // Desplaza el parche hacia la derecha (+X) para centrarlo con la piedra
  z: 1.8,         // Desplaza el parche hacia adelante (+Z)
  radius: 4.4,    // Radio ajustado para quedar dentro de la ranura interior del borde
  radiusX: 4.4,
  radiusZ: 4.4,
  rotY: 0,
  orbit: 140,     // Margen de los 6 círculos con respecto al borde
  yOffset: 0.04
};

export const stairGroups = [], portalObjects = [];
export let huellaTex = null, huellaCv = null, huellaMesh = null;
export const STAIR_R0 = 7.2;
export let atriumFloor = null;

export function makeStair(i, r) {
  const g = new THREE.Group(), phase = i * .87, angle = -Math.PI / 2 + i * (Math.PI / 3), th = Math.atan2(-Math.cos(angle), -Math.sin(angle));
  g.position.set(Math.cos(angle) * STAIR_R0, 0, Math.sin(angle) * STAIR_R0); g.rotation.y = th;
  const steps = [];
  const mkStep = c => { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, .32, 1.0), new THREE.MeshStandardMaterial({ color: c, roughness: .95, metalness: .05, emissive: new THREE.Color(LIME), emissiveIntensity: 0, visible: false })); m.visible = false; return m };
  // 14 straight steps ascending along -Z: from z = 0, y = 1.35 to z = -6.8, y = 5.2
  for (let j = 0; j < 14; j++) {
    const t = j / 13;
    const st = mkStep(0x2c2d24);
    st.position.set(0, 1.35 + t * 3.85, -t * 6.8);
    g.add(st);
    steps.push(st);
  }
  const topX = 0, topY = 5.48, topZ = -7.15;
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, .35, 3.2), mat(0x454638, { roughness: .88 })); platform.position.set(topX, topY, topZ); platform.visible = false; g.add(platform);
  // Portal estilo Doctor Strange encajado exactamente en el arco de piedra
  const gateGroup = new THREE.Group();
  gateGroup.position.set(0, 5.2, -7.0);

  // Anillo base de energía brillante
  const gate = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.08, 16, 64),
    new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff7700,
      emissiveIntensity: 2.2,
      roughness: 0.2
    })
  );
  gateGroup.add(gate);

  // Chispas estilo portal sling-ring (densidad aumentada)
  const sparkCount = 140; // <-- Cambia este valor (ej. 100 - 200 para un efecto denso y fluido)
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let s = 0; s < sparkCount; s++) {
    const ang = (s / sparkCount) * Math.PI * 2;
    // Dispersión radial y en profundidad alrededor del aro
    const rad = 1.35 + (Math.random() - 0.5) * 0.45;
    sparkPos[s * 3] = Math.cos(ang) * rad;
    sparkPos[s * 3 + 1] = Math.sin(ang) * rad;
    sparkPos[s * 3 + 2] = (Math.random() - 0.5) * 0.25;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xffcc33,
    size: 0.16, // Tamaño individual de cada chispa
    map: GLOW,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  gateGroup.add(sparks);

  const halo = glowSprite(0xff8800, 4.8, 0.4);
  halo.position.set(0, 0, 0);
  gateGroup.add(halo);

  g.add(gateGroup);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 14, 16, 1, true), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.set(topX, topY + 7.5, topZ); g.add(beam);
  // Portal arch light for rich neon illumination on the sculptural stone arch
  const label = makeTextSprite(r.note, '#efeadb', 4.6, 44, true); label.position.set(topX, topY + 3.55, topZ); g.add(label);
  const sub = makeTextSprite(r.title, '#b3b09c', 5, 24, true); sub.position.set(topX, topY + 2.95, topZ); g.add(sub);
  const check = makeTextSprite('✓ completada', LIMEH, 4, 30, true); check.position.set(topX, topY + 4.35, topZ); check.visible = false; g.add(check);
  const cue = new THREE.Mesh(new THREE.TorusGeometry(.44, .035, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .36 })); cue.rotation.x = Math.PI / 2; cue.position.set(0, 1.4, .85); g.add(cue);
  g.userData = {
    roomId: r.id,
    phase,
    cs: Math.cos(th),
    sn: Math.sin(th),
    steps,
    gate,
    gateGroup,
    halo,
    beam,
    check,
    cue,
    labels: { note: label, sub },
    len: 6.8,
    gateDY: 1.3,
    R: 1.3
  };
  world.add(g); stairGroups.push(g); portalObjects.push(g);
}

/* ======================================================================
   BLOQUES FLOTANTES ORBITALES DEL ATRIO
   ====================================================================== */
export const floatingBlocks = [];
let blockMat = null;

// Función para extraer el material de piedra exacto del modelo FBX y aplicarlo a los bloques
function applyFbxMaterialToFloatingBlocks(fbxObj) {
  let stoneMat = null;
  fbxObj.traverse(child => {
    if (!stoneMat && child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        // Selecciona el material estándar opaco de la piedra del atrio
        if (m && !m.transparent && m.isMeshStandardMaterial && m.color && m.color.getHex() !== 0x000000) {
          stoneMat = m;
          break;
        }
      }
    }
  });

  if (stoneMat) {
    blockMat = stoneMat;
    for (let i = 0; i < floatingBlocks.length; i++) {
      floatingBlocks[i].material = stoneMat;
    }
  }
}

export function initFloatingBlocks(parent) {
  floatingBlocks.length = 0;
  // Color base de piedra travertino/caliza idéntico al del concept art mientras carga el FBX
  if (!blockMat) {
    blockMat = mat(0xc4bdae, { roughness: 0.85, metalness: 0.05 });
  }

  const count = 38; // Cantidad de losas flotantes orbitales
  for (let i = 0; i < count; i++) {
    // Dimensiones variadas de losas de piedra similares al render
    const w = rand(2.2, 3.8);
    const h = rand(0.24, 0.45);
    const d = rand(0.9, 1.4);
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, blockMat);
    mesh.castShadow = QUALITY.shadows;
    mesh.receiveShadow = QUALITY.shadows;

    // Distribución en dos bandas orbitales concéntricas fuera de la plataforma
    const orbitRadius = rand(25.5, 28.5);
    const baseAngle = (i / count) * Math.PI * 2 + rand(-0.12, 0.12);
    const baseY = rand(0.9, 4.2);        // Altura de flotación respecto al suelo
    const orbitSpeed = rand(0.025, 0.055) * (Math.random() < 0.15 ? -1 : 1); // Giro orbital suave
    const bobFreq = rand(0.7, 1.5);       // Ritmo de levitación vertical
    const bobAmp = rand(0.25, 0.55);      // Amplitud de subida y bajada
    const tiltAmp = rand(0.04, 0.08);     // Inclinación/balanceo sutil

    mesh.userData = {
      orbitRadius,
      baseAngle,
      baseY,
      orbitSpeed,
      bobFreq,
      bobAmp,
      tiltAmp,
      phase: rand(0, Math.PI * 2)
    };

    parent.add(mesh);
    floatingBlocks.push(mesh);
  }
}

export function updateFloatingBlocks(T) {
  for (let i = 0; i < floatingBlocks.length; i++) {
    const b = floatingBlocks[i];
    const u = b.userData;

    // 1. Giro orbital continuo alrededor del atrio
    const ang = u.baseAngle + T * u.orbitSpeed;
    const x = Math.cos(ang) * u.orbitRadius;
    const z = Math.sin(ang) * u.orbitRadius;

    // 2. Levitación vertical ondulante (arriba y abajo)
    const y = u.baseY + Math.sin(T * u.bobFreq + u.phase) * u.bobAmp;
    b.position.set(x, y, z);

    // 3. Orientación tangencial al círculo con cabeceo y alabeo suave
    b.rotation.y = -ang + Math.PI / 2;
    b.rotation.x = Math.sin(T * u.bobFreq * 0.7 + u.phase) * u.tiltAmp;
    b.rotation.z = Math.cos(T * u.bobFreq * 0.8 + u.phase) * u.tiltAmp;
  }
}

export function makeAtrium() {
  clearGroup(world); bumpAtriumGen(); stairGroups.length = 0; portalObjects.length = 0;
  /* Transparent floor for raycasting (click-to-walk) */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(29, 96), mat(0x1a1b14, { roughness: 1, transparent: true, opacity: 0 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; world.add(floor); atriumFloor = floor;
  /* Huella canvas placed right on top of central platform */
  huellaCv = document.createElement('canvas'); huellaCv.width = huellaCv.height = 512; huellaTex = new THREE.CanvasTexture(huellaCv); huellaTex.colorSpace = THREE.SRGBColorSpace;
  const hp = new THREE.Mesh(new THREE.CircleGeometry(5.2, 64), new THREE.MeshBasicMaterial({ map: huellaTex, transparent: true, depthWrite: false })); hp.rotation.x = -Math.PI / 2; hp.position.y = 1.36; world.add(hp); huellaMesh = hp;
  /* Straight radial collision stairs */
  for (let i = 0; i < 6; i++) makeStair(i, ROOMS[i]);
  /* Modelo FBX del atrio (las luces viven en el pool de LightingManager) */
  /* Modelo FBX del atrio: transfiere el material de piedra a los bloques al terminar de cargar */
  placeFBX('atrium', world, 28, { roughness: .85, metalness: .05 }, () => roomGen).then(obj => {
    if (obj) {
      onAtriumLoaded(obj);
      applyFbxMaterialToFloatingBlocks(obj);
    }
  });
  const stars = makeDust(400, 95, 60, 0xc9d6a0, .45); stars.position.y = -5; stars.frustumCulled = false; world.add(stars);
  initFloatingBlocks(world);
  paintHuella();
}

export function paintHuella() {
  if (!huellaCv) return;
  const x = huellaCv.getContext('2d'), c = 256;
  x.clearRect(0, 0, 512, 512);

  // Leer configuración de calibración
  const cfg = HUELLA_CONFIG;
  const orbitR = cfg.orbit || 140;
  const rotRad = (cfg.rotY || 0) * (Math.PI / 180);

  // 1. Fondo suave difuminado que se integra con la piedra
  const bgGrad = x.createRadialGradient(c, c, 40, c, c, 240);
  bgGrad.addColorStop(0, 'rgba(13, 14, 9, 0.55)');
  bgGrad.addColorStop(0.7, 'rgba(15, 17, 12, 0.30)');
  bgGrad.addColorStop(1, 'rgba(13, 14, 9, 0)');
  x.fillStyle = bgGrad;
  x.beginPath();
  x.arc(c, c, 240, 0, 6.283);
  x.fill();

  // 2. Línea orbital guía discontinua
  x.strokeStyle = 'rgba(201, 208, 0, 0.25)';
  x.lineWidth = 1.5;
  x.setLineDash([4, 6]);
  x.beginPath();
  x.arc(c, c, orbitR, 0, 6.283);
  x.stroke();
  x.setLineDash([]);

  // 3. Posicionamiento simétrico de los 6 círculos
  ROOMS.forEach((r, i) => {
    // Sincronizado con el ángulo radial de cada escalera en el atrio
    const a = -Math.PI / 2 + rotRad + i * (Math.PI / 3);
    const px = c + Math.cos(a) * orbitR;
    const py = c + Math.sin(a) * orbitR;
    const m = S.metrics[r.id];

    if (m && !m.skipped) {
      x.fillStyle = 'rgba(201, 208, 0, 0.18)';
      x.beginPath();
      x.arc(px, py, 34, 0, 6.283);
      x.fill();
      x.strokeStyle = LIMEH;
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py, 34, 0, 6.283);
      x.stroke();
      drawMotif(x, r.id, m, px, py, 30, LIMEH);
    } else {
      x.fillStyle = 'rgba(13, 14, 9, 0.6)';
      x.beginPath();
      x.arc(px, py, 28, 0, 6.283);
      x.fill();
      x.strokeStyle = 'rgba(239, 234, 219, 0.35)';
      x.lineWidth = 1.5;
      x.beginPath();
      x.arc(px, py, 28, 0, 6.283);
      x.stroke();

      x.fillStyle = 'rgba(239, 234, 219, 0.85)';
      x.font = `italic 700 20px ${SERIF}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(r.short, px, py);
    }
  });

  // 4. Núcleo central
  x.fillStyle = LIMEH;
  x.beginPath();
  x.arc(c, c, 16 + S.completed.size * 3, 0, 6.283);
  x.fill();

  huellaTex.needsUpdate = true;
}
window.paintHuella = paintHuella;
