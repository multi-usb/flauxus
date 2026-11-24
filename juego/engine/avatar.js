/* ======================================================================
   FLAUXUS — engine/avatar.js
   Avatares riggeados de `personaje/` sobre un contenedor estable.

   Cada versión carga su FBX `*_rig_Run.fbx`: es el rig profesional de la
   entrega, con skin weights, 66/28 huesos y texturas 2K incrustadas. Sobre
   ese rig se hornean los clips de `Idle.fbx` y `Walking.fbx` con
   `engine/skinning.js` (delta mundial, sin perder la pose de reposo).

   Los materiales se convierten a PBR (`MeshStandardMaterial`) usando el
   baseColor y el normalMap incrustados + los mapas de roughness/metallic
   de `texturas/`. La flauta aparece con un fundido al tocar (quieto en un
   minijuego o caminando), se coloca al frente con IK de dos huesos
   anclado a la cabeza y se desvanece al volver al idle. Los acentos del
   cyborg cuelgan de la columna.

   `avatarObj` nunca se reemplaza: GX, rooms/context.js, player.js y
   ui/prelude.js conservan la misma referencia durante toda la partida.
   ====================================================================== */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { LIME, clamp, damp } from '../core/util.js';
import { QUALITY } from '../core/config.js';
import { mat } from './materials.js';
import { scene } from './renderer.js';
import { A } from '../AudioSystem.js';
import { GX } from '../GameContext.js';
import { loadMixamo, prepareRig, bakeClips, applyFluteIK } from './skinning.js';

const V3 = THREE.Vector3;
const loader = new FBXLoader();
const texLoader = new THREE.TextureLoader();
/* Presupuesto de texturas de la avatar (core/config.js): 2048 px y anisotropía 8 en escritorio; 1024 px y
   anisotropía 2 en táctil. Cada rig trae cuatro mapas de 2048² (color, normal, rugosidad, metal): ~89 MB de
   memoria de GPU con mipmaps por traje. En un teléfono la avatar ocupa menos de 800 px de alto, así que a 1024²
   (~22 MB por traje) se ve igual y deja de presionar la memoria del navegador. */
const TEX_MAX = QUALITY.tex || 2048, ANISO = QUALITY.aniso || 8;

/* ======================================================================
   CATÁLOGO — rig profesional y mapas PBR
   ====================================================================== */
const AVATARS = {
  original: {
    rig: 'personaje/MC_original/MC_Original_rig_Run.fbx',
    tex: {
      roughness: 'personaje/MC_original/texturas/MC_Original_rig_Run_roughness.png',
      metalness: 'personaje/MC_original/texturas/MC_Original_rig_Run_metallic.png'
    }
  },
  body: {
    rig: 'personaje/MC_mtp/MC_MatarAlPadre_rig_Run.fbx',
    tex: {
      roughness: 'personaje/MC_mtp/texturas/MC_MatarAlPadre_rig_Run_roughness.png',
      metalness: 'personaje/MC_mtp/texturas/MC_MatarAlPadre_rig_Run_metallic.png'
    }
  },
  cyborg: {
    rig: 'personaje/MC_cyborg/MC_Cyborg_rig_Run.fbx',
    tex: {
      roughness: 'personaje/MC_cyborg/texturas/MC_Cyborg_rig_Run_roughness.png',
      metalness: 'personaje/MC_cyborg/texturas/MC_Cyborg_rig_Run_metallic.png'
    }
  }
};

/* Nombres heredados de las fichas de sala → versión canónica. */
const ALIAS = { disciplined: 'original', original: 'original', body: 'body', mtp: 'body', cyborg: 'cyborg' };
const versionOf = kind => ALIAS[kind] || 'original';

/* Ajustes PBR por versión. El roughness/metalness salen de los mapas; aquí
   solo se decide el detalle del normal y la respuesta al IBL. */
const PBR = {
  original: { normalScale: .9, envMapIntensity: 1.15 },
  body: { normalScale: .9, envMapIntensity: 1.0 },
  cyborg: { normalScale: 1.0, envMapIntensity: 1.25 }
};

