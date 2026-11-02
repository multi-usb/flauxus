/* ======================================================================
   FLAUXUS — Main.js (Entry Point)
   Inicialización de Three.js, bucle de renderizado (requestAnimationFrame),
   gestor de estados (S), controles del jugador y orquestación del museo.
   ====================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AssetManager, assetManager, loadFBX, fitFBX, prepareFBXMaterials, placeFBX } from './AssetManager.js';
import {
  A, trackFiles, recUrl, Rec, ensureAudio, audioLevel, impulse, newBus, killBus,
  setMuted, noise, tone, hiss, pluck, pad, startAmbient, sting, recMeta, loadRec,
  recDur, recOk, REGIONS, regionFor, splitRegion, recPeaks, wfImg, revBuf, fmt,
  Voice, stopClips, playClip
} from './AudioSystem.js';
import {
  NAV, SPAWN, navY, setNavY, placeAtSpawn, navIdx, navCX, navCZ, navBand, navFree,
  navHeadFree, navHard, navSoft, navFloor, navHas, navNeighbors, navNode,
  navRoute, navLos, navPath, navYield, navBuild, navAnalyze, navApply, navRampY,
  onAtriumLoaded, navVizUpdate, navInit, navPick
} from './NavMesh.js';
import { DO, RE, MI, FA, SOL, LA, IMPL, roomsInit, roomsUpdate } from './Rooms.js';
import { GX } from './GameContext.js';


/* ======================================================================
   FLAUXUS v6.3 — un solo HTML.
   REEMPLAZO FUTURO DE GEOMETRÍA: toda geometría nativa de three.js vive en funciones
   marcadas "PLACEHOLDER GEO" (avatar(), makeStair(), makeAtrium(), build() de cada sala).
   Contrato para los modelos low poly: el avatar debe exponer userData.{body,armL,armR,legL,legR,joints{wl,wr,head},glowMat,flute}.
   ====================================================================== */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t };
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);
document.body.classList.toggle('touch', TOUCH);
const V3 = THREE.Vector3;
const LIME = 0xc9d000, LIMEH = '#c9d000', PAPER = '#efeadb', INKH = '#0d0e09', PALE = 0x8f8c7c;
const FONT = "'Instrument Sans','Segoe UI',system-ui,sans-serif", SERIF = "'Fraunces',Georgia,serif";
const EXPERIMENT = { miToFa: true }; // el fraseo de MI mueve ligeramente el tempo de FA (PENDIENTE DE VALIDACIÓN)
const qs = new URLSearchParams(location.search);
const ALIAS = { direct: 'direct', directa: 'direct', redes: 'direct', fanzine: 'fanzine', zine: 'fanzine', poster: 'poster', afiche: 'poster', cards: 'cards', baraja: 'cards', cartas: 'cards' };
const entry = ALIAS[(qs.get('entry') || (qs.get('cards') ? 'cards' : 'direct')).toLowerCase()] || 'direct';
/* Los tres satélites físicos son PUERTAS al mismo sistema: cada una cambia lo que el usuario PUEDE HACER (guía de satélites):
   fanzine → Skin Cyborg · afiche → Cincel de Deconstrucción · baraja → Intención. Se reconocen con ?entry=fanzine|poster|cards
   (la baraja además lleva sus cartas: ?entry=cards&cards=PAUSA,RETARDA,MI INTENCIÓN). */
const ENTRIES = {
  direct: { label: 'Entrada directa', tag: 'Directa', skill: null, blurb: '' },
  fanzine: { label: 'Entrada · fanzine', tag: 'Fanzine', skill: 'Skin Cyborg', blurb: 'Llegaste desde el fanzine: tu avatar es la versión cuerpo + tecnología. Sus dispositivos laten con el sonido y con tu movimiento.' },
  poster: { label: 'Entrada · afiche', tag: 'Afiche', skill: 'Cincel de Deconstrucción', blurb: 'Llegaste desde el afiche: en MataЯ al padre podrás intervenir los fragmentos de la partitura con el cincel.' },
  cards: { label: 'Entrada · baraja', tag: 'Baraja', skill: 'Intención', blurb: 'Llegaste desde la baraja: las cartas que decidiste se vuelven decisiones de fraseo en el Momento 3.' }
};
const entryLabel = ENTRIES[entry].label;
// Cartas de la baraja → variables del sistema (semántica PROVISIONAL, pendiente de validar con Anna y María Clara)
const CARDS = {
  PAUSA: { n: 'PAUSA', d: 'Una respiración extra tras la frase.' },
  ACELERA: { n: 'ACELERA', d: 'La frase corre.' },
  RETARDA: { n: 'RETARDA', d: 'La frase se arrastra.' },
  REPITE: { n: 'REPITE', d: 'La frase vuelve, más tenue.' },
  SILENCIA: { n: 'SILENCIA', d: 'La frase calla; su tiempo queda vacío.' },
  DESVIA: { n: 'DESVÍA', d: 'La frase arranca desde adentro y regresa a su inicio.' },
  INSISTE: { n: 'INSISTE', d: 'El final de la frase insiste.' },
  INTENCION: { n: 'MI INTENCIÓN', d: 'Tú decides la regla para esa frase.', wild: true }
};
const OPLIST = ['PAUSA', 'ACELERA', 'RETARDA', 'REPITE', 'SILENCIA', 'DESVIA', 'INSISTE'];
const normCard = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
const CARD_ALIAS = { PAUSA: 'PAUSA', ACELERA: 'ACELERA', RETARDA: 'RETARDA', REPITE: 'REPITE', SILENCIA: 'SILENCIA', DESVIA: 'DESVIA', INSISTE: 'INSISTE', INTENCION: 'INTENCION', MIINTENCION: 'INTENCION' };
const HAND = entry === 'cards' ? (() => { const r = (qs.get('cards') || '').split(/[,;|]/).map(normCard).map(x => CARD_ALIAS[x]).filter(Boolean).slice(0, 4); return r.length ? r : ['PAUSA', 'RETARDA', 'INTENCION'] })() : [];
// el sistema acumula las entradas ya descubiertas (solo registro: cada puerta sigue entregando su posibilidad al entrar por ella)
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } } };
const seen = new Set(LS.get('flauxus.entries.v1', []));
$('entryLabel').textContent = ENTRIES[entry].skill || entryLabel; $('entryLabel').classList.toggle('skill', !!ENTRIES[entry].skill);
$('introEntry').textContent = (ENTRIES[entry].skill ? entryLabel + ' · ' + ENTRIES[entry].skill : entryLabel) + ' · mejor con audífonos';
const DEV_ENTRY_PICKER = true; // herramienta de prueba del prototipo: poner en false para publicar
if (DEV_ENTRY_PICKER) $('devPick').innerHTML = '<span>Simular entrada:</span>' + Object.keys(ENTRIES).map(k => `<a href="?entry=${k}${k === 'cards' ? '&cards=PAUSA,RETARDA,MI%20INTENCI%C3%93N' : ''}" class="${k === entry ? 'on' : ''}">${ENTRIES[k].tag}</a>`).join(''); else $('devPick').remove();

/* ---------------- salas ---------------- */
const rooms = [
  {
    id: 1, note: 'DO4', short: 'DO', title: 'El sonido bello', desc: 'Control del aire: encuentra un sonido y sostén su claridad.', source: 'CPEBMov1.wav', audio: 'real', color: LIME, hex: LIMEH, avatar: 'disciplined',
    goal: 'El sonido empieza velado, como detrás de una pared. Sopla y mantén la luz dentro del campo: se abre y se aclara. Llena el círculo.',
    ctl: [[['Mouse'], ['Dedo'], 'Sigue la luz que se mueve'], [['Clic', 'Espacio'], ['Mantén'], 'Mantén para soplar (con el dedo: mantenlo sobre la luz)']]
  },
  {
    id: 2, note: 'RE4', short: 'RE', title: 'El pulso', desc: 'Marca el pulso, escucha el click y desplázate fuera de la rejilla.', source: 'sonido provisional', audio: 'pending', color: LIME, hex: LIMEH, avatar: 'disciplined',
    goal: 'Toca cuando cada nota cruce el círculo. Al principio caen sobre la rejilla; después se salen: sigue el click, no las marcas. 12 golpes.',
    ctl: [[['Espacio', 'D', 'Clic'], ['Toca'], 'Tocar el pulso']]
  },
  {
    id: 3, note: 'MI4', short: 'MI', title: 'El fraseo', desc: 'Decide dónde respira la música. La pausa es una decisión, no un botón.', source: 'Sarabanda ornamentada.wav', audio: 'real', color: LIME, hex: LIMEH, avatar: 'disciplined',
    goal: 'La grabación se parte en cuatro frases. Entre una y otra hay una respiración: tú decides cuánto dura. Arrastra cada punto hacia arriba para alargarla, escucha y confirma.',
    ctl: [[['Arrastrar ↕'], ['Arrastrar ↕'], 'Duración de cada pausa'], [['▶ Original'], ['▶ Original'], 'Cómo suena sin tus decisiones']]
  },
  {
    id: 4, note: 'FA♯4', short: 'FA♯', title: 'El cuerpo', desc: 'Tocar ocupando espacio: el movimiento modifica la música y deja memoria.', source: 'Stockhausen.wav', audio: 'real', color: LIME, hex: LIMEH, avatar: 'body',
    goal: 'La grabación suena todo el rato y tu posición la transforma. Quédate dentro de cada campo hasta que se encienda: cada uno añade una capa. Tu recorrido queda inscrito.',
    ctl: [[['W', 'A', 'S', 'D'], ['Círculo'], 'Mover el cuerpo'], [['Clic'], ['Toca'], 'Ir a un punto del suelo']]
  },
  {
    id: 5, note: 'SOL♯4', short: 'SOL♯', title: 'El unicornio cyborg', desc: 'Cuerpo, sensor y máquina: captura los tres puntos y haz reaccionar el espacio.', source: 'sonido procedural · sin grabación', audio: 'none', color: LIME, hex: LIMEH, avatar: 'cyborg',
    goal: 'Tres sensores flotan alrededor del cuerpo. Mantén el cursor (o el dedo) sobre cada uno hasta que el anillo se llene y se conecte.',
    ctl: [[['Mouse'], ['Dedo'], 'Seguir y mantener sobre el sensor']]
  },
  {
    id: 6, note: 'LA♯4', short: 'LA♯', title: 'MataЯ al padre', desc: 'La partitura deja de ser página cerrada: extrae, interviene y reensambla.', source: 'CPE Bach Intervención.wav', audio: 'real', color: LIME, hex: LIMEH, avatar: 'cyborg',
    goal: 'La grabación se corta en fragmentos reales. Toca uno para oírlo, arrástralos al pentagrama para componer otra secuencia, escúchala y entrégala.',
    ctl: [[['Clic = oír'], ['Toca = oír'], 'Escuchar un fragmento'], [['Arrastrar'], ['Arrastrar'], 'Fragmento → pentagrama']]
  }
];
const S = { phase: 'intro', room: 0, completed: new Set(), metrics: {}, mod: new Set(), sessionStart: 0, playStart: 0, moved: 0, nearby: 0, busy: false, coach: 0, ready: true, rfNote: false };
if (entry === 'fanzine') S.mod.add('cyborg');
if (entry === 'poster') S.mod.add('chisel');
if (entry === 'cards') S.mod.add('intention');
S.heard = new Set();
const skinKind = id => S.mod.has('cyborg') ? 'cyborg' : (id ? rooms[id - 1].avatar : 'disciplined'); // Skin Cyborg del fanzine: atrio y las seis salas
const nextRoomId = () => { for (const r of rooms) if (!S.completed.has(r.id)) return r.id; return 0 };
let T = 0;

/* ---------------- calidad (presupuesto de rendimiento) ----------------
   alta: escritorio · baja: táctil (o ?q=low para probarla en escritorio). El nº de luces es fijo por nivel. */
const LOWQ = TOUCH || qs.get('q') === 'low';
const QUALITY = LOWQ ? { tier: 'low', shadows: false, shadowMap: 0, pts: 1, spot: false, tex: 1024, aniso: 2, merge: qs.has('merge') }
  : { tier: 'high', shadows: true, shadowMap: 1024, pts: 2, spot: true, tex: 2048, aniso: 8, merge: qs.has('merge') };
const SHADOW_R = 9; // radio (m) del frustum de sombra alrededor del avatar
/* ---------------- renderer ---------------- */
// Tono cálido sepia / umber oscuro extraído directamente del concept art (01_Vista_principal.jpg)
const BGC = 0x241a14;
const scene = new THREE.Scene();
const BG = new THREE.Color(BGC), BGT = new THREE.Color(BGC);
scene.background = BG; scene.fog = new THREE.FogExp2(BGC, .011); scene.fog.color = BG;
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: !TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.0 : 1.5)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.sortObjects = true; // transparencias de los FBX ordenadas correctamente (con pocos objetos cuesta ~0)
try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); scene.environmentIntensity = .5 } catch (e) { console.warn('IBL no disponible', e) }
document.body.insertBefore(renderer.domElement, document.body.firstChild);
let composer = null, bloom = null;
if (!TOUCH) (async () => {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'), import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
    const c = new EffectComposer(renderer); c.setPixelRatio(renderer.getPixelRatio()); c.setSize(innerWidth, innerHeight);
    c.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .38, .5, .82); c.addPass(bloom); c.addPass(new OutputPass()); composer = c;
  } catch (err) { console.warn('Bloom no disponible, render directo', err) }
})();

const hemi = new THREE.HemisphereLight(0xe8e4d8, 0x24261c, .7); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff4dc, 1.35); key.position.set(12, 24, 8); scene.add(key); scene.add(key.target);
if (QUALITY.shadows) { key.castShadow = true; key.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap); const sc = key.shadow.camera; sc.near = 1; sc.far = 80; sc.left = -SHADOW_R; sc.right = SHADOW_R; sc.top = SHADOW_R; sc.bottom = -SHADOW_R; key.shadow.bias = -.0004; key.shadow.normalBias = .04 }
const rimL = new THREE.PointLight(LIME, 17.6, 50); rimL.position.set(0, 10, 0); scene.add(rimL);
const world = new THREE.Group(); scene.add(world);
const roomGroup = new THREE.Group(); scene.add(roomGroup); roomGroup.visible = false;

/* ======================================================================
   ASSET + LIGHTING MANAGERS (v6.4 · iluminación con presupuesto)
   Principios de rendimiento:
   · Número de luces CONSTANTE en todas las escenas (pool fijo): cambiar de sala no recompila shaders.
   · IBL (RoomEnvironment prefiltrado una sola vez) hace el trabajo de relleno: cuesta ~0 por frame.
   · Una sola luz con sombra, de frustum pequeño que sigue al avatar (sombra nítida, 1 pasada barata). En móvil: sombra "blob".
   · Los FBX se cachean, se les fusiona la geometría estática por material y zona (menos draw calls) y se reutilizan
     materiales/texturas entre visitas (antes se recreaban y re-subían a GPU en cada entrada).
   ====================================================================== */

export let roomGen = 0, atriumGen = 0;
/* ---- presets de luz por escenario ----
   Unidades físicas (three r155+): intensidad = e · r² con decay 2, donde `e` ≈ iluminancia a `r` metros de la luz.
   Así e≈1 es "se nota claramente" a esa distancia. (Antes las puntuales valían 2–3 a 5–12 m: casi no iluminaban.)
   Afinar en vivo con ?light (panel) y copiar el JSON de vuelta aquí. */
