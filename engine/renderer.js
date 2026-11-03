/* ======================================================================
   FLAUXUS — engine/renderer.js
   Escena, cámara, renderer, IBL, bloom y las tres luces base del pool.
   Es el único módulo que crea el contexto WebGL.
   ====================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TOUCH, LIME } from '../core/util.js';
import { QUALITY, SHADOW_R } from '../core/config.js';
import { GX } from '../GameContext.js';

// Tono cálido sepia / umber oscuro extraído directamente del concept art (01_Vista_principal.jpg)
export const BGC = 0x241a14;
export const scene = new THREE.Scene();
export const BG = new THREE.Color(BGC), BGT = new THREE.Color(BGC);
scene.background = BG; scene.fog = new THREE.FogExp2(BGC, .011); scene.fog.color = BG;
export const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 300);
export const renderer = new THREE.WebGLRenderer({ antialias: !TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.0 : 1.5)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.sortObjects = true; // transparencias de los FBX ordenadas correctamente (con pocos objetos cuesta ~0)
try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); scene.environmentIntensity = .5 } catch (e) { console.warn('IBL no disponible', e) }
document.body.insertBefore(renderer.domElement, document.body.firstChild);
export let composer = null, bloom = null;
if (!TOUCH) (async () => {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'), import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
    const c = new EffectComposer(renderer); c.setPixelRatio(renderer.getPixelRatio()); c.setSize(innerWidth, innerHeight);
    c.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .38, .5, .82); c.addPass(bloom); c.addPass(new OutputPass()); composer = c;
    GX.bloom = bloom; // el composer se crea en diferido: GX debe ver el bloom real
  } catch (err) { console.warn('Bloom no disponible, render directo', err) }
})();

export const hemi = new THREE.HemisphereLight(0xe8e4d8, 0x24261c, .7); scene.add(hemi);
export const key = new THREE.DirectionalLight(0xfff4dc, 1.35); key.position.set(12, 24, 8); scene.add(key); scene.add(key.target);
if (QUALITY.shadows) { key.castShadow = true; key.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap); const sc = key.shadow.camera; sc.near = 1; sc.far = 80; sc.left = -SHADOW_R; sc.right = SHADOW_R; sc.top = SHADOW_R; sc.bottom = -SHADOW_R; key.shadow.bias = -.0004; key.shadow.normalBias = .04 }
export const rimL = new THREE.PointLight(LIME, 17.6, 50); rimL.position.set(0, 10, 0); scene.add(rimL);
export const world = new THREE.Group(); scene.add(world);
export const roomGroup = new THREE.Group(); scene.add(roomGroup); roomGroup.visible = false;