/* ======================================================================
   FLAUTA — aparece al tocar (quieto en los minijuegos o caminando) y se
   desvanece al volver al idle. El extremo del bisel se ancla al punto de
   boca de la cabeza en cada frame, de modo que el bob, el vaivén y el nod
   de la interpretación no lo separan de los labios.

   El grupo se construye con el tubo centrado en X. La mano izquierda
   sujeta el bisel y la derecha baja por el tubo; ambas muñecas se colocan
   respecto del mismo grupo, así que los codos se acomodan solos cuando la
   boca mueve la flauta.
   ====================================================================== */
/* Punto de la boca en espacio local de `mixamorigHead`, medido sobre la
   malla: los labios quedan ~3 cm sobre el origen del hueso y ~10 cm por
   delante. El hueso tiene escala propia, así que este offset se transforma
   con su matriz y no se interpreta como centímetros visuales. */
const FLUTE_MOUTH_LOCAL = new V3(0, .030, .100);
/* Separación del centro del bisel respecto de la superficie de los labios:
   unos 2,5 cm hacia delante y 6 mm hacia abajo en espacio de la cabeza. El
   tubo tiene radio .022, así que su cara trasera roza el labio inferior sin
   atravesarlo. */
const FLUTE_MOUTH_GAP = new V3(0, -.004, .016);
/* El tubo mide .9 y está centrado en X: el bisel es el extremo +X. */
const FLUTE_NEAR_X = .45;
/* La boca no se apoya en el borde del bisel: entra .16 en el tubo, de modo
   que los labios quedan sobre la caña y el extremo +X sobresale 16 cm hacia
   la izquierda del personaje respecto de la boca. Antes eran .10; se amplió
   otros 6 cm para alejar la sección cercana a la boca del filo del extremo. */
const FLUTE_MOUTH_INSET = .16;
const FLUTE_MOUTH_X = FLUTE_NEAR_X - FLUTE_MOUTH_INSET;
/* Agarre en espacio local de la flauta (el grupo no rota). La mano
   izquierda sujeta el bisel y la derecha baja por el tubo. Al ampliar el
   inset, el tubo y las manos se desplazan juntos hacia la izquierda del
   personaje. La mano derecha, la más alejada de la cara, se corrió 3 cm
   más hacia el extremo del tubo (11 cm respecto de la pose original) y
   subió 1 cm: queda un poco más lejos del rostro y los dedos encuentran
   el tubo con la palma mirando hacia adelante. */
const FLUTE_GRIPS = { Left: [.38, -.175, -.01], Right: [.016, -.20, -.01] };
/* Respaldo si el rig no tuviera hueso de cabeza; la pose real se calcula
   desde la boca en cada frame. */
const FLUTE_PLAY_POS = new V3(-.40, 2.20, .15);
/* Los dedos apuntan en el plano YZ, perpendiculares al tubo. La mano
   izquierda los inclina hacia delante para agarrar el bisel; la derecha
   los lleva casi verticales: con la palma al frente, el tubo cae sobre
   las yemas y los dedos no lo tapan. */
const FLUTE_DIRS = { Left: [.12, .8, .58], Right: [-.12, .99, 0] };
/* Polos hacia abajo: los codos cuelgan junto al torso. El derecho, además,
   va apenas hacia adentro y adelante para que el brazo acompañe la mano
   sin abrirse como un ala. */
const FLUTE_POLES = { Left: [.75, -.62, -.18], Right: [-.25, -.96, .02] };
/* El cyborg lleva una chaqueta y un torso más anchos que el resto de los
   rigs. Con el polo común, el codo izquierdo se mete en la geometría del
   pecho al tocar. Este polo lo abre hacia +X (lado izquierdo) y lo lleva
   apenas hacia delante (+Z), sin sacar la mano del tubo ni cambiar la pose
   de los otros dos avatares. */