const LIGHT_PRESETS = {
  atrium: {
    // Fondo, niebla y luz ambiental cálida coordinados con el concept art
    bg: 0x241a14, fog: .011, exp: .92, env: .32, hemi: [0xf0e6d6, 0x2e1e16, .45], key: { c: 0xffeed8, i: 1.15, p: [12, 24, 8] }, rim: { c: LIME, base: 2.2, k: 8 }, bloomT: .85,
    pts: [{ gate: 1, c: LIME, e: 1.0, r: 3, p: [0, 3, 0] }, { c: 0xfff0d4, e: 1.1, r: 8, p: [0, 9, 0] }], spot: { c: 0xfffaec, e: 1.5, r: 24, p: [0, 24, 0], t: [0, 1.4, 0], ang: .7, pen: .6 }
  },
  1: {
    bg: 0x0e100b, fog: .020, exp: 1.05, env: .32, hemi: [0xf0e8d0, 0x2a281c, .38], key: { c: 0xffe8c0, i: 1.2, p: [8, 18, 10] }, rim: { c: LIME, base: 2, k: 8 }, bloomT: .85,
    pts: [{ c: 0xffe8c0, e: 1.2, r: 5, p: [0, 5, -2] }, { c: LIME, e: .9, r: 5, p: [-3, 3, 4] }], spot: { c: 0xfff6e0, e: 1.3, r: 12, p: [0, 12, 0], t: [0, 0, 0], ang: .62, pen: .5 }
  },
  2: {
    bg: 0x100d0a, fog: .022, exp: 1.0, env: .28, hemi: [0xffe0c0, 0x241a12, .3], key: { c: 0xffd9b0, i: 1.0, p: [6, 16, 9] }, rim: { c: LIME, base: 2.2, k: 8 }, bloomT: .82,
    pts: [{ c: 0xff9944, e: 1.3, r: 5, p: [5, 4, -3] }, { c: LIME, e: 1.0, r: 5, p: [-5, 3, 2] }], spot: { c: 0xffeedd, e: 1.3, r: 14, p: [0, 14, 3], t: [0, 0, 0], ang: .78, pen: .6 }
  },
  3: {
    bg: 0x0f110c, fog: .020, exp: 1.05, env: .32, hemi: [0xf4f0dc, 0x262a1c, .4], key: { c: 0xfff0d4, i: 1.1, p: [6, 14, 10] }, rim: { c: LIME, base: 2, k: 8 }, bloomT: .85,
    pts: [{ c: 0xfff0d4, e: 1.1, r: 5, p: [3, 5, -3] }, { c: 0xd4e8a0, e: .9, r: 5, p: [-4, 3, 2] }], spot: { c: 0xfff8e8, e: 1.2, r: 10, p: [0, 10, 4], t: [0, 0, -2], ang: 1.0, pen: .7 }
  },
  4: {
    bg: 0x0d0f0e, fog: .020, exp: 1.0, env: .28, hemi: [0xdfe8e4, 0x1c241e, .32], key: { c: 0xfff4dc, i: 1.0, p: [8, 18, 10] }, rim: { c: LIME, base: 2, k: 8 }, bloomT: .85,
    pts: [{ c: 0xff6633, e: 1.2, r: 5, p: [5, 5, -3] }, { c: 0x33ccff, e: 1.1, r: 5, p: [-5, 4, 4] }], spot: { c: 0xfff4dc, e: 1.2, r: 18, p: [0, 18, 5], t: [0, 0, 0], ang: 1.0, pen: .5 }
  },
  5: {
    bg: 0x0b0d10, fog: .024, exp: 1.0, env: .25, hemi: [0xdde4f0, 0x1a1e26, .3], key: { c: 0xe8f0ff, i: .8, p: [8, 16, 8] }, rim: { c: LIME, base: 2, k: 8 }, bloomT: .8,
    pts: [{ c: LIME, e: 2.0, r: 3.2, p: [0, 3.2, -3] }, { c: 0xaaccff, e: 1.0, r: 5, p: [4, 5, 2] }], spot: { c: 0xfffaec, e: 1.2, r: 14, p: [0, 14, 2], t: [0, 1.5, 0], ang: .9, pen: .5 }
  },
  6: {
    bg: 0x100c0c, fog: .024, exp: .95, env: .25, hemi: [0xf0e0d8, 0x241818, .3], key: { c: 0xffe4d4, i: .9, p: [8, 18, 10] }, rim: { c: LIME, base: 2, k: 8 }, bloomT: .82,
    pts: [{ c: 0xff4422, e: 1.3, r: 6, p: [6, 5, -4] }, { c: 0x8844ff, e: 1.0, r: 6, p: [0, 3, -6] }], spot: { c: 0xffeedd, e: 1.3, r: 16, p: [0, 16, 0], t: [0, 0, -2], ang: .8, pen: .4 }
  }
};
const _gp = new V3(), _c0 = new V3(0, 3, 0);
class LightingManager {
  constructor() {
    this.id = 'atrium'; this.P = LIGHT_PRESETS.atrium; this.keyOff = new V3(12, 24, 8); this.rimK = 8; this.onApply = null;
    this.avatarLight = new THREE.PointLight(0xfff5e6, 2.4, 12, 2); scene.add(this.avatarLight);
    this.pts = []; for (let i = 0; i < QUALITY.pts; i++) { const l = new THREE.PointLight(0xffffff, 0, 0, 2); scene.add(l); this.pts.push(l) }
    this.spot = null; if (QUALITY.spot) { this.spot = new THREE.SpotLight(0xffffff, 0, 0, .7, .5, 2); scene.add(this.spot); scene.add(this.spot.target) }
    this.blob = null;
    if (!QUALITY.shadows) { // sombra "blob" barata para móvil
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      this.blob = new THREE.Mesh(new THREE.CircleGeometry(.8, 24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1; scene.add(this.blob);
    }
    this.configure();
  }
  setMode(mode, roomId = 0) { this.apply(mode === 'atrium' ? 'atrium' : roomId) }
  apply(id) { this.id = id; this.P = LIGHT_PRESETS[id] || LIGHT_PRESETS.atrium; this.configure(); this.onApply?.() }
  configure() {
    const P = this.P;
    BGT.setHex(P.bg); scene.fog.density = P.fog; renderer.toneMappingExposure = P.exp; scene.environmentIntensity = P.env;
    hemi.color.setHex(P.hemi[0]); hemi.groundColor.setHex(P.hemi[1]); hemi.intensity = P.hemi[2];
    key.color.setHex(P.key.c); key.intensity = P.key.i; this.keyOff.set(P.key.p[0], P.key.p[1], P.key.p[2]);
    rimL.color.setHex(P.rim.c); this.rimK = P.rim.k; rimL.intensity = P.rim.base * P.rim.k;
    this.pts.forEach((l, i) => { const c = P.pts[i]; if (!c) { l.intensity = 0; return } l.color.setHex(c.c); l.position.set(c.p[0], c.p[1], c.p[2]); l.intensity = c.e * c.r * c.r });
    if (this.spot) { const s = P.spot; this.spot.color.setHex(s.c); this.spot.intensity = s.e * s.r * s.r; this.spot.angle = s.ang; this.spot.penumbra = s.pen; this.spot.position.set(s.p[0], s.p[1], s.p[2]); this.spot.target.position.set(s.t[0], s.t[1], s.t[2]) }
  }
  update(pos, dt, isAtrium) {
    this.avatarLight.position.set(pos.x, pos.y + 1.9, pos.z + .35);
    if (QUALITY.shadows) { // el frustum de sombra sigue al avatar, "pegado" a la rejilla de texeles para que no tiemble
      const ts = SHADOW_R * 2 / QUALITY.shadowMap, sx = Math.round(pos.x / ts) * ts, sz = Math.round(pos.z / ts) * ts;
      key.target.position.set(sx, pos.y, sz); key.position.set(sx + this.keyOff.x, pos.y + this.keyOff.y, sz + this.keyOff.z);
    } else key.position.copy(this.keyOff);
    if (this.blob) this.blob.position.set(pos.x, pos.y + .04, pos.z);
    if (bloom) bloom.threshold = this.P.bloomT;
  }
  /* En el atrio UNA luz acompaña a la escalera que late (antes: 6 puntuales fijas, una por escalera). */
  gate(groups, t, T) {
    const c = this.P.pts[0]; if (!c || !c.gate || !this.pts[0]) return; const l = this.pts[0], base = c.e * c.r * c.r, g = t && groups[t - 1];
    if (g) { g.userData.gate.getWorldPosition(_gp); l.position.lerp(_gp, .1); l.intensity = base * (1 + .3 * Math.sin(T * 3.5)) } else { l.position.lerp(_c0, .05); l.intensity = base * .6 }
  }
}
const lightingManager = new LightingManager();
const addRoomLight = () => { }, clearRoomLights = () => { };
const rimSet = v => { rimL.intensity = v * lightingManager.rimK };

function clearGroup(g) { while (g.children.length) { const o = g.children.pop(); o.traverse?.(x => { if (x.geometry && !x.geometry.userData.keep) x.geometry.dispose(); if (x.material) { (Array.isArray(x.material) ? x.material : [x.material]).forEach(m => { if (m.userData.keep) return; if (m.map && m.map !== GLOW) m.map.dispose?.(); m.dispose() }) } }) } }
function mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .05, ...o }) }
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
const GLOW = glowTex();
function glowSprite(color, scale, op = .8) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(scale, scale, 1); return s }
function makeTextSprite(text, color = '#fff', scale = 5, size = 34, italic = false) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.font = `${italic ? 'italic ' : ''}700 ${size}px Georgia,serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = Math.max(4, size * .2); x.strokeStyle = 'rgba(8,9,5,.88)'; x.strokeText(text, 256, 64); x.fillStyle = color; x.fillText(text, 256, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(scale, scale * .25, 1); return s }
function makeDust(n, r, h, color, size = .1) { const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * r; pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = Math.random() * h; pos[i * 3 + 2] = Math.sin(a) * rr } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending, map: GLOW })) }

/* ======================================================================
   AUDIO — las grabaciones de María Clara son el protagonista.
   Modo "buffer" (servidor http/https): fetch + decodeAudioData → filtro, reverb, pan, capas.
   Modo "elemento" (file://): <audio> con volumen/tempo; los cortes y capas siguen funcionando.
   Lo sintético queda sólo como feedback mínimo (y como sustituto si falta un .wav).
   ====================================================================== */
/* ======================================================================
   FX 2D
   ====================================================================== */
const cv = $('g2d'), ctx = cv.getContext('2d'); let W = innerWidth, H = innerHeight, DPR = 1;
function resize2d() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px' } resize2d();
const FXP = [], FXR = [], FXT = []; let shakeAmt = 0;
function burst(x, y, c = LIMEH, n = 20, spd = 260, life = .7, size = 3) { if (REDUCE) n = Math.ceil(n / 3); n = Math.min(n, 40); const cap = 120; if (FXP.length > cap) FXP.splice(0, FXP.length - cap); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = spd * (.25 + Math.random() * .75); FXP.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: life * (.6 + Math.random() * .6), m: life, c, s: size * (.6 + Math.random() * .8) }) } }
function ringFx(x, y, c = '#fff', r0 = 12, r1 = 110, life = .55, w = 2) { FXR.push({ x, y, c, r0, r1, l: life, m: life, w }) }
function ftext(x, y, t, c = '#fff', size = 20) { FXT.push({ x, y, t, c, l: .95, m: .95, size }) }
function shake(a) { shakeAmt = Math.max(shakeAmt, REDUCE ? a * .25 : a) }
function fxUpdate(dt) {
  for (let i = FXP.length - 1; i >= 0; i--) { const p = FXP[i]; p.l -= dt; if (p.l <= 0) { FXP.splice(i, 1); continue } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; p.vy = p.vy * .95 + 30 * dt }
  for (let i = FXR.length - 1; i >= 0; i--) { FXR[i].l -= dt; if (FXR[i].l <= 0) FXR.splice(i, 1) } for (let i = FXT.length - 1; i >= 0; i--) { const t = FXT[i]; t.l -= dt; t.y -= 38 * dt; if (t.l <= 0) FXT.splice(i, 1) }
}
function fxDraw() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of FXP) { const a = clamp(p.l / p.m, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.4 + a * .6), 0, 6.283); ctx.fill() }
  for (const r of FXR) { const k = 1 - r.l / r.m; ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.c; ctx.lineWidth = r.w * (1 - k) + .5; ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, 1 - Math.pow(1 - k, 3)), 0, 6.283); ctx.stroke() } ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (const t of FXT) { const a = clamp(t.l / t.m, 0, 1); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = t.c; ctx.font = `italic 700 ${t.size * (1 + (1 - a) * .15)}px ${SERIF}`; ctx.fillText(t.t, t.x, t.y) } ctx.globalAlpha = 1
}
function bolt(x1, y1, x2, y2, col, seg = 12, amp = 14) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [lw, al] of [[6, .18], [2, .9]]) { ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); for (let i = 1; i < seg; i++) { const t = i / seg, nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1, j = (Math.random() - .5) * amp * Math.sin(t * Math.PI); ctx.lineTo(lerp(x1, x2, t) + nx / l * j, lerp(y1, y2, t) + ny / l * j) } ctx.lineTo(x2, y2); ctx.stroke() } ctx.restore() }
function glowCircle(x, y, r, rgba0, rgba1 = 'rgba(0,0,0,0)') { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba0); g.addColorStop(1, rgba1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill() }
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H } }

/* ---------------- HUD ---------------- */
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2300) }
function setRoomInfo(k, t, d) { $('roomKicker').textContent = k; $('roomTitle').textContent = t; $('roomDesc').textContent = d }
function hint(t) { $('roomHint').textContent = t || '' }
function renderProgress() {
  const t = nextRoomId();
  $('progress').innerHTML = rooms.map(r => `<div class="pip${S.completed.has(r.id) ? ' done' : ''}${r.id === t && S.phase === 'atrium' ? ' next' : ''}${S.room === r.id ? ' cur' : ''}" data-room="${r.id}" title="${r.title}"><b>${S.completed.has(r.id) ? '✓' : r.short}</b></div>`).join('');
  $('objective').textContent = t ? `Ahora: ${rooms[t - 1].note} · ${rooms[t - 1].title}` : 'Las seis salas están completas';
}
$('progress').onclick = e => {
  const p = e.target.closest('.pip');
  if (!p || S.phase !== 'atrium') return;
  const id = parseInt(p.dataset.room, 10);
  if (id && stairGroups[id - 1]) walkTo({ g: stairGroups[id - 1], enter: true });
};
function fade(fn) { const f = $('flash'); f.classList.add('on'); setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')) }, 270) }
function titleCard(r) { const c = $('titleCard'); $('tcNote').textContent = r.note; $('tcTitle').textContent = r.title; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show') }
const ctlRow = (r) => r.ctl.map(c => `<div class="ctl"><span class="keys">${(TOUCH ? c[1] : c[0]).map(k => TOUCH ? `<span class="tchip">${k}</span>` : `<kbd>${k}</kbd>`).join('')}</span><span>${c[2]}</span></div>`).join('');

/* ======================================================================
   AVATAR — PLACEHOLDER GEO (se reemplaza por modelo low poly)
   ====================================================================== */
function avatar(kind) {
  const g = new THREE.Group(), cy = kind === 'cyborg';
  const bodyMat = mat(cy ? 0x1f2119 : 0x2b2c23, { roughness: .9, metalness: cy ? .45 : .05 });
  const skinMat = mat(cy ? 0xe6e3d6 : 0xcfcab8, { roughness: .85, metalness: cy ? .2 : 0 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xf4f7cf, emissive: LIME, emissiveIntensity: cy ? 1.5 : .0, roughness: .3, metalness: .5 });
  const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o };
  const body = new THREE.Group(); g.add(body);
  const torso = M(new THREE.CapsuleGeometry(.44, .85, 4, 12), bodyMat, 0, 1.25, 0); if (kind === 'body') torso.scale.set(1.04, .95, 1.08); body.add(torso);
  body.add(M(new THREE.SphereGeometry(.34, 16, 12), skinMat, 0, 2.28, 0));
  const mkLimb = (x, y, r, len, off) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(M(new THREE.CapsuleGeometry(r, len, 4, 8), bodyMat, 0, off, 0)); g.add(p); return p };
  const armL = mkLimb(-.56, 1.85, .12, .75, -.5), armR = mkLimb(.56, 1.85, .12, .75, -.5), legL = mkLimb(-.22, 1.1, .14, .92, -.5), legR = mkLimb(.22, 1.1, .14, .92, -.5);
  const wl = new THREE.Object3D(); wl.position.set(0, -.95, 0); armL.add(wl); const wr = new THREE.Object3D(); wr.position.set(0, -.95, 0); armR.add(wr);
  const head = new THREE.Object3D(); head.position.set(0, 2.45, 0); g.add(head);
  const flute = M(new THREE.CylinderGeometry(.04, .04, 1.65, 12), mat(0xc9c9c0, { metalness: .9, roughness: .22 }), .28, 1.62, .3); flute.rotation.z = Math.PI / 2 + .12; g.add(flute);
  if (cy) { for (const x of [-.57, .57]) g.add(M(new THREE.BoxGeometry(.2, .2, .2), glowMat, x, 1.85, 0)); g.add(M(new THREE.ConeGeometry(.13, .42, 8), glowMat, 0, 2.8, 0)); const ring = M(new THREE.TorusGeometry(.5, .03, 8, 30), glowMat, 0, 1.25, 0); ring.rotation.x = Math.PI / 2; g.add(ring); head.position.y = 2.78 }
  g.userData = { body, armL, armR, legL, legR, joints: { wl, wr, head }, glowMat, flute, cy }; return g
}
let avatarObj = avatar('disciplined'); scene.add(avatarObj);
function setAvatar(kind) { scene.remove(avatarObj); avatarObj = avatar(kind); scene.add(avatarObj) }
// El avatar respira con el audio real (A.lvl) cuando toca
function animAvatar(av, sp, t, play = false, air = 0) {
  const u = av.userData, k = clamp(sp / 6, 0, 1.5), w = t * 9, br = A.lvl;
  if (u.cy) u.glowMat.emissiveIntensity = 1.1 + br * 2.6 + clamp(sp / 6, 0, 1) * .8; // Skin Cyborg: los dispositivos laten con el sonido y con el cuerpo
  u.legL.rotation.x = Math.sin(w) * .75 * k; u.legR.rotation.x = -Math.sin(w) * .75 * k;
  const sw = Math.sin(w) * .55 * k;
  if (play) { u.armL.rotation.x = -1.05 + Math.sin(t * 1.7) * .04; u.armR.rotation.x = -1.15 + Math.sin(t * 1.7 + 1) * .04; u.armL.rotation.z = .5; u.armR.rotation.z = -.5; u.body.rotation.z = Math.sin(t * 1.3) * .03 * (1 + air); u.body.scale.set(1 + br * .05, 1 + br * .035, 1 + br * .05); u.flute.rotation.x = -br * .12 }
  else { u.armL.rotation.x = -sw; u.armR.rotation.x = sw; u.armL.rotation.z = -.15; u.armR.rotation.z = .15; u.body.rotation.z = 0; u.body.scale.set(1, 1, 1) }
  u.body.position.y = Math.abs(Math.sin(w)) * .09 * k + Math.sin(t * 1.6) * .015
}

/* ======================================================================
   ATRIO — FBX model + functional overlays (stairs, portals, huella).
   The FBX provides visual scenery; invisible collider geometry from the
   original makeStair() is kept so walking/collision/portal detection
   still works exactly as before.
   ====================================================================== */
/* ======================================================================
   OOP ARCHITECTURE — GROUND CONTROLLER (3D SURFACE CONTACT)
   ====================================================================== */
class GroundController {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.down = new THREE.Vector3(0, -1, 0);
    this.origin = new THREE.Vector3();
    this.raycaster.far = 12.0;
    this._frame = 0;
    this._lastY = 0;
    this.memo = new Map();
  }
  reset() { this.memo.clear() }
  /* el suelo de las salas se consulta solo contra el FBX (antes contra todo roomGroup: incluía sprites y fallaba sin cámara) */
  roomObj = null;
  /* caché por celda de 0.25 m: el raycast contra el FBX se hace UNA vez por celda recorrida, no cada 2 frames */
  memoGet(x, z, y) { return this.memo.get(((Math.round(x * 4) + 2048) * 4096 + Math.round(z * 4) + 2048) * 256 + Math.round(y * 2) + 64) }
  memoSet(x, z, y, v) { if (this.memo.size > 20000) this.memo.clear(); this.memo.set(((Math.round(x * 4) + 2048) * 4096 + Math.round(z * 4) + 2048) * 256 + Math.round(y * 2) + 64, v); return v }
  getHeight(x, z, currentY, isAtrium) {
    // Throttle: only re-cast every 2 frames; return cached value on alternate frames
    this._frame = (this._frame + 1) & 1;
    if (this._frame === 1) return this._lastY;
    this.origin.set(x, currentY + 1.8, z);
    this.raycaster.set(this.origin, this.down);
    if (isAtrium) {
      const sa = surfaceAt(x, z, currentY);
      if (sa && !sa.blocked) { this._lastY = sa.y; return sa.y; }
      if (x * x + z * z < 28) { this._lastY = 2.42; return 2.42; }
      if (atriumFBXObj) {
        const mc = this.memoGet(x, z, currentY); if (mc !== undefined) { this._lastY = mc; return mc }
        const hits = this.raycaster.intersectObject(atriumFBXObj, true);
        let bestY = -Infinity;
        for (const h of hits) {
          if (h.point.y <= currentY + 0.65 && h.point.y > bestY) {
            bestY = h.point.y;
          }
        }
        if (bestY > -100) { this._lastY = this.memoSet(x, z, currentY, bestY); return bestY; }
      }
      const fy = (x * x + z * z < 28) ? 2.42 : 1.10;
      this._lastY = fy; return fy;
    } else {
      if (this.roomObj) {
        const mc = this.memoGet(x, z, currentY); if (mc !== undefined) { this._lastY = mc; return mc }
        const hits = this.raycaster.intersectObject(this.roomObj, true);
        let bestY = -Infinity;
        for (const h of hits) {
          if (h.object.isMesh && h.object.visible && !h.object.material?.transparent) {
            if (h.point.y <= currentY + 0.65 && h.point.y > bestY) {
              bestY = h.point.y;
            }
          }
        }
        if (bestY > -100) { this._lastY = this.memoSet(x, z, currentY, bestY); return bestY; }
      }
      this._lastY = 0.0;
      return 0.0;
    }
  }
}
const groundController = new GroundController();
GX._set({ renderer, camera, scene, roomGroup, groundController });

/* ======================================================================
   NAV · colisión, altura de suelo y rutas DERIVADAS DEL MODELO FBX (no de constantes a mano)
   Al cargar el atrio se rasterizan sus triángulos a una rejilla de 0,25 m:
     · capas caminables por celda (superficies que miran hacia arriba, hasta 4)
     · ocupación vertical (qué alturas están ocupadas) → altura libre sobre la cabeza y muros
   Con eso: suelo/escalones reales, muros que no se atraviesan, caída desde el dais, A* en 2,5D y
   detección automática del dais, las 6 escaleras y los arcos (anillos) donde va cada portal.
   Si el modelo cambia, el atrio se reajusta solo. Sin FBX (o si falla) se usa la lógica nativa anterior.
====================================================================== */

/* ======================================================================
   ATRIO — FBX MODEL + STRAIGHT RADIAL ARCHITECTURE (matching real FBX)
   ====================================================================== */
const stairGroups = [], portalObjects = []; let huellaTex = null, huellaCv = null, huellaMesh = null;
const STAIR_R0 = 7.2;
let atriumFBXObj = null;
function makeStair(i, r) {
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
let atriumFloor = null;

/* ======================================================================
   BLOQUES FLOTANTES ORBITALES DEL ATRIO
   ====================================================================== */
const floatingBlocks = [];
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

function initFloatingBlocks(parent) {
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

function updateFloatingBlocks(T) {
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

function makeAtrium() {
  clearGroup(world); atriumGen++; stairGroups.length = 0; portalObjects.length = 0;
  /* Transparent floor for raycasting (click-to-walk) */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(29, 96), mat(0x1a1b14, { roughness: 1, transparent: true, opacity: 0 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; world.add(floor); atriumFloor = floor;
  /* Huella canvas placed right on top of central platform */
  huellaCv = document.createElement('canvas'); huellaCv.width = huellaCv.height = 512; huellaTex = new THREE.CanvasTexture(huellaCv); huellaTex.colorSpace = THREE.SRGBColorSpace;
  const hp = new THREE.Mesh(new THREE.CircleGeometry(5.2, 64), new THREE.MeshBasicMaterial({ map: huellaTex, transparent: true, depthWrite: false })); hp.rotation.x = -Math.PI / 2; hp.position.y = 1.36; world.add(hp); huellaMesh = hp;
  /* Straight radial collision stairs */
  for (let i = 0; i < 6; i++) makeStair(i, rooms[i]);
  /* Modelo FBX del atrio (las luces viven en el pool de LightingManager) */
  /* Modelo FBX del atrio: transfiere el material de piedra a los bloques al terminar de cargar */
  placeFBX('atrium', world, 28, { roughness: .85, metalness: .05 }, () => atriumGen).then(obj => {
    if (obj) {
      onAtriumLoaded(obj);
      applyFbxMaterialToFloatingBlocks(obj);
    }
  });
  const stars = makeDust(400, 95, 60, 0xc9d6a0, .45); stars.position.y = -5; stars.frustumCulled = false; world.add(stars);
  initFloatingBlocks(world);
  paintHuella();
}
// Motivo reutilizado por el epílogo y por la huella del Atrio (una sola función)
function drawMotif(x, id, m, cx, cy, s, color) {
  x.save(); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = Math.max(2, s * .05); x.lineCap = 'round';
  if (!m || m.skipped) { x.globalAlpha = .3; x.strokeRect(cx - s * .6, cy - s * .4, s * 1.2, s * .8); x.restore(); return }
  switch (id) {
    case 1: for (let i = 1; i <= 4; i++) { x.globalAlpha = .95 / i; x.beginPath(); x.arc(cx, cy, s * .2 * i + Math.min(s * .1, (m.air || 0) * .6), 0, 6.283); x.stroke() } break;
    case 2: { const n = Math.min(24, (m.hits || 0) + (m.miss || 0)); for (let i = 0; i < n; i++) { const ok = i < (m.hits || 0); x.globalAlpha = ok ? 1 : .35; x.beginPath(); x.arc(cx - s * .9 + i * (s * 1.8 / Math.max(1, n - 1)), cy + (ok ? 0 : s * .22), s * (ok && i < (m.perfect || 0) ? .09 : .05), 0, 6.283); x.fill() } break }
    case 3: (m.vals || []).forEach((v, i) => { x.fillRect(cx - s * .8 + i * s * .45, cy + s * .4 - v * s * .9, s * .28, v * s * .9 + 2) }); break;
    case 4: { const pa = m.path || []; if (pa.length > 1) { x.beginPath(); pa.forEach((q, i) => { const px = cx + q[0] / 9.2 * s, py = cy + q[1] / 9.2 * s; if (i) x.lineTo(px, py); else x.moveTo(px, py) }); x.stroke() } break }
    case 5: { const o = m.order || [0, 1, 2], P = [[cx - s * .7, cy + s * .5], [cx + s * .7, cy + s * .5], [cx, cy - s * .7]]; x.beginPath(); o.forEach((k, i) => { if (i) x.lineTo(P[k][0], P[k][1]); else x.moveTo(P[k][0], P[k][1]) }); x.stroke(); P.forEach(q => { x.beginPath(); x.arc(q[0], q[1], s * .1, 0, 6.283); x.fill() }); break }
    case 6: (m.slots || []).forEach((sl, i) => { x.globalAlpha = .45 + sl * .1; x.fillRect(cx - s * .8 + i * s * .45, cy - s * .4 - sl * s * .06, s * .3, s * .8 + sl * s * .06) }); x.globalAlpha = 1; if (m.cuts) { x.strokeStyle = PAPER; x.beginPath(); x.moveTo(cx - s, cy + s * .6); x.lineTo(cx + s, cy - s * .6); x.stroke() } break
  }
  x.restore()
}
function paintHuella() {
  if (!huellaCv) return;
  const x = huellaCv.getContext('2d'), c = 256;
  x.clearRect(0, 0, 512, 512);

  // Leer configuración de calibración
  const cfg = (typeof HUELLA_CONFIG !== 'undefined') ? HUELLA_CONFIG : { orbit: 140, rotY: 0 };
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
  rooms.forEach((r, i) => {
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
makeAtrium();
const GN = 22, guide = new THREE.InstancedMesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: LIME }), GN); guide.frustumCulled = false; world.add(guide);
const dummy = new THREE.Object3D();

/* ======================================================================
   CÁMARA + MOVIMIENTO (tercera persona, sin arrastrar el mouse)
   · La cámara sigue al avatar y se reorienta sola hacia donde caminas.
   · W/S avanzar·retroceder, A/D girar·desplazar, Shift correr. ←/→ ajustan la cámara.
   · Clic/toque en el suelo: el avatar camina solo. «Ir a la siguiente sala» (C) lo lleva hasta el portal.
   · Táctil: joystick izquierdo + botón ⟳ para girar la vista (opcional). Nunca hay que arrastrar la cámara.
   ====================================================================== */
const rig = { yaw: Math.PI, pitch: -.12, dist: 5.6, height: 2.5, look: 2.8, hold: 0 }; // hold: segundos sin auto-orientar tras mover la cámara a mano
const keys = new Set(), player = new V3(0, 7.5, 2.5), vel = new V3(), fwd = new V3(), rgt = new V3();
let stepPh = 0, heading = Math.PI;
// Físicas de salto y caída
let velY = 0, isGrounded = false;
const GRAVITY = 26.0, JUMP_FORCE = 8.8;
function setAtriumFBXObj(obj) { atriumFBXObj = obj; }
function resetPlayerPhysics() { vel.set(0, 0, 0); velY = 0; isGrounded = false; }
const joy = { x: 0, y: 0, id: null, cx: 0, cy: 0, R: 52 };
function joyMove(e) { let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const l = Math.hypot(dx, dy); if (l > joy.R) { dx *= joy.R / l; dy *= joy.R / l } $('joyKnob').style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; joy.x = dx / joy.R; joy.y = -dy / joy.R }
const joyEl = $('joy');
joyEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); const r = joyEl.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyMove(e) });
joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e) });
const joyEnd = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joyKnob').style.transform = 'translate(-50%,-50%)' } };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
function moveInput() {
  let ix = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), iy = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  ix = clamp(ix + joy.x, -1, 1); iy = clamp(iy + joy.y, -1, 1); const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l } return { ix, iy }
}
/* ---------- Suelo, colisión y rutas: todo en el espacio FIJO de cada escalera (sin deriva) ---------- */
const STEP = .9;
function stairLocal(g, x, z) { const u = g.userData, dx = x - g.position.x, dz = z - g.position.z; return { x: dx * u.cs - dz * u.sn, z: dx * u.sn + dz * u.cs } }
function stairWorld(g, lx, lz) { const u = g.userData; return { x: g.position.x + lx * u.cs + lz * u.sn, z: g.position.z - lx * u.sn + lz * u.cs } }
function stairSurface(l) {
  // Rampa extendida y ancha para que no tropiece con los bordes de los escalones
  if (Math.abs(l.x) < 2.6 && l.z <= 1.4 && l.z >= -8.5) {
    const t = clamp((1.0 - l.z) / 7.8, 0, 1);
    return { y: 1.35 + t * 4.05, solid: true };
  }
  return null;
}
function surfaceAt(x, z, py) {
  let best = null, bd = Infinity;
  for (const g of stairGroups) {
    const s = stairSurface(stairLocal(g, x, z)); if (!s) continue;
    const y = s.y + g.position.y * clamp((s.y - 1.35) / 4, 0, 1), d = Math.abs(y - py);
    // Permite subir la rampa sin interrupciones
    if (s.solid && y - py > 1.8 && py < 1.0) return { blocked: true };
    if (d <= STEP && d < bd) { bd = d; best = { y, g } }
  }
  return best;
}
const GC = .5, GM = 112, GO = -28; let GRID = null;
function groundBlocked(x, z) {
  if (x * x + z * z > 720) return true;
  for (const g of stairGroups) {
    const l = stairLocal(g, x, z);
    if (Math.abs(l.x) < 2.0 && l.z < .85 && l.z > -7.8) return true;
  }
  return false;
}
function buildGrid() { GRID = new Uint8Array(GM * GM); for (let j = 0; j < GM; j++)for (let i = 0; i < GM; i++)GRID[j * GM + i] = groundBlocked(GO + (i + .5) * GC, GO + (j + .5) * GC) ? 1 : 0 }
const gi = v => Math.floor((v - GO) / GC);
function losClear(a, b) { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25)); for (let k = 0; k <= n; k++) { const t = k / n; if (groundBlocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false } return true }
function groundPath(a, b) { // A* sobre rejilla de 0,5 m + suavizado por línea de vista
  if (!GRID) buildGrid();
  if (losClear(a, b)) return [{ x: b.x, z: b.z }];
  const sI = clamp(gi(a.x), 0, GM - 1), sJ = clamp(gi(a.z), 0, GM - 1); let tI = clamp(gi(b.x), 0, GM - 1), tJ = clamp(gi(b.z), 0, GM - 1);
  if (GRID[tJ * GM + tI]) { let f = null; for (let r = 1; r < 8 && !f; r++)for (let dj = -r; dj <= r && !f; dj++)for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const ii = tI + di, jj = tJ + dj; if (ii >= 0 && jj >= 0 && ii < GM && jj < GM && !GRID[jj * GM + ii]) { f = [ii, jj]; break } } if (!f) return null; tI = f[0]; tJ = f[1] }
  const N = GM * GM, gs = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
  const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top[1] };
  const h = (i, j) => Math.hypot(i - tI, j - tJ), s0 = sJ * GM + sI, t0 = tJ * GM + tI; gs[s0] = 0; push(s0, h(sI, sJ)); let found = false;
  while (heap.length) {
    const k = pop(); if (closed[k]) continue; closed[k] = 1; if (k === t0) { found = true; break }
    const ki = k % GM, kj = (k / GM) | 0;
    for (let dj = -1; dj <= 1; dj++)for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = ki + di, nj = kj + dj; if (ni < 0 || nj < 0 || ni >= GM || nj >= GM) continue; const nk = nj * GM + ni; if (GRID[nk] || closed[nk]) continue;
      if (di && dj && (GRID[kj * GM + ni] || GRID[nj * GM + ki])) continue;
      const ng = gs[k] + (di && dj ? 1.414 : 1); if (ng < gs[nk]) { gs[nk] = ng; came[nk] = k; push(nk, ng + h(ni, nj)) }
    }
  }
  if (!found) return null;
  const raw = []; for (let k = t0; k !== -1; k = came[k])raw.push({ x: GO + (k % GM + .5) * GC, z: GO + (((k / GM) | 0) + .5) * GC }); raw.reverse();
  const out = []; let anchor = { x: a.x, z: a.z }, idx = 0;
  while (idx < raw.length) { let far = idx; for (let q = raw.length - 1; q > idx; q--) { if (losClear(anchor, raw[q])) { far = q; break } } out.push(raw[far]); anchor = raw[far]; idx = far + 1 }
  if (!groundBlocked(b.x, b.z)) out[out.length - 1] = { x: b.x, z: b.z };
  return out
}
const stairUp = (g, l) => {
  const w = [];
  if (l.z > .4) w.push(stairWorld(g, 0, .4));
  if (l.z > -3.4) w.push(stairWorld(g, 0, -3.4));
  w.push(stairWorld(g, 0, -6.8));
  return w;
};
const stairDown = (g, l) => {
  const w = [];
  if (l.z < -3.4) w.push(stairWorld(g, 0, -3.4));
  w.push(stairWorld(g, 0, 1.6));
  return w;
};
/* Piloto automático: lo usan «clic para ir», «Ir a la siguiente sala» y la auto-subida */
let auto = null, lookHold = false, navStuck = 0;
function startAuto(pts, o = {}) { if (!pts || !pts.length) return false; auto = { pts, i: 0, t: 0, stuck: 0, back: 0, dx: 0, dz: 0, ride: !!o.ride, enter: o.enter || 0, mark: o.mark || null }; return true }
function stopAuto() { auto = null }
function walkTo(dest) { // dest: {g} → hasta la plataforma de esa escalera · {x,z} → punto del suelo
  if (NAV.ready) { const from = { x: player.x, z: player.z, y: navY }, tg = dest.g ? dest.g.userData.top : dest, pts = navPath(from, tg); if (!pts) return false; const last = pts[pts.length - 1]; return startAuto(pts, { enter: dest.enter && dest.g ? dest.g.userData.roomId : 0, mark: { x: last.x, y: last.y + .08, z: last.z } }) }
  const here = surfaceAt(player.x, player.z, player.y), onStair = player.y > .8 && here && here.g; let pts = [], from = { x: player.x, z: player.z };
  const topMark = g => { const q = stairWorld(g, 0, -6.8); return { x: q.x, y: g.position.y + 5.2, z: q.z } };
  if (onStair) {
    const l = stairLocal(here.g, player.x, player.z);
    if (dest.g === here.g) return startAuto(stairUp(here.g, l), { mark: topMark(here.g) });
    pts = stairDown(here.g, l); from = pts[pts.length - 1]
  }
  const tgt = dest.g ? stairWorld(dest.g, 0, 1.6) : { x: dest.x, z: dest.z };
  const gp = groundPath(from, tgt); if (!gp) return false; pts = pts.concat(gp);
  if (dest.g) pts = pts.concat(stairUp(dest.g, { x: 0, z: 1.6 }));
  return startAuto(pts, { mark: dest.g ? topMark(dest.g) : { x: gp[gp.length - 1].x, y: .08, z: gp[gp.length - 1].z } })
}
function walkNext() { if (S.phase !== 'atrium') return; const t = nextRoomId(); if (!t || S.nearby === t) return; if (!walkTo({ g: stairGroups[t - 1], enter: true })) toast('No encuentro el camino · camina con el círculo o WASD') }
function gateWorld(g, out = new V3()) { return g.userData.gate.getWorldPosition(out) }
const _pq = new V3();
// Cache nearestPortal result to avoid 6 getWorldPosition calls per frame
let _nearestPortalFrame = -1, _nearestPortalCache = 0;
function nearestPortal() {
  if (_nearestPortalFrame === T) return _nearestPortalCache;
  _nearestPortalFrame = T;
  let best = 0, bd = Infinity;
  for (const g of portalObjects) { const q = gateWorld(g, _pq); const d = Math.hypot(player.x - q.x, player.z - q.z), dy = Math.abs(player.y - (q.y - (g.userData.gateDY ?? 1.3))); if (d < bd && dy < (g.userData.measured ? 1.5 : 2.8)) { bd = d; best = g.userData.roomId } }
  _nearestPortalCache = bd < (NAV.ready && NAV.info?.ok ? 4.2 : 5.0) ? best : 0;
  return _nearestPortalCache;
}
/* ---- estado auxiliar del atrio: DOM cacheado, cámara con colisión, guía sin asignaciones, auto-entrada ---- */
const DOM = { arrow: $('cmpArrow'), lbl: $('cmpLabel'), mk: document.querySelector('#compass .mk') };
const setTxt = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s } };
let camK = 1, camDt = .016, pendEnter = null, guideHidden = false, gpn = 0;
const GPMAX = 512, gpx = new Float32Array(GPMAX), gpy = new Float32Array(GPMAX), gpz = new Float32Array(GPMAX), gcum = new Float32Array(GPMAX);
let viewY = 0, camY = 0; // alturas SUAVIZADAS (avatar / cámara): subir escalones se ve como rampa, no como golpes
function updateCam() {
  fwd.set(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)); const tg = new V3(player.x, camY + 1.2, player.z); const look = new V3(tg.x + fwd.x * rig.look, tg.y + Math.sin(rig.pitch) * 3.1, tg.z + fwd.z * rig.look);
  /* la cámara no atraviesa arcos ni escaleras: se acorta el brazo según la ocupación del NavMesh (8 muestras) */
  const cy = camY + rig.height + rig.pitch * 1.4, ty = camY + 1.2; let k = 1;
  if (NAV.ready && S.phase === 'atrium') {
    for (let s = 1; s <= 8; s++) {
      const f = s / 8, yy = lerp(ty, cy, f), c = navIdx(player.x - fwd.x * rig.dist * f, player.z - fwd.z * rig.dist * f);
      if (c >= 0 && !navFree(NAV.occ, c, yy - .15, yy + .15)) { k = Math.max(.3, (s - 1) / 8); break }
    }
  }
  camK = damp(camK, k, k < camK ? 14 : 2.5, camDt);
  camera.position.set(player.x - fwd.x * rig.dist * camK, lerp(ty, cy, camK), player.z - fwd.z * rig.dist * camK); camera.lookAt(look)
}
let guideT = 0, guideFor = 0, guidePts = null, guideLen = 0, guideCum = [], guideRoute = null; const guideFrom = { x: 1e9, z: 1e9 };
function refreshGuide(g, tid) { // ruta real (NavMesh o A* nativo) hacia la escalera; se pide poco y se mide el costo
  const t0 = performance.now(); guideFor = tid; guideFrom.x = player.x; guideFrom.z = player.z; let pts = null;
  if (NAV.ready) pts = navPath({ x: player.x, z: player.z, y: navY }, g.userData.top);
  else { const gp = groundPath({ x: player.x, z: player.z }, stairWorld(g, 0, 1.6)); if (gp) pts = gp.map(p => ({ x: p.x, z: p.z, y: player.y })) }
  guideRoute = pts && pts.length ? pts : null; guideT = performance.now() - t0 > 8 ? 1.5 : .5
}
function buildGuidePts() { // sin asignaciones por frame (arrays tipados) y descartando waypoints ya recorridos
  if (!guideRoute) { gpn = 0; guideLen = 0; return }
  while (guideRoute.length > 1) { const a = guideRoute[0], b = guideRoute[1]; if (Math.hypot(player.x - b.x, player.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z)) guideRoute.shift(); else break }
  gpx[0] = player.x; gpy[0] = player.y; gpz[0] = player.z; gcum[0] = 0; gpn = 1; guideLen = 0;
  for (let i = 0; i < guideRoute.length && gpn < GPMAX; i++) { const p = guideRoute[i], j = gpn - 1; guideLen += Math.hypot(p.x - gpx[j], p.y - gpy[j], p.z - gpz[j]); gpx[gpn] = p.x; gpy[gpn] = p.y; gpz[gpn] = p.z; gcum[gpn++] = guideLen }
}
function _buildGuidePtsOld() { // (versión anterior, sin uso)
  if (!guideRoute) { guidePts = null; guideLen = 0; return }
  guidePts = [{ x: player.x, y: player.y, z: player.z }, ...guideRoute]; guideCum = [0]; guideLen = 0;
  for (let i = 1; i < guidePts.length; i++) { const a = guidePts[i - 1], b = guidePts[i]; guideLen += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); guideCum.push(guideLen) }
}

function updateAtrium(dt) {
  const on = S.phase === 'atrium', pre = S.phase === 'prelude';

  // Animar el giro y la flotación continua de los bloques
  if (world.visible && floatingBlocks.length) {
    updateFloatingBlocks(T);
  }

  stairGroups.forEach(g => {
    const u = g.userData, ph = u.phase; if (!world.visible) return; // dentro de una sala el atrio no se anima
    if (!u.measured) g.position.y = Math.sin(T * .68 + ph) * .1; // sólo la geometría provisional (sin FBX): el anillo de luz queda fijo, alineado con el arco
    const done = S.completed.has(u.roomId), isT = nextRoomId() === u.roomId;

    u.gate.material.opacity = .7 + .2 * Math.sin(T * 1.5 + ph);
    u.gate.rotation.z += dt * (isT ? 3.5 : 1.2);
    if (u.gate.parent && u.gate.parent.children[1]) {
      u.gate.parent.children[1].rotation.z -= dt * 4.5; // Gira las chispas en sentido opuesto
    }

    u.halo.material.opacity = isT ? .55 + .3 * Math.sin(T * 3) : done ? .35 : .15;
    u.beam.material.opacity = isT ? .16 + .06 * Math.sin(T * 3) : .04;
    u.gate.material.color.setHex(done || isT ? LIME : PALE); u.check.visible = done; if (u.labels) u.labels.note.visible = u.labels.sub.visible = S.nearby !== u.roomId; // el aviso «Entrar» ya nombra la sala
    /* (los peldaños son invisibles: ya no se les anima el material) */
    u.cue.material.opacity = isT ? .5 + .4 * Math.sin(T * 4) : .2; u.cue.scale.setScalar(isT ? 1 + .15 * Math.sin(T * 4) : 1)
  });
  lightingManager.gate(stairGroups, nextRoomId(), T);
  if (on || pre) {
    if (keys.has('ArrowLeft') || lookHold) rig.yaw += 1.9 * dt; if (keys.has('ArrowRight')) rig.yaw -= 1.9 * dt;
    const mi = moveInput(), mag = Math.hypot(mi.ix, mi.iy); fwd.set(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)); rgt.set(-Math.cos(rig.yaw), 0, Math.sin(rig.yaw));
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight'); let sp = sprint ? 9.6 : 6.2, wx = fwd.x * mi.iy + rgt.x * mi.ix, wz = fwd.z * mi.iy + rgt.z * mi.ix;
    // C3 · auto-subida universal: detecta la proximidad al círculo indicador (cue) de cada escalera
    if (on && !auto && mag > .3 && player.y < (NAV.ready ? NAV.yg + 1.2 : 2.0)) {
      for (const g of stairGroups) {
        const u = g.userData;
        const cp = u.cue ? u.cue.position : new V3(0, 0, .9);
        const worldCue = g.localToWorld(new V3(cp.x, 0, cp.z));
        const distToCue = Math.hypot(player.x - worldCue.x, player.z - worldCue.z);

        // Si el avatar empuja hacia la entrada de la escalera cerca de su círculo indicador
        if (distToCue < 2.3 && (-u.sn * wx - u.cs * wz) / mag > -0.25) {
          const pts = NAV.ready ? navPath({ x: player.x, z: player.z, y: navY }, u.top) : stairUp(g, stairLocal(g, player.x, player.z));
          if (pts && pts.length) {
            startAuto(pts, { ride: true });
            break;
          }
        }
      }
    }
    if (auto) {
      const a = auto, ci = a.i, p = a.pts[ci], last = ci === a.pts.length - 1; let ddx = p.x - player.x, ddz = p.z - player.z; const d = Math.hypot(ddx, ddz); a.t += dt;
      if (d < (last ? .35 : .7)) { a.i++; if (a.i >= a.pts.length) { if (a.enter) pendEnter = { id: a.enter, t: .45 }; auto = null } }
      if (auto) {
        if (d > 1e-3) { ddx /= d; ddz /= d }
        if (!last && d < 1.3) { // a ≤1,3 m de la esquina: mezcla hacia el rumbo del siguiente tramo (giro suave, sin quiebre)
          const q = a.pts[ci + 1]; let nx = q.x - p.x, nz = q.z - p.z; const nl = Math.hypot(nx, nz);
          if (nl > 1e-3) { const w = (1 - d / 1.3) * .5; ddx += (nx / nl - ddx) * w; ddz += (nz / nl - ddz) * w; const l2 = Math.hypot(ddx, ddz) || 1; ddx /= l2; ddz /= l2 }
        }
        a.dx = ddx; a.dz = ddz;
        if (a.ride) { if (mag > .5 && (ddx * wx + ddz * wz) / mag < -.55) a.back += dt; else a.back = 0; if (a.back > .18) auto = null }   // empujar claramente hacia atrás cancela
        else if (a.t > .35 && mag > .3) auto = null;                                                                 // cualquier input nuevo cancela
        if (auto) { wx = ddx; wz = ddz; sp = (a.ride ? 6.6 : 7.2) * (last ? clamp(d / 1.6, .35, 1) : 1) }
      }
    }
    vel.x = damp(vel.x, wx * sp, 9, dt); vel.z = damp(vel.z, wz * sp, 9, dt);
    const before = player.clone(); let nx = player.x + vel.x * dt, nz = player.z + vel.z * dt;
    const RB = pre ? PRELUDE.R : 26, rr = Math.hypot(nx, nz); if (rr > RB) { nx *= RB / rr; nz *= RB / rr }
    // colisión: barandas laterales cuando estás en altura en la escalera (>2m)
    const navOn = on && NAV.ready;
    if (navOn) { // colisión contra el modelo: subpasos de ≤0,15 m (no se atraviesan muros finos) + deslizamiento por las paredes
      const dx = nx - player.x, dz = nz - player.z, ns = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15)), sx = dx / ns, sz = dz / ns; let px = player.x, pz = player.z, ph = navY, soft = navSoft(px, pz, ph);
      for (let k = 0; k < ns; k++) {
        let h = navFloor(px + sx, pz + sz, ph, soft);
        if (!isNaN(h)) { px += sx; pz += sz; ph = h; soft = navSoft(px, pz, ph); continue }
        const hx = navFloor(px + sx, pz, ph, soft), hz = navFloor(px, pz + sz, ph, soft);
        if (!isNaN(hx) && Math.abs(sx) > 1e-5) { px += sx; ph = hx; vel.z *= .2; soft = navSoft(px, pz, ph) } else if (!isNaN(hz) && Math.abs(sz) > 1e-5) { pz += sz; ph = hz; vel.x *= .2; soft = navSoft(px, pz, ph) } else { vel.x = vel.z = 0; break }
      }
      nx = px; nz = pz; setNavY(ph);
    }
    const sa = on ? surfaceAt : () => null, elevated = on && player.y > 2.0; let tgt = navOn ? null : sa(nx, nz, player.y);
    const allowed = t => t ? !t.blocked : !elevated;
    if (!navOn && !allowed(tgt)) {
      const tx = sa(nx, player.z, player.y), tz = sa(player.x, nz, player.y);
      if (allowed(tx)) { nz = player.z; tgt = tx; vel.z *= .2 } else if (allowed(tz)) { nx = player.x; tgt = tz; vel.x *= .2 } else { nx = player.x; nz = player.z; vel.x = vel.z = 0; tgt = sa(nx, nz, player.y) }
    }
    player.x = nx; player.z = nz; S.moved += Math.hypot(player.x - before.x, player.z - before.z);

    // Una sola fuente de verdad: con el NavMesh listo, el suelo es navY (sin raycasts ni constantes del dais)
    let targetFloor;
    if (navOn) {
      const ry = navRampY(player.x, player.z, navY);
      targetFloor = isNaN(ry) ? navY : ry;
    } else {
      const floorHit = groundController.getHeight(player.x, player.z, player.y, on);
      const onDais = (player.x * player.x + player.z * player.z) < 27.5;
      targetFloor = Math.max(floorHit, onDais ? 2.42 : 1.10);
    }

    // FÍSICA DE RAMPA CONTINUA: cualquier escalón o relieve se sube deslizándose con suavidad
    if (player.y < targetFloor) {
      const diff = targetFloor - player.y;
      const climb = 14.0 * dt; // Ascenso suave a 14 m/s (evita golpes secos de cámara)
      if (diff <= climb) {
        player.y = targetFloor;
      } else {
        player.y += climb;
      }
      velY = 0;
      isGrounded = true;
    } else if (player.y > targetFloor) {
      velY -= GRAVITY * dt;
      player.y += velY * dt;
      if (player.y <= targetFloor) {
        player.y = targetFloor;
        velY = 0;
        isGrounded = true;
      } else {
        isGrounded = false;
      }
    } else {
      velY = 0;
      isGrounded = true;
    }

    // Altura visual: la cámara y el avatar siguen la rampa sin hundir los pies (≤14 cm)
    if (Math.abs(viewY - player.y) > 1.8) viewY = camY = player.y;
    viewY = (isGrounded || (velY <= 0 && player.y - targetFloor < .4))
      ? clamp(damp(viewY, player.y, 20, dt), player.y - .14, player.y + .14)
      : player.y;
    camY = damp(camY, viewY, on ? 6.0 : 12, dt);
    if (Math.abs(camY - viewY) > 2.6) camY = viewY;
    if (navOn) { const wantMove = mag > .3 || auto; navStuck = wantMove && Math.hypot(player.x - before.x, player.z - before.z) < .004 ? navStuck + dt : 0; if (navStuck > 1.6) { navStuck = 0; const nn = navNode(player.x, player.z, navY); if (nn >= 0) { const cc = (nn / NAV.K) | 0; player.x = navCX(cc); player.z = navCZ(cc); setNavY(NAV.H[nn]); player.y = navY; vel.set(0, 0, 0); stopAuto() } } }
    lightingManager.update(player, dt, on);
    if (auto) { const mv = Math.hypot(player.x - before.x, player.z - before.z) / dt; auto.stuck = mv < 0.08 ? auto.stuck + dt : 0; if (auto.stuck > 1.5) auto = null }
    const speed = Math.hypot(vel.x, vel.z); if (speed > .4) heading = Math.atan2(vel.x, vel.z);
    avatarObj.rotation.y = lerpAngle(avatarObj.rotation.y, heading, 1 - Math.exp(-12 * dt));
    // la cámara se reorienta sola hacia donde caminas; al quedarte junto a un portal, lo encuadra
    if (rig.hold > 0) rig.hold -= dt; else if (speed > .8) { const w = auto ? .9 : clamp(Math.max(0, mi.iy) * .9 + Math.abs(mi.ix) * .5, 0, 1); rig.yaw = lerpAngle(rig.yaw, heading, 1 - Math.exp(-2.1 * w * dt)) }
    else if (on && S.nearby && !lookHold) { const gq = gateWorld(stairGroups[S.nearby - 1]); rig.yaw = lerpAngle(rig.yaw, Math.atan2(gq.x - player.x, gq.z - player.z), 1 - Math.exp(-1.3 * dt)) }
    if (rig.hold <= 0) rig.pitch = damp(rig.pitch, -.12, 3, dt);
    stepPh += speed * dt * .28; if (Math.floor(stepPh * 2) !== Math.floor((stepPh - speed * dt * .28) * 2) && speed > 1.5 && A.ctx) tone(70 + Math.random() * 20, .06, 'triangle', .04, 0, A.master);
    avatarObj.position.set(player.x, viewY, player.z); animAvatar(avatarObj, speed, T);
    camera.fov = damp(camera.fov, 62 + (sprint && speed > 6 ? 7 : 0), 6, dt); camera.updateProjectionMatrix(); updateCam();
    S.nearby = on ? nearestPortal() : 0;
    if (pendEnter) { pendEnter.t -= dt; if (mag > .3 || auto || !on) pendEnter = null; else if (pendEnter.t <= 0) { const id = pendEnter.id; pendEnter = null; if (S.nearby === id) enterRoom(id) } }
  } else if (S.phase === 'intro') { rig.yaw += dt * .12; viewY = camY = player.y; updateCam(); avatarObj.position.copy(player); animAvatar(avatarObj, 0, T); lightingManager.update(player, dt, false); }
  const tid = nextRoomId(), comp = $('compass');
  if (on && tid && !S.nearby && stairGroups.length) {
    const g = stairGroups[tid - 1];
    // La brújula y la línea de puntos guían exactamente hacia el círculo en el suelo
    const cp = g.userData.cue ? g.userData.cue.position : new V3(0, 0, .9);
    const base = g.localToWorld(new V3(cp.x, 0, cp.z));
    const dx = base.x - player.x, dz = base.z - player.z, dist = Math.hypot(dx, dz);
    const onGround = NAV.ready ? player.y < Math.max(NAV.yg, NAV.info?.daisY ?? 0) + 1.2 : player.y < 1.3, show = onGround && dist > 3;
    // Guía de luz: sigue la ruta real (no atraviesa muros) y se refresca solo si te mueves o cambia el objetivo
    if (show) {
      guideT -= dt; guideHidden = false;
      if (guideFor !== tid || !guideRoute || (guideT <= 0 && Math.hypot(player.x - guideFrom.x, player.z - guideFrom.z) > 1)) refreshGuide(g, tid);
      buildGuidePts();
    } else { guideRoute = null; guidePts = null; guideFor = 0 }
    for (let i = 0; i < GN; i++) {
      const f = ((i / GN) + T * .3) % 1, s = show ? Math.sin(f * Math.PI) * (.8 + .4 * Math.sin(T * 5 + i)) : 0; let px = player.x + dx * f, pz = player.z + dz * f, py = player.y + .16;
      if (gpn > 1 && guideLen > .5) { const d = f * guideLen; let k = 1; while (k < gpn - 1 && gcum[k] < d) k++; const t = clamp((d - gcum[k - 1]) / Math.max(1e-6, gcum[k] - gcum[k - 1]), 0, 1); px = lerp(gpx[k - 1], gpx[k], t); pz = lerp(gpz[k - 1], gpz[k], t); py = lerp(gpy[k - 1], gpy[k], t) + .16 }
      dummy.position.set(px, py, pz); dummy.scale.setScalar(s); dummy.updateMatrix(); guide.setMatrixAt(i, dummy.matrix)
    } guide.instanceMatrix.needsUpdate = true;
    const q = gateWorld(g), v = q.clone().project(camera), behind = v.z > 1; let sx = v.x, sy = v.y; if (behind) { sx = -sx; sy = -sy }
    const onScr = !behind && Math.abs(sx) < .84 && Math.abs(sy) < .74; if (!onScr) { const m = Math.max(Math.abs(sx) / .84, Math.abs(sy) / .74) || 1; sx /= m; sy /= m }
    const px = (sx * .5 + .5) * W, py = (-sy * .5 + .5) * H; comp.style.display = 'block'; comp.style.transform = `translate(${px}px,${py}px)`;
    DOM.arrow.style.display = onScr ? 'none' : 'block'; DOM.arrow.style.transform = `rotate(${Math.atan2(py - H / 2, px - W / 2) + Math.PI / 2}rad) translateY(-38px)`;
    setTxt(DOM.lbl, `${rooms[tid - 1].note} · ${Math.round(Math.hypot(q.x - player.x, q.z - player.z))} m`); DOM.mk.style.display = onScr ? 'block' : 'none'
  }
  else { guideRoute = null; guidePts = null; guideFor = 0; comp.style.display = 'none'; gpn = 0; if (!guideHidden) { guideHidden = true; for (let i = 0; i < GN; i++) { dummy.scale.setScalar(0); dummy.updateMatrix(); guide.setMatrixAt(i, dummy.matrix) } guide.instanceMatrix.needsUpdate = true } }
  const pr = $('prompt');
  if (on && S.nearby) { const r = rooms[S.nearby - 1]; const m = `Entrar · ${r.title}${TOUCH ? '' : ' <kbd>E</kbd>'}`; if (pr.dataset.m !== m) { pr.dataset.m = m; pr.innerHTML = m } pr.classList.add('show'); if (updateAtrium.near !== S.nearby) { tone(880, .3, 'sine', .04, 0, A.master); tone(1318, .35, 'sine', .03, .08, A.master) } updateAtrium.near = S.nearby } else { pr.classList.remove('show'); updateAtrium.near = 0 }
  const bw = $('btnWalk'), showW = on && tid && S.nearby !== tid && !auto; bw.classList.toggle('show', !!showW);
  const bl = $('btnLook'), wl = TOUCH && (on || pre) ? 'block' : 'none'; if (bl.style.display !== wl) bl.style.display = wl;
  clickMark.visible = (on || pre) && !!(auto && auto.mark); if (clickMark.visible) { clickMark.position.set(auto.mark.x, auto.mark.y, auto.mark.z); clickMark.scale.setScalar(1 + .16 * Math.sin(T * 6)) }
  hoverTick(on && !auto, dt);
  const co = $('coach'); let msg = '';
  if (on && !S.completed.size && !S.nearby) { const done = [() => S.moved > 4, () => player.y > (NAV.ready ? NAV.yg + 1.8 : 1.5)], txt = [TOUCH ? 'Toca el suelo para caminar, o usa el círculo' : 'Haz clic en el suelo para caminar · o usa <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', 'Sigue el hilo de luz hasta la escalera que late. Si te pierdes: «Ir a la siguiente sala»']; while (S.coach < 2 && done[S.coach]()) S.coach++; if (S.coach < 2) msg = txt[S.coach] }
  if (msg) { if (co.dataset.m !== msg) { co.innerHTML = msg; co.dataset.m = msg } co.classList.add('show') } else { co.classList.remove('show'); co.dataset.m = '' }
}

/* ======================================================================
   ENTRADA (pointer unificado: mouse + táctil)
   ====================================================================== */
const ptr = { x: innerWidth / 2, y: innerHeight / 2, down: false, type: 'mouse', ui: false }; let tap = null;
const ptrActive = () => ptr.type === 'mouse' || ptr.down;
const isUI = e => !!(e.target.closest && e.target.closest('.ui,button,.lcard,.breath'));
/* C1 · clic/toque para ir: raycast contra suelo y escaleras */
const rcA = new THREE.Raycaster(); rcA.far = 120;
const ndc = new THREE.Vector2();
function pickAtrium(cx, cy) {
  ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); rcA.setFromCamera(ndc, camera);
  if (NAV.ready) { // picking contra el NavMesh: sin raycast de mallas (rápido y no atraviesa geometría invisible)
    const h = navPick(rcA.ray.origin, rcA.ray.direction); if (!h) return null;
    const hi = h.y > NAV.yg + .5;
    for (const g of stairGroups) { const l = stairLocal(g, h.x, h.z); if (Math.abs(l.x) < 2.5 && l.z <= 1.2 && l.z >= -((g.userData.len || 6.8) + 1.2) && (hi || l.z > -.5)) return { g } }
    return h
  }
  const targets = [atriumFloor, ...stairGroups];
  //if (atriumFBXObj) targets.push(atriumFBXObj);
  for (const h of rcA.intersectObjects(targets, true)) {
    let o = h.object; while (o && !stairGroups.includes(o) && o !== atriumFBXObj) o = o.parent;
    if (o && stairGroups.includes(o)) return { g: o };
    if (o === atriumFBXObj) {
      for (const g of stairGroups) {
        const l = stairLocal(g, h.point.x, h.point.z);
        if (Math.abs(l.x) < 2.5 && l.z <= 1.2 && l.z >= -((g.userData.len || 6.8) + 1.2)) return { g };
      }
      return { x: h.point.x, y: h.point.y, z: h.point.z };
    }
    if (h.object === atriumFloor) return { x: h.point.x, y: NAV.ready ? NAV.yg : undefined, z: h.point.z };
  }
  return null;
}
function clickToGo(cx, cy) {
  if (S.phase === 'prelude') {
    ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); rcA.setFromCamera(ndc, camera);
    const hits = rcA.intersectObjects([roomFloor, roomGroup], true);
    const valid = hits.find(h => h.object.isMesh && h.object.visible);
    if (valid) {
      const pt = valid.point, r = Math.hypot(pt.x, pt.z), k = r > PRELUDE.R ? PRELUDE.R / r : 1, x = pt.x * k, z = pt.z * k;
      startAuto([{ x, z }], { mark: { x, y: pt.y + .08, z } });
    }
    return;
  }
  const d = pickAtrium(cx, cy); if (!d) return; if (!walkTo(d)) toast('No puedo llegar ahí · prueba otro punto')
}
const hoverMark = new THREE.Mesh(new THREE.RingGeometry(.3, .4, 32), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide })); hoverMark.rotation.x = -Math.PI / 2; hoverMark.visible = false; scene.add(hoverMark);
const clickMark = new THREE.Mesh(new THREE.RingGeometry(.38, .52, 36), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .95, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); clickMark.rotation.x = -Math.PI / 2; clickMark.renderOrder = 6; clickMark.visible = false; scene.add(clickMark);
let hoverT = 0;
function hoverTick(act, dt) { // anillo guía bajo el mouse (solo escritorio)
  if (!act || TOUCH || ptr.type !== 'mouse' || ptr.ui) { hoverMark.visible = false; if (document.body.style.cursor) document.body.style.cursor = ''; return }
  hoverT -= dt; if (hoverT > 0) return; hoverT = .12; const d = pickAtrium(ptr.x, ptr.y);
  if (d && !d.g && (NAV.ready || !groundBlocked(d.x, d.z))) { hoverMark.visible = true; hoverMark.position.set(d.x, (d.y ?? 0) + .08, d.z) } else hoverMark.visible = false;
  const c = d && (d.g || NAV.ready || !groundBlocked(d.x, d.z)) ? 'pointer' : ''; if (document.body.style.cursor !== c) document.body.style.cursor = c
}
addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.type = e.pointerType || 'mouse'; ptr.ui = isUI(e) });
addEventListener('pointerdown', e => {
  if (isUI(e)) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.type = e.pointerType || 'mouse'; ptr.down = true;
  if (S.phase === 'atrium' || S.phase === 'prelude') tap = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; else if (S.phase === 'play') cur?.onDown?.(e)
});
addEventListener('pointerup', e => {
  ptr.down = false;
  if (tap && e.pointerId === tap.id && (S.phase === 'atrium' || S.phase === 'prelude') && performance.now() - tap.t < 450 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12 && (e.pointerType === 'touch' || e.button === 0)) clickToGo(e.clientX, e.clientY); tap = null
});
addEventListener('pointercancel', () => { ptr.down = false; tap = null });
// cámara opcional (escritorio): arrastrar con botón derecho/central orbita, rueda = zoom
let orbit = null; const orbitOK = () => S.phase === 'atrium' || S.phase === 'prelude';
addEventListener('pointerdown', e => { if ((e.button === 2 || e.button === 1) && orbitOK() && !isUI(e)) { orbit = { x: e.clientX, y: e.clientY, id: e.pointerId }; tap = null; e.preventDefault() } });
addEventListener('pointermove', e => { if (!orbit || e.pointerId !== orbit.id) return; rig.yaw += (e.clientX - orbit.x) * .005; rig.pitch = clamp(rig.pitch + (e.clientY - orbit.y) * .004, -.5, .3); orbit.x = e.clientX; orbit.y = e.clientY; rig.hold = 1.6 });
const orbitEnd = e => { if (orbit && e.pointerId === orbit.id) orbit = null };
addEventListener('pointerup', orbitEnd); addEventListener('pointercancel', orbitEnd);
addEventListener('contextmenu', e => { if (orbitOK()) e.preventDefault() });
addEventListener('wheel', e => { if (!orbitOK() || isUI(e)) return; rig.dist = clamp(rig.dist + Math.sign(e.deltaY) * .4, 3.2, 10) }, { passive: true });
addEventListener('blur', () => { keys.clear(); ptr.down = false; tap = null; lookHold = false });
const lookEl = $('btnLook'); lookEl.addEventListener('pointerdown', e => { lookHold = true; lookEl.setPointerCapture(e.pointerId) });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => lookEl.addEventListener(n, () => { lookHold = false }));
addEventListener('keydown', e => {
  const c = e.code; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c) && !(e.target.tagName === 'BUTTON' && c === 'Space' && !((S.phase === 'atrium' || S.phase === 'prelude') && !$('help').classList.contains('show')))) e.preventDefault();
  if (e.repeat) { keys.add(c); return } keys.add(c);
  if (c === 'KeyM') { if (ensureAudio()) setMuted(!A.muted); return }
  if (c === 'KeyH' || c === 'Escape') { toggleHelp(); return }
  if ($('help').classList.contains('show')) return;
  if (S.phase === 'intro' && (c === 'Enter' || c === 'Space')) { startGame(); return }
  if (S.phase === 'atrium' || S.phase === 'prelude') {
    if (c === 'Space') {
      if (isGrounded) {
        velY = JUMP_FORCE;
        isGrounded = false;
        if (A.ctx) tone(420, .1, 'triangle', .05, 0, A.master);
      }
      return;
    }
    if (S.phase === 'atrium') {
      if (c === 'KeyE' || c === 'Enter') tryEnter();
      else if (c === 'KeyC' && !e.ctrlKey && !e.metaKey && !e.altKey) walkNext();
    } else if (c === 'KeyE' || c === 'Enter') enterZone();
    else if (c === 'KeyQ') leaveRoom();
  }
  else if (S.phase === 'brief') { if (c === 'Enter' || c === 'Space') startRoom(); else if (c === 'KeyQ') leaveRoom() }
  else if (S.phase === 'play') { if (c === 'KeyQ') leaveRoom(); else cur?.onKey?.(c, e) }
  else if (S.phase === 'done' && (c === 'Enter' || c === 'Space')) afterDone()
});
addEventListener('keyup', e => keys.delete(e.code));
function toggleHelp() { $('help').classList.toggle('show') }
$('btnHelp').onclick = toggleHelp; $('helpClose').onclick = toggleHelp; $('btnSound').onclick = () => { ensureAudio(); setMuted(!A.muted) };
$('btnWalk').innerHTML = `Ir a la siguiente sala${TOUCH ? '' : ' <kbd>C</kbd>'}`; $('btnWalk').onclick = () => { $('btnWalk').blur(); walkNext() };
$('btnStart').onclick = startGame; $('prompt').onclick = () => S.phase === 'prelude' ? enterZone() : tryEnter(); $('btnBack').onclick = () => leaveRoom();
$('introHow').innerHTML = TOUCH ? `<span class="tchip">Tocar</span><span>El suelo: el avatar camina solo</span><span class="tchip">Círculo</span><span>Caminar con el pulgar</span><span class="tchip">Botón</span><span>«Ir a la siguiente sala» te lleva al portal</span><span class="tchip">Dedo</span><span>Tocar y arrastrar dentro de cada sala</span>` : `<span><kbd>Clic</kbd></span><span>En el suelo: el avatar camina solo</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Caminar · <kbd>Shift</kbd> corre</span><span><kbd>Espacio</kbd></span><span>Saltar</span><span><kbd>C</kbd></span><span>Llévame a la siguiente sala</span><span><kbd>E</kbd></span><span>Entrar al portal cercano</span><span><kbd>M</kbd> <kbd>H</kbd></span><span>Silenciar · ayuda</span>`;
$('helpBody').innerHTML = TOUCH ? `<div class="ctl"><span class="keys"><span class="tchip">Tocar</span></span><span>Tocar el suelo: caminar hasta ahí</span></div><div class="ctl"><span class="keys"><span class="tchip">Círculo</span></span><span>Caminar</span></div><div class="ctl"><span class="keys"><span class="tchip">⟳</span></span><span>Mantener para girar la vista (opcional)</span></div><div class="ctl"><span class="keys"><span class="tchip">Botón</span></span><span>«Ir a la siguiente sala» · «Entrar»</span></div>` : `<div class="ctl"><span class="keys"><kbd>Clic</kbd></span><span>Caminar hasta el punto del suelo</span></div><div class="ctl"><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Caminar · <kbd>Shift</kbd> correr</span></div><div class="ctl"><span class="keys"><kbd>Espacio</kbd></span><span>Saltar</span></div><div class="ctl"><span class="keys"><kbd>C</kbd></span><span>Ir solo a la siguiente sala</span></div><div class="ctl"><span class="keys"><kbd>←</kbd><kbd>→</kbd></span><span>Girar la vista (opcional; se orienta sola)</span></div><div class="ctl"><span class="keys"><kbd>E</kbd></span><span>Entrar a la sala</span></div><div class="ctl"><span class="keys"><kbd>Q</kbd></span><span>Volver al atrio</span></div><div class="ctl"><span class="keys"><kbd>M</kbd></span><span>Silenciar</span></div><div class="ctl"><span class="keys"><kbd>H</kbd><kbd>Esc</kbd></span><span>Esta ayuda</span></div>`;
if (!TOUCH) $('btnBack').innerHTML = '← Volver al atrio <kbd class="dk">Q</kbd>';
window.walkNext = walkNext; window.walkTo = walkTo; window.enterRoom = enterRoom; window.player = player; window.stairGroups = stairGroups; window.S = S;

/* ======================================================================
   FLUJO
   ====================================================================== */
let cur = null;
function startGame() {
  if (S.phase !== 'intro') return; ensureAudio(); startAmbient(); $('intro').classList.add('hide'); setTimeout(() => $('intro').style.display = 'none', 650); S.phase = 'atrium'; S.sessionStart = performance.now();
  rig.yaw = Math.PI; rig.pitch = -.12; placeAtSpawn(); renderProgress(); setAvatar(skinKind(0));
  seen.add(entry); LS.set('flauxus.entries.v1', [...seen]); showUnlock()
}
function showUnlock() {
  const d = ENTRIES[entry]; if (!d.skill) return; const el = $('unlock');
  const extra = entry === 'cards' ? `<span class="cards">${HAND.map(c => CARDS[c].n).join(' · ')}</span>` : '';
  el.innerHTML = `<div class="k">Habilidad desbloqueada</div><strong>${d.skill}</strong><span>${d.blurb}</span>${extra}`;
  setTimeout(() => { el.classList.add('show'); tone(783.99, .5, 'sine', .04, 0, A.master); tone(1174.66, .7, 'sine', .03, .09, A.master) }, 1100);
  setTimeout(() => el.classList.remove('show'), 9500)
}
const ROOM_MAP = { do: 1, do4: 1, re: 2, re4: 2, mi: 3, mi4: 3, fa: 4, fa4: 4, sol: 5, sol4: 5, la: 6, la4: 6 };
const roomParam = qs.get('room');
const directRoom = roomParam ? (parseInt(roomParam, 10) || ROOM_MAP[roomParam.toLowerCase()] || 0) : 0;
if (directRoom >= 1 && directRoom <= 6) {
  setTimeout(() => {
    startGame();
    setTimeout(() => enterRoom(directRoom), 400);
  }, 150);
}
function tryEnter() { if (S.phase !== 'atrium') return; if (!S.nearby) { toast('Acércate a un portal, o pulsa «Ir a la siguiente sala»'); return } enterRoom(S.nearby) }
const GO_LABEL = `Empezar${TOUCH ? '' : ' <span style="opacity:.6;font-weight:500">· Enter</span>'}`;
function noteRec(id) {
  if (!recOk(id)) { toast('No encontré ' + trackFiles.get(id) + ' junto al HTML · uso sonido provisional'); return }
  if (Rec.fb.has(id) && !S.rfNote) { S.rfNote = true; toast('Modo básico: para el procesado completo abre el prototipo desde un servidor (http), no desde file://') }
}
function enterRoom(id) {
  if (S.busy) return; S.busy = true; const r = rooms[id - 1]; fade(() => {
    stopAuto(); S.room = id; S.phase = PRELUDE.enabled ? 'prelude' : 'brief'; cur = IMPL[id];
    world.visible = false; roomGroup.visible = true; clearGroup(roomGroup); roomGen++; groundController.reset(); groundController.roomObj = null;
    lightingManager.setMode('room', id);
    setAvatar(skinKind(id)); avatarObj.position.set(0, 0, 0); avatarObj.rotation.y = 0; avatarObj.scale.setScalar(1);
    /* Invisible collision floor for raycasting */
    const f = new THREE.Mesh(new THREE.CircleGeometry(18, 64), mat(0x12130d, { roughness: 1 })); f.rotation.x = -Math.PI / 2; f.material.transparent = true; f.material.opacity = 0; f.visible = true; roomGroup.add(f); roomFloor = f;
    const disc = glowSprite(LIME, 14, .2); disc.material.depthTest = false; disc.position.y = .05; disc.renderOrder = -1; roomGroup.add(disc);
    cur.build(); camera.fov = 62; camera.updateProjectionMatrix(); camCur.copy(cur.camPos || new V3(0, 2.3, 8.6)); camLook.copy(cur.camLook || new V3(0, 1.7, 0));
    setRoomInfo(`Momento ${id} · ${r.note}`, r.title, r.desc);
    $('sourceChip').style.display = 'block'; $('sourceChip').innerHTML = r.audio === 'real' ? `♪ <b>${r.source}</b>` : `♪ ${r.source}`;
    $('roomUI').classList.add('active'); hideRoomDom(); hint(''); $('btnBack').style.display = 'block'; $('prompt').classList.remove('show'); $('coach').classList.remove('show'); $('compass').style.display = 'none';
    A.ambient?.set(0, .4);
    const pend = r.audio === 'pending' ? `<div class="pend">Audio provisional · pendiente de validar con María Clara</div>` : r.audio === 'none' ? `<div class="pend">Sonido procedural · esta sala no tiene grabación</div>` : '';
    const hlTitle = r.title.replace(/^(\S+)/, '<span class="hl">$1</span>');
    $('brief').innerHTML = `<div class="k">Momento ${id} de 6 · ${r.note}</div><h2>${hlTitle}</h2><p>${r.goal}</p>${pend}${ctlRow(r)}<button class="btn" id="btnGo">${GO_LABEL}</button>`;
    if (!PRELUDE.enabled) $('brief').classList.add('show'); renderProgress(); titleCard(r);
    const need = r.audio === 'real', go = $('btnGo'); S.ready = !need; go.onclick = startRoom;
    if (need) { go.disabled = true; go.textContent = 'Preparando la grabación…'; Promise.race([loadRec(id), sleep(9000)]).then(() => { if (S.room !== id) return; S.ready = true; go.disabled = false; go.innerHTML = GO_LABEL; noteRec(id) }) }
    if (PRELUDE.enabled) initPrelude(id); S.busy = false
  })
}
function startRoom() { if (S.phase !== 'brief' || !S.ready) return; document.activeElement?.blur?.(); ensureAudio(); newBus(); S.phase = 'play'; S.playStart = performance.now(); $('brief').classList.remove('show'); $('btnSkip').style.display = 'none'; cur.start(); tone(660, .12, 'sine', .04, 0, A.master) }
/* ======================================================================
   LOCUCIÓN EN OFF + PRELUDIO
   Antes de cada minijuego, el usuario CAMINA por la sala mientras escucha a María Clara; al final del texto se arma
   el círculo de luz (trigger del GTI: «[E] ENCONTRAR EL SONIDO», etc.) y recién entonces empieza el Momento.
   · Los textos son los fragmentos LITERALES aprobados en el GTI v3.0 (nada reescrito; RE sigue pendiente de selección).
   · La voz se lee de archivos de María Clara junto al HTML (ver VO_FILES). Si el archivo no existe, el texto se muestra
     igual como subtítulo con ritmo de lectura: NUNCA se sintetiza una voz que no sea la suya.
   · PRELUDE.enabled=false → vuelve al flujo anterior (sala → ficha → juego).
   ====================================================================== */
const PRELUDE = { enabled: true, R: 14, start: { x: 0, z: 8.5 }, trigR: 2.5 };
const VO_TEXT = {
  "1": [
    {
      "t": "Construir un cuerpo disciplinado para la interpretación de música académica occidental implica un conflicto silencioso: una tensión entre la estandarización de la práctica y la demanda de ser yo, una artista única y original.",
      "src": "Carrusel 1 · lámina 1"
    }
  ],
  "2": [],
  "3": [
    {
      "t": "¿Hay realmente una intención? ¿Trasciende la ganancia que suponía el componer? Y, si la hay ¿Puedo acceder a ella? ¿Necesito acceder a ella? Con o sin conocimiento de la intención, el canon suena. Y ha sonado. Y seguirá sonando con o sin mí (con o sin ti). Tal vez la revelación es que no hay nada que entender y, si lo hay, está perdido. De lo único de lo que puedo estar segura, es de mi intención.",
      "src": "Carrusel 2 · lámina 5"
    }
  ],
  "4": [
    {
      "t": "Sobrevivimos buscando la propia voz sobre una técnica estandarizada, modificándonos para ella, muy rara vez modificando la obra para que se amolde a nosotras. Hablamos sobre nuestro cuerpo para reprocharle lo que no podemos hacer, pero dejamos de lado que la dimensión corporal no se agota en la técnica y que concientizar esto nos podría dotar de agencia.",
      "src": "Carrusel 1 · lámina 6"
    }
  ],
  "5": [
    {
      "t": "Nadie me lo dijo explícitamente, tardé años en desenmarañar esa tensión incómoda y encontrar este conflicto iluminador. Ahora queda el vacío de entender que no importa qué haga, nunca estaré en gracia con todos. Entonces puedo hacer lo que quiera.",
      "src": "Carrusel 1 · lámina 8"
    }
  ],
  "6": [
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
  ]
};
const VO_FILES = { 1: ['Voz_DO4'], 3: ['Voz_MI4'], 4: ['Voz_FAs4'], 5: ['Voz_SOLs4'], 6: ['Voz_LAs4_1', 'Voz_LAs4_2', 'Voz_LAs4_3'] }; // .mp3 o .wav
const TRIG_LABEL = { 1: 'ENCONTRAR EL SONIDO', 2: 'JUGAR CON EL PULSO', 3: 'DECIDIR LA FRASE', 4: 'HABITAR EL ESPACIO', 5: 'CONECTAR EL CUERPO', 6: 'INTERVENIR LA PARTITURA' };
const VO = { active: false, armed: true, el: null, tok: 0, cache: new Map() };
const escH = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function voLoad(base) {
  if (VO.cache.has(base)) return VO.cache.get(base);
  const p = (async () => {
    for (const ext of ['.mp3', '.wav']) {
      const el = await new Promise(res => {
        const e = new Audio(); e.preload = 'auto'; let done = false; const fin = ok => { if (done) return; done = true; res(ok ? e : null) };
        e.addEventListener('loadedmetadata', () => fin(true), { once: true }); e.addEventListener('error', () => fin(false), { once: true }); setTimeout(() => fin(false), 2500); e.src = new URL(base + ext, document.baseURI).href
      });
      if (el) return el
    } return null
  })(); VO.cache.set(base, p); return p
}
function voStop() { VO.tok++; VO.active = false; try { VO.el?.pause() } catch { } VO.el = null; $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none' }
async function voRun(id) {
  const tok = ++VO.tok, list = VO_TEXT[id] || []; VO.armed = false; VO.active = false;
  if (!list.length || S.heard.has(id)) { VO.armed = true; return }
  VO.active = true; $('btnVoSkip').style.display = 'block'; A.ambient?.set(.22, .8);
  for (let k = 0; k < list.length; k++) {
    const frag = list[k], words = frag.t.split(/\s+/), base = VO_FILES[id]?.[k];
    const el = base ? await voLoad(base) : null; if (tok !== VO.tok) return;
    $('voText').innerHTML = words.map(w => `<span class="w">${escH(w)}</span>`).join(' '); $('voSrc').textContent = DEV_ENTRY_PICKER ? `fuente interna · ${frag.src}${el ? '' : ' · sin audio (subtítulo con ritmo de lectura)'}` : '';
    $('vo').classList.add('show'); const spans = [...$('voText').children], est = Math.max(3, words.length * .4 + .8), t0 = performance.now(); let dur = est, useEl = false;
    if (el) { try { el.muted = A.muted; el.currentTime = 0; await el.play(); useEl = true; VO.el = el; if (isFinite(el.duration) && el.duration > 0) dur = el.duration } catch { } }
    if (tok !== VO.tok) { try { el?.pause() } catch { } return }
    await new Promise(res => {
      const iv = setInterval(() => {
        if (tok !== VO.tok) { clearInterval(iv); res(); return }
        const el2 = (performance.now() - t0) / 1000, p = useEl && el.duration ? el.currentTime / el.duration : el2 / dur;
        const n = Math.floor(clamp(p, 0, 1) * spans.length * 1.04); spans.forEach((sp, i) => sp.classList.toggle('on', i < n));
        if ((useEl ? el.ended : p >= 1) || el2 > dur + 5) { clearInterval(iv); res() }
      }, 80)
    });
    VO.el = null; if (tok !== VO.tok) return;
    spans.forEach(sp => sp.classList.add('on')); await sleep(k < list.length - 1 ? 800 : 1300); if (tok !== VO.tok) return
  }
  $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none'; VO.active = false; VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1.5)
}
$('btnVoSkip').onclick = () => { const id = S.room; voStop(); VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1); toast('Locución saltada · puedes seguir explorando') };
const PRE = { grp: null, home: null, ring: null, halo: null, beam: null, dots: [] };
function preBuild(id) {
  const g = new THREE.Group(); roomGroup.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PRELUDE.trigR, .07, 10, 72), new THREE.MeshBasicMaterial({ color: PALE, transparent: true, opacity: .9 })); ring.rotation.x = Math.PI / 2; ring.position.y = .06; g.add(ring);
  const halo = glowSprite(LIME, PRELUDE.trigR * 3.4, .12); halo.position.y = .3; g.add(halo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .04, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = 6; g.add(beam);
  const lab = makeTextSprite(TRIG_LABEL[id], '#efeadb', 6.2, 34, true); lab.position.set(0, 3.9, 0); g.add(lab);
  const dots = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: LIME })); m.scale.setScalar(0); g.add(m); dots.push(m) }
  Object.assign(PRE, { grp: g, ring, halo, beam, dots })
}
function initPrelude(id) {
  PRE.home = avatarObj.position.clone(); preBuild(id);
  player.set(PRELUDE.start.x, 0, PRELUDE.start.z); vel.set(0, 0, 0); rig.yaw = Math.PI; rig.pitch = -.12; heading = Math.PI; avatarObj.position.copy(player); avatarObj.rotation.y = Math.PI;
  stopAuto(); A.ambient?.set(.35, .8); updateCam(); voRun(id)
}
function updatePrelude(dt) {
  if (!PRE.grp) return; const id = S.room, d = Math.hypot(player.x, player.z), near = d < PRELUDE.trigR, armed = VO.armed;
  PRE.ring.material.color.setHex(armed ? LIME : PALE); PRE.ring.scale.setScalar(1 + .04 * Math.sin(T * 3)); PRE.halo.material.opacity = armed ? .4 + .2 * Math.sin(T * 3) : .12; PRE.beam.material.opacity = armed ? .12 + .04 * Math.sin(T * 3) : .04;
  const sx = PRELUDE.start.x, sz = PRELUDE.start.z; PRE.dots.forEach((m, i) => { const f = ((i / PRE.dots.length) + T * .3) % 1, sc = armed && d > PRELUDE.trigR + 1.5 ? Math.sin(f * Math.PI) : 0; m.position.set(lerp(sx, 0, f) * .9, .16, lerp(sz, 0, f) * .9); m.scale.setScalar(sc) });
  const pr = $('prompt'); if (armed && near) { const m = `${TRIG_LABEL[id]}${TOUCH ? '' : ' <kbd>E</kbd>'}`; if (pr.dataset.m !== m) { pr.dataset.m = m; pr.innerHTML = m } pr.classList.add('show') } else pr.classList.remove('show');
  const co = $('coach'); let msg = ''; if (!VO.active && !near) msg = TOUCH ? 'Camina hasta el círculo de luz · toca el suelo o usa el círculo' : 'Camina hasta el círculo de luz · clic en el suelo o <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>';
  if (msg) { if (co.dataset.m !== msg) { co.innerHTML = msg; co.dataset.m = msg } co.classList.add('show') } else { co.classList.remove('show'); co.dataset.m = '' }
}
function enterZone() {
  if (S.phase !== 'prelude' || S.busy) return;
  if (!VO.armed) { toast('Escucha hasta el final, o pulsa «Saltar locución»'); return }
  if (Math.hypot(player.x, player.z) >= PRELUDE.trigR) { toast('Acércate al círculo de luz'); return }
  S.busy = true; voStop(); stopAuto(); fade(() => {
    if (PRE.grp) { clearGroup(PRE.grp); roomGroup.remove(PRE.grp) } PRE.grp = null; $('prompt').classList.remove('show'); $('coach').classList.remove('show');
    avatarObj.position.copy(PRE.home); avatarObj.rotation.y = 0; S.phase = 'brief'; $('brief').classList.add('show'); A.ambient?.set(0, .4); S.busy = false
  })
}
let roomFloor = null;
function hideRoomDom() { voStop(); $('miUI').style.display = 'none'; $('laUI').style.display = 'none'; $('brief').classList.remove('show'); $('done').classList.remove('show'); $('btnSkip').style.display = 'none' }
function finish(m, lines, skipped = false) {
  if (S.phase !== 'play') return; S.phase = 'done'; S.completed.add(S.room); S.metrics[S.room] = { ...m, skipped, duration: (performance.now() - S.playStart) / 1000 };
  cur.stop?.(); sting(); shake(14); paintHuella();
  const f = $('flash'); f.style.background = '#c9d000'; f.style.opacity = '.16'; f.classList.remove('on'); setTimeout(() => { f.style.opacity = ''; f.style.background = '' }, 260);
  burst(W / 2, H / 2, LIMEH, 60, 420, 1.1, 4); ringFx(W / 2, H / 2, '#fff', 20, 320, .9, 3); hint(''); hideRoomDom(); renderProgress();
  const r = rooms[S.room - 1];
  $('done').innerHTML = `<div class="stamp">${skipped ? 'Saltada' : 'Hecho'}</div><div class="k">Momento completado · ${r.note}</div><h2>${r.title}</h2>${(skipped ? [['Sala', 'saltada']] : lines).map(l => `<div class="stat"><span>${l[0]}</span><u></u><b>${l[1]}</b></div>`).join('')}<button class="btn" id="btnNext">${S.room === 6 ? 'Ver mi partitura' : 'Volver al atrio'}${TOUCH ? '' : ' <span style="opacity:.6;font-weight:500">· Enter</span>'}</button>`;
  setTimeout(() => { if (S.phase === 'done') { $('done').classList.add('show'); $('btnNext').onclick = afterDone } }, 650)
}
function afterDone() { if (S.phase !== 'done') return; if (S.room === 6) showEpilogue(); else leaveRoom() }
function leaveRoom() {
  if (S.busy || !S.room) return; S.busy = true; fade(() => {
    cur?.stop?.(); killBus(); hideRoomDom(); $('roomUI').classList.remove('active'); $('btnBack').style.display = 'none'; $('sourceChip').style.display = 'none';
    roomGroup.visible = false; world.visible = true; roomGen++; groundController.reset(); groundController.roomObj = null; setAvatar(skinKind(0)); avatarObj.scale.setScalar(1); S.room = 0; cur = null; S.phase = 'atrium';
    lightingManager.setMode('atrium');
    stopAuto(); placeAtSpawn(); vel.set(0, 0, 0); const t = nextRoomId(); if (t) { const g = stairGroups[t - 1], b = g.localToWorld(new V3(0, 0, .9)); rig.yaw = Math.atan2(b.x, b.z) } else rig.yaw = Math.PI; rig.pitch = -.12; heading = rig.yaw; avatarObj.rotation.y = heading;
    setRoomInfo('Atrio central', 'El museo imposible', 'Seis escaleras flotan alrededor del centro. Haz clic en el suelo para caminar y sigue la que late: cada una lleva a un momento distinto.'); A.ambient?.set(1, 1); renderProgress(); S.busy = false; hint('')
  })
}
$('btnSkip').onclick = () => { if (S.phase === 'play') { cur.stop?.(); finish({}, [], true) } };

/* ---------------- cámara de sala ---------------- */
const camCur = new V3(0, 2.3, 8.6), camLook = new V3(0, 1.7, 0);
function roomCamera(dt) {
  let tp = cur.camPos || new V3(0, 2.3, 8.6), tl = cur.camLook || new V3(0, 1.7, 0);
  if (cur.cam) { const c = cur.cam(); tp = c.pos; tl = c.look }
  const px = (ptr.x / W - .5), py = (ptr.y / H - .5), par = cur.noParallax || TOUCH ? 0 : 1;
  camCur.x = damp(camCur.x, tp.x + px * .6 * par, cur.cam ? 5 : 3, dt); camCur.y = damp(camCur.y, tp.y - py * .3 * par, cur.cam ? 5 : 3, dt); camCur.z = damp(camCur.z, tp.z, cur.cam ? 5 : 3, dt); camLook.lerp(tl, 1 - Math.exp(-6 * dt));
  camera.position.copy(camCur); if (shakeAmt > .05) { camera.position.x += (Math.random() - .5) * shakeAmt * .03; camera.position.y += (Math.random() - .5) * shakeAmt * .03 } camera.lookAt(camLook); camera.updateMatrixWorld()
}

/* ======================================================================
   SALA 1 · DO — la grabación empieza velada; el aire y la resonancia la aclaran.

/* ======================================================================
   EPÍLOGO
   ====================================================================== */
function renderEntries() {
  const keys = Object.keys(ENTRIES), n = keys.filter(k => seen.has(k)).length;
  $('epEntries').innerHTML = `<div class="eyebrow">Entradas descubiertas · ${n} de 4</div><div class="entrow">${keys.map(k => { const d = ENTRIES[k], on = seen.has(k); return `<div class="ent${on ? ' on' : ''}${k === entry ? ' now' : ''}"><b>${d.tag}</b><span>${on ? (d.skill || 'estado base') : 'por descubrir'}</span></div>` }).join('')}</div><p class="entnote">${n >= 4 ? 'Recorriste las cuatro puertas: cada una cambia la forma de jugar el mismo museo.' : 'Cada satélite —fanzine, afiche, baraja— abre una posibilidad distinta dentro del mismo museo. Vuelve a entrar desde otro para descubrirla.'}</p>`
}
function showEpilogue() {
  S.phase = 'epilogue'; renderEntries(); hideRoomDom(); cur?.stop?.(); killBus(); $('roomUI').classList.remove('active'); $('btnBack').style.display = 'none'; $('epilogue').classList.add('show');
  (document.fonts?.ready || Promise.resolve()).then(drawTrace); drawTrace();
  const mins = ((performance.now() - S.sessionStart) / 60000).toFixed(1); $('epSummary').textContent = `Recorrido: ${[...S.completed].map(i => rooms[i - 1].note).join(' → ')} · duración total: ${mins} min · ${entryLabel.toLowerCase()}`; tone(523.25, 1.2, 'sine', .06, 0, A.master)
}
function drawTrace() {
  const c = $('traceCanvas'), x = c.getContext('2d'), w = c.width, h = c.height, M = S.metrics;
  x.fillStyle = INKH; x.fillRect(0, 0, w, h);
  const top = h * .2, gap = h * .05; x.strokeStyle = 'rgba(239,234,219,.25)'; x.lineWidth = 1.5; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(w * .04, top + i * gap); x.lineTo(w * .96, top + i * gap); x.stroke() }
  x.fillStyle = 'rgba(239,234,219,.85)'; x.font = '700 54px Georgia,serif'; x.textAlign = 'left'; x.fillText('𝄞', w * .045, top + gap * 3.4);
  const cols = i => w * (.14 + i * .145), pts = [];
  rooms.forEach((r, i) => { const m = M[r.id], cx = cols(i), cy = top + gap * 4.6 - i * gap * .78, sz = m ? clamp(10 + ((m.duration || 5) / 6), 12, 24) : 8; pts.push({ cx, cy, sz, r, m }) });
  x.strokeStyle = LIMEH; x.lineWidth = 4; x.shadowColor = LIMEH; x.shadowBlur = 20; x.beginPath(); pts.forEach((p, i) => { if (i) { const q = pts[i - 1]; x.bezierCurveTo((q.cx + p.cx) / 2, q.cy, (q.cx + p.cx) / 2, p.cy, p.cx, p.cy) } else x.moveTo(p.cx, p.cy) }); x.stroke(); x.shadowBlur = 0;
  pts.forEach(p => { x.fillStyle = p.m ? LIMEH : '#3a3b2e'; x.shadowColor = LIMEH; x.shadowBlur = p.m ? 24 : 0; x.beginPath(); x.ellipse(p.cx, p.cy, p.sz * 1.2, p.sz * .9, -.3, 0, 6.283); x.fill(); x.shadowBlur = 0; x.fillStyle = 'rgba(239,234,219,.65)'; x.font = `italic 700 24px ${SERIF}`; x.textAlign = 'center'; x.fillText(p.r.note, p.cx, h * .5) });
  const my = h * .76, s = h * .1; pts.forEach(p => drawMotif(x, p.r.id, p.m, p.cx, my, s, p.m && !p.m.skipped ? LIMEH : '#efeadb'));
  x.fillStyle = 'rgba(239,234,219,.45)'; x.font = `italic 400 22px ${SERIF}`; x.textAlign = 'left'; x.fillText('Flauxus · la partitura de la huella · ' + entryLabel, w * .04, h * .95); x.textAlign = 'right'; x.fillText(new Date().toLocaleDateString('es-CO'), w * .96, h * .95)
}
$('downloadTrace').onclick = () => { const a = document.createElement('a'); a.download = 'flauxus-partitura-huella.png'; a.href = $('traceCanvas').toDataURL('image/png'); a.click() };
$('restart').onclick = () => location.href = location.pathname + location.search;

/* ======================================================================
   LOOP
   ====================================================================== */

/* ======================================================================
   HERRAMIENTAS DE DIRECCIÓN DE ARTE (solo con parámetro en la URL; no afectan al juego publicado)
   ?perf  → contador: fps, draw calls, triángulos, texturas, luces.
   ?light → panel para afinar la luz del escenario en vivo (+ botón «Copiar presets» → pegar en LIGHT_PRESETS).
   ?q=low → perfil de calidad móvil en escritorio · ?nomerge → desactiva la fusión de mallas (para comparar).
   ====================================================================== */
let perfEl = null; const pf = { t: 0, n: 0 };
if (qs.has('perf') || qs.has('light')) { perfEl = document.createElement('pre'); perfEl.style.cssText = 'position:fixed;left:8px;top:8px;z-index:90;margin:0;padding:6px 9px;font:11px/1.45 ui-monospace,Menlo,monospace;color:#c9d000;background:rgba(0,0,0,.65);border-radius:6px;pointer-events:none'; document.body.appendChild(perfEl); renderer.info.autoReset = false }
function perfTick(dt) {
  if (!perfEl) return; pf.n++; pf.t += dt; if (pf.t < .5) return;
  const i = renderer.info; let nl = 0; scene.traverseVisible(o => { if (o.isLight) nl++ });
  perfEl.textContent = `${Math.round(pf.n / pf.t)} fps · ${QUALITY.tier}\ncalls* ${i.render.calls} · tris ${(i.render.triangles / 1000).toFixed(0)}k\ngeom ${i.memory.geometries} · tex ${i.memory.textures} · prog ${i.programs?.length ?? '?'}\nluces ${nl} · sombra ${QUALITY.shadows ? 'sí' : 'blob'}\n* incluye pasadas de bloom`;
  pf.n = 0; pf.t = 0;
}
if (qs.has('light')) (async () => {
  try {
    const { default: GUI } = await import('https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/+esm');
    const gui = new GUI({ title: 'Luz del escenario' }), lm = lightingManager; let f = null;
    const hex = (o, k) => ({ get c() { return '#' + o[k].toString(16).padStart(6, '0') }, set c(v) { o[k] = parseInt(v.slice(1), 16); lm.configure() } });
    const num = (o, k, a, b, st, name) => f.add(o, k, a, b, st).name(name).onChange(() => lm.configure());
    const build = () => {
      f?.destroy(); const P = lm.P; f = gui.addFolder('Preset: ' + lm.id); f.open();
      num(P, 'exp', .3, 2, .01, 'exposición'); num(P, 'env', 0, 1.5, .01, 'IBL (relleno)'); num(P, 'fog', 0, .06, .001, 'niebla'); num(P, 'bloomT', .3, 1, .01, 'bloom umbral');
      num(P.hemi, '2', 0, 2, .01, 'hemisferio'); f.addColor(hex(P.hemi, 0), 'c').name('hemi cielo').onChange(() => lm.configure());
      num(P.key, 'i', 0, 4, .01, 'luz principal'); f.addColor(hex(P.key, 'c'), 'c').name('principal color').onChange(() => lm.configure());
      num(P.rim, 'k', 0, 30, .1, 'rim ganancia');
      P.pts.forEach((c, i) => { if (!lm.pts[i]) return; num(c, 'e', 0, 4, .01, 'punto ' + (i + 1) + ' e'); f.addColor(hex(c, 'c'), 'c').name('punto ' + (i + 1) + ' color').onChange(() => lm.configure()) });
      if (lm.spot) { num(P.spot, 'e', 0, 4, .01, 'foco e'); num(P.spot, 'ang', .2, 1.4, .01, 'foco ángulo'); num(P.spot, 'pen', 0, 1, .01, 'foco penumbra') }
    };
    lm.onApply = build; build();
    gui.add({ copiar() { const t = JSON.stringify(LIGHT_PRESETS); navigator.clipboard?.writeText(t); console.log(t) } }, 'copiar').name('Copiar presets (JSON)');
  } catch (e) { console.warn('Panel de luz no disponible', e) }
})();
/* Precarga escalonada: solo cuando el usuario ya entró al atrio, y solo una sala a la vez 
(async function preloadChain() {
  await sleep(6000);
  for (; ;) {
    if (S.phase === 'atrium') {
      const nextId = nextRoomId();
      if (nextId && assetManager.files[nextId] && !assetManager.cache.has(nextId)) {
        await assetManager.warm(nextId);
      }
      await sleep(4000);
    } else {
      await sleep(2000);
    }
  }
})();*/
const PR_MAX = renderer.getPixelRatio(); let prAvg = 16, prT = 0, prCool = 3;
function adaptRes(dt) { // resolución adaptativa: baja el pixel ratio si el frame time se dispara, lo recupera si hay margen
  prAvg += (dt * 1000 - prAvg) * Math.min(1, dt / 1.2); prCool -= dt; if (prCool > 0) return;
  const cur = renderer.getPixelRatio(); let nx = cur;
  if (prAvg > 24 && cur > .6) nx = Math.max(.6, cur - .15); else if (prAvg < 14.5 && cur < PR_MAX) nx = Math.min(PR_MAX, cur + .1);
  if (nx !== cur) { renderer.setPixelRatio(nx); composer?.setPixelRatio(nx); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); prCool = 3 }
}
let lastTime = performance.now();
function frame() {
  requestAnimationFrame(frame); if (perfEl) renderer.info.reset();
  roomsUpdate(); // refresca las referencias dinámicas de Rooms.js (W, H, S, ptr, etc.)
  GX.W = W; GX.H = H; GX.DPR = DPR; GX.T = T; GX.roomGen = roomGen; // actualiza GX cada frame
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, .05);
  lastTime = now;
  T += dt;
  camDt = dt; adaptRes(dt);
  BG.lerp(BGT, 1 - Math.exp(-3 * dt)); audioLevel();
  const wantJoy = TOUCH && (S.phase === 'atrium' || S.phase === 'prelude' || (S.phase === 'play' && S.room === 4)); if (document.body.classList.contains('joy-on') !== wantJoy) document.body.classList.toggle('joy-on', wantJoy);
  if (S.phase === 'atrium' || S.phase === 'intro' || S.phase === 'prelude') { updateAtrium(dt); if (S.phase === 'prelude') { updatePrelude(dt); if (bloom) bloom.strength = .45 } }
  else if (S.room && cur) { roomCamera(dt); cur.update3d?.(dt, T); lightingManager.update(avatarObj.position, dt, false); if (S.phase === 'play') { cur.update?.(dt); if (performance.now() - S.playStart > 45000) $('btnSkip').style.display = 'block' } }
  if (S.phase === 'atrium' && bloom) bloom.strength = .45;
  shakeAmt = Math.max(0, shakeAmt - dt * 30);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.save(); if (shakeAmt > .1) ctx.translate((Math.random() - .5) * shakeAmt, (Math.random() - .5) * shakeAmt);
  if (S.room && cur && S.phase === 'play' && cur.draw) cur.draw(); fxUpdate(dt); fxDraw(); ctx.restore();
  if (composer) composer.render(dt); else renderer.render(scene, camera);
  navVizUpdate(dt); perfTick(dt)
}

setRoomInfo('Atrio central', 'El museo imposible', 'Seis escaleras flotan alrededor del centro. Haz clic en el suelo para caminar y sigue la que late: cada una lleva a un momento distinto.'); renderProgress(); updateCam();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); resize2d() });
if (qs.has('debug')) window.__FLX = { NAV, navFloor, navPath, navNode, onAtriumLoaded, get stairGroups() { return stairGroups }, get navY() { return navY }, SPAWN, keys, placeAtSpawn, THREE, placeFBX, world, roomGroup, groundController, renderer, scene, lightingManager, assetManager, QUALITY, S, enterRoom, startGame, finish, rooms, player, get cur() { return cur } }; // solo para pruebas (?debug)

// Inyectar dependencias en NavMesh (rompe el ciclo circular NavMesh ↔ Main)
navInit({ player, vel, stairGroups, huellaMesh, S, scene, qs, clamp, stairLocal, setAtriumFBXObj, resetPlayerPhysics });

// Poblar el contexto compartido GX y arrancar Rooms.js
GX._set({
  renderer, S, roomGroup, avatarObj, camera, bloom, scene, mat, makeDust,
  glowSprite, makeTextSprite, animAvatar, rimSet, ctx2d: ctx, W, H, DPR,
  burst, ringFx, ftext, shake, glowCircle, bolt, toScreen,
  LIME, LIMEH, PAPER, SERIF, FONT, PALE, CARDS, OPLIST, HAND, EXPERIMENT,
  QUALITY,
  V3, clamp, lerp, damp, rand, lerpAngle, TOUCH, ptr, keys, ptrActive,
  hint, toast, finish, moveInput, groundController,
  roomGen, T, $
});
roomsInit();

frame();

export {
  $,
  clamp,
  lerp,
  damp,
  rand,
  sleep,
  lerpAngle,
  REDUCE,
  TOUCH,
  V3,
  LIME,
  LIMEH,
  PAPER,
  INKH,
  PALE,
  FONT,
  SERIF,
  EXPERIMENT,
  qs,
  ALIAS,
  entry,
  ENTRIES,
  entryLabel,
  CARDS,
  OPLIST,
  normCard,
  CARD_ALIAS,
  HAND,
  LS,
  seen,
  DEV_ENTRY_PICKER,
  rooms,
  S,
  skinKind,
  nextRoomId,
  T,
  LOWQ,
  QUALITY,
  SHADOW_R,
  BGC,
  scene,
  BG,
  BGT,
  camera,
  renderer,
  composer,
  bloom,
  hemi,
  key,
  rimL,
  world,
  roomGroup,
  LIGHT_PRESETS,
  LightingManager,
  lightingManager,
  addRoomLight,
  clearRoomLights,
  rimSet,
  clearGroup,
  mat,
  glowTex,
  GLOW,
  glowSprite,
  makeTextSprite,
  makeDust,
  cv,
  ctx,
  W,
  H,
  DPR,
  resize2d,
  FXP,
  FXR,
  FXT,
  shakeAmt,
  burst,
  ringFx,
  ftext,
  shake,
  fxUpdate,
  fxDraw,
  bolt,
  glowCircle,
  toScreen,
  toast,
  setRoomInfo,
  hint,
  renderProgress,
  fade,
  titleCard,
  ctlRow,
  avatar,
  avatarObj,
  setAvatar,
  animAvatar,
  GroundController,
  groundController,
  stairGroups,
  portalObjects,
  huellaTex,
  huellaCv,
  huellaMesh,
  atriumFloor,
  atriumFBXObj,
  STAIR_R0,
  makeStair,
  makeAtrium,
  drawMotif,
  paintHuella,
  GN,
  guide,
  dummy,
  rig,
  keys,
  player,
  vel,
  velY,
  isGrounded,
  stepPh,
  heading,
  GRAVITY,
  JUMP_FORCE,
  joy,
  joyMove,
  joyEl,
  joyEnd,
  moveInput,
  STEP,
  stairLocal,
  stairWorld,
  stairSurface,
  surfaceAt,
  GC,
  GM,
  GO,
  GRID,
  groundBlocked,
  buildGrid,
  gi,
  losClear,
  groundPath,
  stairUp,
  stairDown,
  auto,
  lookHold,
  navStuck,
  startAuto,
  stopAuto,
  walkTo,
  walkNext,
  gateWorld,
  nearestPortal,
  updateCam,
  guideT,
  guideFor,
  guidePts,
  guideLen,
  guideCum,
  updateAtrium,
  ptr,
  ptrActive,
  isUI,
  rcA,
  ndc,
  pickAtrium,
  clickToGo,
  hoverMark,
  clickMark,
  hoverT,
  hoverTick,
  lookEl,
  toggleHelp,
  cur,
  startGame,
  showUnlock,
  ROOM_MAP,
  roomParam,
  directRoom,
  tryEnter,
  GO_LABEL,
  noteRec,
  enterRoom,
  startRoom,
  PRELUDE,
  VO_TEXT,
  VO_FILES,
  TRIG_LABEL,
  VO,
  escH,
  voLoad,
  voStop,
  PRE,
  preBuild,
  initPrelude,
  updatePrelude,
  enterZone,
  roomFloor,
  hideRoomDom,
  finish,
  afterDone,
  leaveRoom,
  camCur,
  camLook,
  roomCamera,
  renderEntries,
  showEpilogue,
  drawTrace,
  perfEl,
  pf,
  perfTick,
  lastTime,
  frame
};

window.paintHuella = paintHuella;