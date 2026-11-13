/* ======================================================================
   FLAUXUS — AssetManager.js
   Carga, caché, optimización estática (merge) y disposición de modelos FBX
   ====================================================================== */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GX } from './GameContext.js';
import { qs } from './core/util.js';

/* Escenarios optimizados para la web (tools/optimizar-escenarios.mjs): mismos triángulos, geometría meshopt,
   texturas WebP; ~5× menos peso. Los .fbx de la raíz son los másters; ?fbx los carga para comparar. */
const USE_FBX = qs.has('fbx');
const scene = name => (USE_FBX ? `${name}.fbx` : `modelos/${name}.glb`);

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Destino del progreso de descarga de escenarios (ui/loader.js lo conecta). */
let progressSink = () => { };
export function setLoadProgress(fn) { progressSink = typeof fn === 'function' ? fn : () => { }; }

export class AssetManager {
  constructor() {
    this.loader = new FBXLoader();
    this.gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map();
    this.pending = new Map();
    this.matCache = new Map();
    this.failed = new Set(); // escenarios cuya descarga falló (el flujo ofrece reintentar)
    this.files = {
      atrium: scene('Atrio_nivel_completo_version_detallada'),
      1: scene('Nivel1_DO_El_sonido_bello_nivel_completo'),
      2: scene('Nivel2_RE_El_pulso_nivel_completo'),
      3: scene('Nivel3_MI_El_fraseo_nivel_completo'),
      4: scene('Nivel4_FAsostenido_El_cuerpo_nivel_completo'),
      5: scene('Nivel5_SOL_A_Terrazas'),
      6: scene('Nivel6_LAsostenido_Matar_al_padre_nivel_completo')
    };
  }
  /* carga única por archivo; devuelve un clon que comparte geometría y materiales */
  warm(key) {
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const file = this.files[key];
    if (!file) return Promise.resolve(null);
    const glb = file.endsWith('.glb');
    const p = new Promise(res => {
      this.failed.delete(key);
      (glb ? this.gltf : this.loader).load(
        new URL(file, document.baseURI).href,
        loaded => {
          const obj = glb ? loaded.scene : loaded;
          try { this.optimize(obj); } catch (e) { console.warn('optimize', key, e); }
          this.cache.set(key, obj);
          this.pending.delete(key);
          res(obj);
        },
        /* Progreso real de la descarga (bytes): el preloader lo muestra solo si el servidor informa el tamaño. */
        ev => { if (ev && ev.lengthComputable) progressSink(ev.loaded, ev.total); },
        err => {
          console.warn('Scene load error for', key, file, err);
          this.pending.delete(key);
          this.failed.add(key);
          res(null);
        }
      );
    });
    this.pending.set(key, p);
    return p;
  }
  load(key) {
    return this.warm(key).then(o => (o ? o.clone() : null));
  }
  optimize(obj) {
    obj.traverse(o => {
      if (o.isMesh) {
        o.geometry.userData.keep = true;
        o.frustumCulled = true;
      }
    });
    // Desactivado: clonar y combinar mallas complejas en JavaScript bloquea la CPU
    // if (GX.QUALITY.merge) this.mergeStatic(obj);
  }
  /* Fusiona mallas estáticas con el mismo material en celdas 3×3 (conserva algo de frustum culling). */
  mergeStatic(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root),
      size = box.getSize(new V3()),
      ctr = new V3(),
      inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map(),
      bb = new THREE.Box3();
    let before = 0;
    root.traverse(o => {
      if (
        !o.isMesh ||
        o.isSkinnedMesh ||
        o.isInstancedMesh ||
        !o.material ||
        Array.isArray(o.material) ||
        o.material.transparent ||
        o.geometry.morphAttributes?.position
      )
        return;
      before++;
      bb.setFromObject(o).getCenter(ctr);
      const cx = clamp(Math.floor(((ctr.x - box.min.x) / (size.x || 1)) * 3), 0, 2),
        cz = clamp(Math.floor(((ctr.z - box.min.z) / (size.z || 1)) * 3), 0, 2);
      const sig = Object.keys(o.geometry.attributes).sort().join(',') + (o.geometry.index ? 'i' : 'n');
      const k = o.material.uuid + '|' + cx + cz + '|' + sig;
      let a = groups.get(k);
      if (!a) groups.set(k, (a = { mat: o.material, list: [] }));
      a.list.push(o);
    });
    let after = 0;
    const rm = new THREE.Matrix4();
    groups.forEach(({ mat, list }) => {
      if (list.length < 2) {
        after += list.length;
        return;
      }
      const geos = list.map(m => {
        const g = m.geometry.clone();
        g.applyMatrix4(rm.multiplyMatrices(inv, m.matrixWorld));
        return g;
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      if (!merged) {
        after += list.length;
        return;
      }
      merged.userData.keep = true;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mm = new THREE.Mesh(merged, mat);
      mm.name = 'merged';
      mm.userData.merged = true;
      root.add(mm);
      after++;
      list.forEach(m => m.parent && m.parent.remove(m));
    });
    root.userData.mergeStats = { before, after };
  }
  fit(obj, targetRadius, centerY = 0) {
    const box = new THREE.Box3().setFromObject(obj),
      size = new V3(),
      center = new V3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      obj.scale.setScalar((targetRadius * 2) / maxDim);
      box.setFromObject(obj);
      box.getCenter(center);
      box.getSize(size);
    }
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= center.y - size.y / 2 - centerY;
    return obj;
  }
  capTex(t) {
    if (!t || t.userData.capped) return;
    t.userData.capped = true;
    t.userData.keep = true;
    const im = t.image,
      mx = GX.QUALITY.tex;
    if (!im || !im.width || (im.width <= mx && im.height <= mx)) return;
    try {
      const k = mx / Math.max(im.width, im.height),
        c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * k));
      c.height = Math.max(1, Math.round(im.height * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      t.image = c;
      t.needsUpdate = true;
    } catch (e) { }
  }
  /* Convierte los materiales del FBX a Standard CONSERVANDO el color/textura del artista */
  prepareMaterials(obj, opts = {}) {
    const okey = JSON.stringify(opts),
      aniso = Math.min(GX.QUALITY.aniso, GX.renderer.capabilities.getMaxAnisotropy());
    const lum = c => c.r * .299 + c.g * .587 + c.b * .114;
    obj.traverse(child => {
      if (!child.isMesh || !child.material) return;
      child.castShadow = false;
      child.receiveShadow = GX.QUALITY.shadows;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const out = mats.map(m => {
        if (m.userData.prepared) return m;
        const ck = m.uuid + '|' + okey,
          hit = this.matCache.get(ck);
        if (hit) return hit;
        if (m.map) {
          m.map.colorSpace = THREE.SRGBColorSpace;
          m.map.anisotropy = aniso;
          this.capTex(m.map);
        }
        if (m.normalMap) {
          m.normalMap.anisotropy = aniso;
          this.capTex(m.normalMap);
        }
        let col;
        if (m.map) col = new THREE.Color(opts.tint ?? 0xc9c5b6);
        else {
          col = m.color ? m.color.clone() : new THREE.Color(0x3a3c30);
          const l = lum(col);
          if (l > .7) col.multiplyScalar(.7 / l);
          if (l < .02) col.setHex(0x2a2c22);
        }
        const s = new THREE.MeshStandardMaterial({
          color: col,
          map: m.map || null,
          normalMap: m.normalMap || null,
          aoMap: m.aoMap || null,
          emissiveMap: m.emissiveMap || null,
          roughness: opts.roughness ?? .85,
          metalness: opts.metalness ?? .05,
          side: m.transparent || opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
          transparent: !!(m.transparent && m.opacity < .98),
          opacity: m.opacity ?? 1
        });
        // Conserva el signo de origen: glTF trae normalScale.y = -1 (convención de UV), FBX trae +1.
        if (m.normalMap) s.normalScale.set(1.2 * Math.sign(m.normalScale?.x || 1), 1.2 * Math.sign(m.normalScale?.y || 1));
        if (m.emissive) {
          const e = m.emissive,
            eLum = lum(e),
            sat = Math.abs(e.r - e.g) > .08 || Math.abs(e.g - e.b) > .08;
          if (sat && eLum > .05) {
            s.emissive = e.clone();
            s.emissiveIntensity = opts.emissiveIntensity ?? 1;
          }
        }
        s.userData.keep = s.userData.prepared = true;
        this.matCache.set(ck, s);
        return s;
      });
      child.material = Array.isArray(child.material) ? out : out[0];
    });
  }
}

export const assetManager = new AssetManager();
export function loadFBX(k) { return assetManager.load(k); }
export function fitFBX(o, r, y) { return assetManager.fit(o, r, y); }
export function prepareFBXMaterials(o, opts) { return assetManager.prepareMaterials(o, opts); }

/* Coloca un FBX: ajusta escala, prepara materiales, precompila shaders y recién entonces lo añade (sin tirones ni modelos "fantasma"
   si el usuario ya salió de la sala: `gen` invalida las cargas pendientes). */
export async function placeFBX(key, parent, radius, opts, gen) {
  const g0 = gen ? gen() : null,
    obj = await loadFBX(key);
  if (!obj || (gen && gen() !== g0)) return null;
  fitFBX(obj, radius, 0);
  prepareFBXMaterials(obj, opts);
  obj.updateMatrixWorld(true);
  obj.traverse(o => {
    if (o !== obj) o.matrixAutoUpdate = false;
  });
  // Se omite compileAsync para que los shaders se generen bajo demanda al renderizar
  if (gen && gen() !== g0) return null;
  parent.add(obj);
  if (parent === GX.roomGroup && GX.groundController) GX.groundController.roomObj = obj;
  if (GX.groundController) GX.groundController.reset();
  return obj;
}