const FLUTE_POLES_CYBORG = { Left: [1.45, -.45, .2], Right: [-.25, -.96, .02] };
/* La mano derecha (la más alejada de la cara) gira hasta que la palma mira
   hacia adelante, en la misma dirección que el personaje. Los dedos quedan
   casi verticales, apoyados sobre el tubo, y el antebrazo acompaña el giro
   sin retorcer la muñeca. */
const FLUTE_ROLLS = { Left: 0, Right: -1.17 };
const FLUTE_NOD = .12;
const _flutePlay = new V3(), _mouth = new V3();
const _qNod = new THREE.Quaternion(), _xAxis = new V3(1, 0, 0);
const _fluteTargets = { Left: [0, 0, 0], Right: [0, 0, 0] };

/* ======================================================================
   CARGA — rig + texturas + horneado de clips, una vez por versión
   ====================================================================== */
const cache = new Map();

function loadVersion(version) {
  if (cache.has(version)) return cache.get(version);
  const p = Promise.allSettled([loadRigFBX(version), loadMixamo()]).then(([rigR, mixR]) => {
    if (rigR.status === 'rejected') throw rigR.reason;
    const rig = rigR.value;
    if (mixR.status === 'fulfilled') {
      try { bakeClips(rig, mixR.value); }
      catch (e) { console.warn('Avatar bake', version, e); }
    } else {
      console.warn('Avatar Mixamo', mixR.reason);
    }
    return rig;
  }).catch(err => {
    cache.delete(version);
    throw err;
  });
  cache.set(version, p);
  return p;
}

function loadRigFBX(version) {
  const spec = AVATARS[version];
  return new Promise((resolve, reject) => {
    loader.load(new URL(spec.rig, document.baseURI).href, async root => {
      try {
        const rig = prepareRig(root, 2.6);
        const maps = {};
        if (spec.tex.roughness) {
          maps.roughness = await loadTexture(spec.tex.roughness);
          maps.roughness.colorSpace = THREE.NoColorSpace;
          maps.roughness.wrapS = maps.roughness.wrapT = THREE.RepeatWrapping;
          maps.roughness.anisotropy = ANISO;
        }
        if (spec.tex.metalness) {
          maps.metalness = await loadTexture(spec.tex.metalness);
          maps.metalness.colorSpace = THREE.NoColorSpace;
          maps.metalness.wrapS = maps.metalness.wrapT = THREE.RepeatWrapping;
          maps.metalness.anisotropy = ANISO;
        }
        convertMaterials(root, version, maps);
        await waitTextures(root);
        fitTextures(root);
        rig.maps = maps;
        resolve(rig);
      } catch (e) { reject(e); }
    }, undefined, reject);
  });
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    texLoader.load(new URL(url, document.baseURI).href, resolve, undefined, reject);
  });
}

/* Los FBX traen baseColor + normalMap incrustados; los otros dos mapas
   vienen sueltos en `texturas/`. Se convierten a PBR sin duplicar texturas. */
function convertMaterials(root, version, maps) {
  const cfg = PBR[version] || PBR.original;
  const out = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const oldMats = Array.isArray(o.material) ? o.material : [o.material];
    const mats = oldMats.map(old => {
      const m = new THREE.MeshStandardMaterial({
        name: old.name || 'avatar',
        map: old.map || null,
        normalMap: old.normalMap || null,
        roughnessMap: maps.roughness || null,
        metalnessMap: maps.metalness || null,
        color: 0xffffff,
        roughness: 1,
        metalness: 1,
        normalScale: new THREE.Vector2(cfg.normalScale, cfg.normalScale),
        envMapIntensity: cfg.envMapIntensity,
        side: THREE.FrontSide
      });
      if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = ANISO; }
      if (m.normalMap) { m.normalMap.colorSpace = THREE.NoColorSpace; m.normalMap.anisotropy = ANISO; }
      if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
      if (m.metalnessMap) m.metalnessMap.colorSpace = THREE.NoColorSpace;
      m.needsUpdate = true;
      out.push(m);
      return m;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
  });
  return out;
}

