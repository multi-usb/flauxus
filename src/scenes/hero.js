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

  const camera = new THREE.PerspectiveCamera(profile.mobile ? 46 : 34, 1, 0.1, 90);

  // Luz: una clave dura fija en el mundo, delante-arriba-izquierda de ella. Como la cámara gira y la luz no,
  // el recorrido pasa solo de contraluz (espalda) a luz lateral (perfil) a luz frontal (frente).
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-1.6, 3.2, 4.2);
  scene.add(ambient, key);

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
      // Textura sin mipmaps, magnificación con píxel duro (manual §04).
      map.generateMipmaps = false;
      map.minFilter = THREE.LinearFilter;
      map.magFilter = THREE.NearestFilter;
      map.anisotropy = 1;
      map.needsUpdate = true;
    }
    // Sin PBR: color difuso con Lambert.
    o.material = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, clippingPlanes: [clipTex] });
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

  return { scene, camera, key, ambient, portal, halo, wall, grid, meshes, silhouetteMaterial, setScan, setAspect, HEAD_TOP };
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