/* FBXLoader entrega el scene antes de que terminen de decodificarse las
   texturas incrustadas. Se esperan para que el avatar no aparezca blanco. */
async function waitTextures(root, timeout = 4000) {
  const textures = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'specularMap']) {
        const t = m?.[key];
        if (t) textures.add(t);
      }
    }
  });
  const start = performance.now();
  for (const t of textures) {
    while (!t.image && performance.now() - start < timeout) await new Promise(r => setTimeout(r, 50));
    /* El navegador aplaza decode() si la pestaña no se está pintando (segundo plano): con un tope de 1,2 s
       la carga no se queda esperando; la textura termina de decodificarse al dibujarse. */
    if (t.image?.decode) await Promise.race([t.image.decode().catch(() => { }), new Promise(r => setTimeout(r, 1200))]);
  }
}

/* Reduce en la carga los mapas que superan el presupuesto del nivel de calidad (`TEX_MAX`). Se hace antes del
   primer dibujo: la GPU solo recibe la versión reducida. Si una imagen aún no terminó de decodificarse se deja
   como está (se verá a su tamaño original). */
function fitTextures(root) {
  const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
      const t = m?.[key], img = t?.image;
      if (!t || seen.has(t)) continue; seen.add(t);
      const w = img?.naturalWidth || img?.width || 0, h = img?.naturalHeight || img?.height || 0;
      if (!w || !h || Math.max(w, h) <= TEX_MAX || (img.complete === false)) continue;
      const k = TEX_MAX / Math.max(w, h), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
      t.image = c; t.needsUpdate = true;
    }
  });
}

/* Clona el rig para cada avatar: geometría, materiales y texturas se
   comparten; los huesos y el Skeleton son nuevos para poder animarlos. */
function instantiate(rig) {
  const root = cloneSkeleton(rig.root);
  root.updateMatrixWorld(true);
  let mesh = null;
  root.traverse(o => { if (!mesh && o.isSkinnedMesh) mesh = o; });
  const bones = new Map();
  root.traverse(o => { if (o.isBone) bones.set(o.name, o); });
  return { root, mesh, skeleton: mesh.skeleton, bones };
}

/* ======================================================================
   PIEZAS PROCEDURALES — placeholder, flauta y acentos del cyborg
   ====================================================================== */
function buildPlaceholder(version, glowMat) {
  const g = new THREE.Group(), cy = version === 'cyborg';
  const bodyMat = mat(cy ? 0x24261f : 0x3a3930, { roughness: .9, metalness: cy ? .4 : .05 });
  const skinMat = mat(cy ? 0xd6c8b6 : 0xe0c2a6, { roughness: .85, metalness: cy ? .2 : 0 });
  const pantsMat = mat(cy ? 0x282b23 : 0x56513f, { roughness: .95, metalness: 0 });
  const bootMat = mat(cy ? 0x151713 : 0x24231e, { roughness: .9, metalness: cy ? .3 : .05 });
  const M = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = false; g.add(o); return o; };
  const torso = M(new THREE.CapsuleGeometry(.34, .62, 4, 12), bodyMat, 0, 1.38, 0); torso.scale.set(1, .98, .95);
  M(new THREE.SphereGeometry(.29, 16, 12), skinMat, 0, 2.26, 0);
  M(new THREE.SphereGeometry(.24, 12, 8), bodyMat, 0, 1.72, 0);
  const mkArm = side => { const p = new THREE.Group(); p.position.set(side * .42, 1.8, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .62, 4, 8), skinMat); a.position.y = -.38; p.add(a); g.add(p); };
  mkArm(-1); mkArm(1);
  const mkLeg = side => {
    const p = new THREE.Group(); p.position.set(side * .17, .98, 0);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .68, 4, 8), pantsMat); l.position.y = -.36; p.add(l);
    const b = new THREE.Mesh(new THREE.BoxGeometry(.22, .2, .34), bootMat); b.position.set(0, -.88, .06); p.add(b); g.add(p);
  };
  mkLeg(-1); mkLeg(1);
  if (cy) {
    const orb = new THREE.SphereGeometry(.06, 10, 8);
    for (const x of [-.28, .28]) { const o = new THREE.Mesh(orb, glowMat); o.position.set(x, 1.98, .02); g.add(o); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.15, .012, 6, 24), glowMat); ring.position.set(0, 1.58, .14); g.add(ring);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(.27, .01, 6, 28), glowMat); belt.rotation.x = Math.PI / 2; belt.position.y = 1.26; g.add(belt);
    const antenna = new THREE.Mesh(new THREE.ConeGeometry(.035, .16, 6), glowMat); antenna.position.set(0, 2.58, -.02); g.add(antenna);
  }
  return g;
}

function buildCyber(glowMat) {
  /* Acentos del cyborg ajustados al torso del rig. Se cuelgan de spine2
     para que sigan el torso animado. */
  const g = new THREE.Group();
  const add = (geo, x, y, z) => {
    const o = new THREE.Mesh(geo, glowMat); o.position.set(x, y, z); o.castShadow = false; g.add(o); return o;
  };
  const orb = new THREE.SphereGeometry(.03, 10, 8);
  add(orb, -.21, 1.97, .1); add(orb, .21, 1.97, .1);
  add(new THREE.SphereGeometry(.028, 10, 8), 0, 1.62, .17);
  return g;
}

function buildFlute() {
  /* Construida alrededor del origen; el grupo se recoloca cada frame en la
     pose de interpretación. Arranca invisible y opaca: el fundido lo lleva
     el material compartido del tubo y las llaves. */
  const g = new THREE.Group();
  const fm = new THREE.MeshStandardMaterial({ color: 0xd8d8c8, metalness: .85, roughness: .22, transparent: true, opacity: 0, depthWrite: false });
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, fm); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = false; g.add(o); return o;
  };
  add(new THREE.CylinderGeometry(.022, .022, .9, 10), 0, 0, 0, 0, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(.07, .03, .035), .12, .01, .02);
  const key = new THREE.CylinderGeometry(.018, .018, .012, 8);
  for (const x of [-.3, -.16, -.02, .12, .26]) add(key, x, -.015, .02, Math.PI / 2, 0, 0);
  g.position.copy(FLUTE_PLAY_POS);
  g.visible = false;
  g.userData.mat = fm;
  return g;
}

function disposeGroup(g, keepMat) {
  g.traverse(o => {
    if (!o.isMesh) return;
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && m !== keepMat) m.dispose?.();
  });
}

/* Devuelve las articulaciones al contenedor raíz antes de cambiar de malla:
   si quedaran dentro del esqueleto viejo, desaparecerían con él. */
function resetJoints(u) {
  const root = u.visual.parent;
  if (!root) return;
  for (const j of Object.values(u.joints)) root.add(j);
  u.joints.head.position.set(0, 2.36, 0);
  u.joints.wl.position.set(-.48, 1.03, 0);
  u.joints.wr.position.set(.48, 1.03, 0);
}

function clearVisual(u) {
  resetJoints(u);
  if (u.mixer) { u.mixer.stopAllAction(); if (u.rig) u.mixer.uncacheRoot(u.rig); u.mixer = null; }
  u.actions = null;
  if (u.flute) { u.visual.remove(u.flute); disposeGroup(u.flute); u.flute = null; }
  if (u.cyber) { u.cyber.parent?.remove(u.cyber); disposeGroup(u.cyber, u.glowMat); u.cyber = null; }
  if (u.placeholder) { u.visual.remove(u.placeholder); disposeGroup(u.placeholder, u.glowMat); u.placeholder = null; }
  if (u.rig) {
    /* Cada instancia del rig tiene su propio Skeleton, y cada Skeleton su textura de huesos en la GPU. Al cambiar
       de traje (salas FA♯, SOL♯ y LA♯) esa textura quedaba huérfana: +2 texturas por visita. Se libera aquí;
       geometría, materiales y mapas son los del rig en caché y se conservan. */
    u.rig.traverse(o => { if (o.isSkinnedMesh) o.skeleton?.dispose?.(); });
    u.visual.remove(u.rig); u.rig = null;
  }
  u.mesh = null; u.bones = null; u.template = null; u.skeleton = null;
}

function showPlaceholder(u, version) {
  clearVisual(u);
  u.version = version; u.cy = version === 'cyborg'; u.loaded = false;
  u.placeholder = buildPlaceholder(version, u.glowMat);
  u.visual.add(u.placeholder);
}

/* Las articulaciones que lee SOL se cuelgan de los huesos reales: así el
   seguimiento de manos y cabeza sale gratis del esqueleto animado. */
function attachJoints(u, bones) {
  const handL = bones.get('mixamorigLeftHand');
  const handR = bones.get('mixamorigRightHand');
  const head = bones.get('mixamorigHead');
  const scaleOf = b => (b.getWorldScale(new V3()).x || 1);
  if (handL) { handL.add(u.joints.wl); u.joints.wl.position.set(0, .06 / scaleOf(handL), 0); }
  if (handR) { handR.add(u.joints.wr); u.joints.wr.position.set(0, .06 / scaleOf(handR), 0); }
  if (head) { head.add(u.joints.head); u.joints.head.position.set(0, .18 / scaleOf(head), 0); }
}

function attachCyber(u, bones) {
  const spine = bones.get('mixamorigSpine2') || bones.get('mixamorigSpine1') || bones.get('mixamorigSpine');
  if (!spine) return;
  const g = buildCyber(u.glowMat);
  u.visual.updateMatrixWorld(true);
  const s = spine.getWorldScale(new V3()).x || 1;
  /* Las piezas se diseñaron en coordenadas de la malla; se convierten al
     espacio local del hueso y se compensa la escala del rig (100×). */
  for (const child of g.children) {
    const p = child.position.clone();
    u.visual.localToWorld(p);
    spine.worldToLocal(p);
    child.position.copy(p);
    child.scale.setScalar(1 / s);
  }
  spine.add(g);
  u.cyber = g;
}

function applyVersion(u, version, rig) {
  clearVisual(u);
  u.version = version; u.cy = version === 'cyborg';
  const inst = instantiate(rig);
  u.visual.add(inst.root);
  u.rig = inst.root; u.mesh = inst.mesh; u.skeleton = inst.skeleton;
  u.bones = inst.bones; u.template = rig.template;
  u.mesh.castShadow = true; u.mesh.receiveShadow = true; u.mesh.frustumCulled = false;

  if (rig.clips) {
    const mixer = new THREE.AnimationMixer(inst.root);
    const actions = {
      idle: mixer.clipAction(rig.clips.idle),
      walk: mixer.clipAction(rig.clips.walk)
    };
    actions.idle.setLoop(THREE.LoopRepeat, Infinity);
    actions.walk.setLoop(THREE.LoopRepeat, Infinity);
    actions.idle.play(); actions.walk.play();
    actions.idle.setEffectiveWeight(1); actions.walk.setEffectiveWeight(0);
    u.mixer = mixer; u.actions = actions; u.idleW = 1; u.walkW = 0;
  }

  u.flute = buildFlute(); u.visual.add(u.flute);
  if (u.cy) attachCyber(u, inst.bones);
  attachJoints(u, inst.bones);
  u.loaded = true;
  u.visual.parent?.updateMatrixWorld(true);
}

/* ======================================================================
   RAÍZ ESTABLE
   ====================================================================== */
function makeRoot() {
  const root = new THREE.Group();
  const visual = new THREE.Group(); root.add(visual);
  const joints = { wl: new THREE.Object3D(), wr: new THREE.Object3D(), head: new THREE.Object3D() };
  joints.head.position.set(0, 2.36, 0);
  joints.wl.position.set(-.48, 1.03, 0);
  joints.wr.position.set(.48, 1.03, 0);
  for (const j of Object.values(joints)) root.add(j);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xf4f7cf, emissive: LIME, emissiveIntensity: 1.5, roughness: .3, metalness: .5 });
  const u = root.userData = {
    visual, joints, glowMat,
    mode: 'idle', flautaBlend: 0, lastT: 0,
    version: null, loaded: false, loading: null, gen: 0, cy: false,
    placeholder: null, rig: null, mesh: null, flute: null, cyber: null,
    mixer: null, actions: null, bones: null, template: null, skeleton: null,
    idleW: 1, walkW: 0,
    glowBase: 1.1, body: visual, armL: joints.wl, armR: joints.wr, legL: null, legR: null
  };
  return root;
}

function loadInto(root, kind) {
  const version = versionOf(kind), u = root.userData;
  if (u.version === version && u.loaded) return Promise.resolve(root);
  if (u.version === version && u.loading) return u.loading;
  const gen = ++u.gen;
  u.version = version; u.loading = null; u.loaded = false; u.cy = version === 'cyborg';
  showPlaceholder(u, version);
  const p = loadVersion(version).then(rig => {
    if (u.gen !== gen) return root;
    applyVersion(u, version, rig);
    u.loading = null;
    return root;
  }).catch(err => {
    console.warn('Avatar', version, err);
    if (u.gen === gen) u.loading = null;
    return root;
  });
  u.loading = p;
  return p;
}

export let avatarObj = makeRoot();
scene.add(avatarObj);

/** Crea un avatar independiente (poco usado: el juego comparte avatarObj). */
export function avatar(kind) { const root = makeRoot(); loadInto(root, kind); return root; }

/** Cambia la versión conservando la misma raíz y devuelve una promesa. */
export function setAvatar(kind) {
  const p = loadInto(avatarObj, kind);
  GX.avatarObj = avatarObj;
  return p;
}

loadInto(avatarObj, 'disciplined'); // precarga la versión del atrio

/* ======================================================================
   ANIMACIÓN
   La caminata mantiene las piernas del clip `walk` con el timeScale
   reducido (paso visual más pausado, misma velocidad real). Brazos y
   flauta se resuelven aparte con IK sobre la boca. Quieto se usa idle y,
   en los minijuegos, la misma pose de flauta.
   ====================================================================== */
export function animAvatar(av, sp, t, play = false, air = 0) {
  const u = av?.userData;
  if (!u || !u.visual) return;
  const dt = clamp((t - (u.lastT || 0)) || .016, .001, .1);
  u.lastT = t;
  const speed = Math.abs(sp) || 0;
  const walking = speed > .45;
  const mode = walking ? 'walk' : (play ? 'flauta' : 'idle');
  u.mode = mode;
  /* Caminar también es tocar: las piernas siguen el clip walk, pero la
     flauta sube a la boca y los brazos pasan a IK. */
  const fluteOn = play || walking;

  const k = clamp(speed / 6, 0, 1), br = clamp(air, 0, 1);

  if (u.loaded && u.mixer && u.actions) {
    const wantWalk = walking ? 1 : 0;
    u.walkW = damp(u.walkW, wantWalk, 8, dt);
    u.idleW = 1 - u.walkW;
    u.actions.walk.setEffectiveWeight(u.walkW);
    u.actions.idle.setEffectiveWeight(u.idleW);
    /* El ciclo Mixamo mide 0,967 s y avanza ~2,1 m por vuelta a escala 1.
       Antes se reproducía a ~1,8× a 6,2 m/s; ahora va ~1,5× para que el
       paso se vea más pausado. La velocidad del jugador no se toca. */
    u.actions.walk.timeScale = clamp(speed / 4.2, .75, 2.0);
    u.mixer.update(dt);
  }

  /* Balanceo del contenedor: el esqueleto ya anima el cuerpo; aquí solo
     queda una inclinación mínima para dar peso al paso. */
  if (mode === 'walk') {
    u.visual.rotation.x = .02 * k;
    u.visual.rotation.z = Math.sin(t * 4.4) * .012 * k;
  } else if (mode === 'flauta') {
    u.visual.rotation.x = 0;
    u.visual.rotation.z = Math.sin(t * 1.1) * .01;
  } else {
    u.visual.rotation.x = 0;
    u.visual.rotation.z = Math.sin(t * 1.1) * .006;
  }
  u.visual.position.y = 0;
  u.visual.scale.set(1 + br * .012, 1 + br * .008, 1 + br * .012);

  /* Las matrices deben reflejar la pose del mixer antes de que el IK lea
     posiciones mundiales de hombros y muñecas. El rig tiene la armature
     como hermana del mesh, así que se actualiza desde la raíz del avatar. */
  if (u.rig) u.visual.parent?.updateMatrixWorld(true);

  /* El fundido se calcula antes del nod de cabeza: el nod se aplica ya
     ponderado y el punto de boca que se usa como ancla incluye esa
     inclinación. */
  u.flautaBlend = damp(u.flautaBlend, fluteOn ? 1 : 0, 12, dt);
  const b = u.flautaBlend;
  const head = u.bones?.get('mixamorigHead');

  /* Nod de interpretación: se aplica sobre la pose del mixer, antes de
     leer la boca, para que el ancla siga también la rotación de la cabeza.
     Antes se aplicaba al final del IK y la flauta no lo acompañaba. */
  if (head && b > .001) {
    _qNod.setFromAxisAngle(_xAxis, FLUTE_NOD * b);
    head.quaternion.multiply(_qNod);
    head.updateWorldMatrix(true, false);
  }

  if (u.flute) {
    /* Extremo del bisel anclado a la boca: se toma el punto de boca en
       espacio local de la cabeza, se pasa a espacio visual y se desplaza el
       grupo para que su extremo +X caiga exactamente ahí. No hay bob propio
       de la flauta: el movimiento lo aporta la cabeza y el tubo no se
       separa de los labios. */
    if (head) {
      _mouth.copy(FLUTE_MOUTH_LOCAL).add(FLUTE_MOUTH_GAP).applyMatrix4(head.matrixWorld);
      u.visual.worldToLocal(_mouth);
      _flutePlay.copy(_mouth);
      /* La boca se ancla .16 dentro del tubo (no en el filo del bisel):
         los labios apoyan sobre la caña y el extremo queda libre. */
      _flutePlay.x -= FLUTE_MOUTH_X;
      u.flute.position.copy(_flutePlay);
    } else {
      u.flute.position.copy(FLUTE_PLAY_POS);
    }
    u.flute.quaternion.identity();
    u.flute.visible = b > .004;
    const fm = u.flute.userData.mat;
    if (fm) {
      const transparent = b < .995;
      fm.opacity = b;
      fm.depthWrite = !transparent;
      if (fm.transparent !== transparent) { fm.transparent = transparent; fm.needsUpdate = true; }
    }

    /* Los targets IK se cuelgan del mismo grupo: al moverse el bisel con la
       boca, las muñecas se recolocan y los codos se acomodan solos. */
    for (const side of ['Left', 'Right']) {
      const g = FLUTE_GRIPS[side], tg = _fluteTargets[side];
      tg[0] = u.flute.position.x + g[0];
      tg[1] = u.flute.position.y + g[1];
      tg[2] = u.flute.position.z + g[2];
    }
  }

  if (u.loaded && u.bones && u.template && u.flute && b > .001) {
    /* El cyborg usa un polo de codo propio para que el brazo izquierdo no
       se hunda en la chaqueta; el resto conserva la pose ya aprobada. */
    const poles = u.cy ? FLUTE_POLES_CYBORG : FLUTE_POLES;
    applyFluteIK(u, b, _fluteTargets, FLUTE_DIRS, poles, FLUTE_ROLLS, u.flute.position);
    u.visual.parent?.updateMatrixWorld(true);
  }

  if (u.glowMat) u.glowMat.emissiveIntensity = (u.glowBase ?? 1.1) + clamp(A.lvl || 0, 0, 2) * 2.6 + k * .8;
}
