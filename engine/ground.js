/* ======================================================================
   FLAUXUS — engine/ground.js
   Controlador de suelo: altura de tarima fija inmediata en las salas
   planas, mapa de alturas precalculado en las salas con relieves (RE) y
   muestreo del propio FBX en las salas con terrazas (`floorRay`).
   El mapa y el muestreo usan caché: no se lanzan rayos cada frame.
   ====================================================================== */
import * as THREE from 'three';
import { S, rooms } from '../core/state.js';

export class GroundController {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.down = new THREE.Vector3(0, -1, 0);
    this.origin = new THREE.Vector3();
    this.raycaster.far = 12.0;
    this.surfaceAt = null; // inyectado por player.js (rampas del atrio)
    this.roomObj = null;
    this.roomFloorY = null; // Altura de tarima directa inyectada por flow.js
    /* Caché del suelo muestreado del FBX de la sala. Se guarda la última
       posición consultada para no lanzar un rayo contra la malla en cada
       frame mientras el avatar está quieto. */
    this.roomSample = { obj: null, x: NaN, z: NaN, y: null };
    /* Mapa de alturas precalculado para salas con relieves (RE). Sustituye
       los raycasts de `roomHeight` por una lectura O(1) de cuatro celdas. */
    this.roomMap = null;
  }

  reset() {
    // No limpiar roomFloorY aquí: placeFBX llama a reset() durante la carga
    this.roomSample.obj = null; // el escenario puede haber cambiado
    this.roomSample.y = null;
    this.roomMap = null;        // cada carga de sala construye su propio mapa
  }

  clearRoom() {
    this.roomFloorY = null;
    this.roomObj = null;
    this.roomSample.obj = null;
    this.roomSample.y = null;
    this.roomMap = null;
  }

  /* ======================================================================
     MAPA DE ALTURAS PRECALCULADO (salas con relieves, p. ej. RE)
     Rasteriza una sola vez las caras pisables del FBX en una grilla XZ.
     El coste (~0,1 s en RE) queda oculto por el preloader; durante el juego
     cada consulta lee cuatro celdas, sin raycasts ni asignaciones.
     Solo entran caras orientadas hacia arriba y dentro del rango vertical
     útil: así quedan fuera paredes, columnas altas y techos.
     ====================================================================== */
  buildRoomMap(obj, { cell = .1, radius = 12.5, baseY = 1.8, below = 1.2, above = 2.2 } = {}) {
    this.roomMap = null;
    if (!obj) return null;
    obj.updateMatrixWorld(true);
    const R = radius, N = Math.ceil(2 * R / cell) + 1;
    const arr = new Float32Array(N * N).fill(NaN);
    const minY = baseY - below, maxY = baseY + above;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

    obj.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const pos = o.geometry.attributes.position;
      if (!pos) return;
      const idx = o.geometry.index;
      const count = idx ? idx.count : pos.count;
      const m = o.matrixWorld;

      for (let i = 0; i < count; i += 3) {
        const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(m);
        b.fromBufferAttribute(pos, ib).applyMatrix4(m);
        c.fromBufferAttribute(pos, ic).applyMatrix4(m);

        const ymin = Math.min(a.y, b.y, c.y), ymax = Math.max(a.y, b.y, c.y);
        if (ymax < minY || ymin > maxY) continue;

        /* Normal de la cara: se descartan las verticales (paredes, cantos). */
        const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
        const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
        const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nl < 1e-9 || ny / nl < .2) continue;

        const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) + R) / cell));
        const i1 = Math.min(N - 1, Math.ceil((Math.max(a.x, b.x, c.x) + R) / cell));
        const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) + R) / cell));
        const j1 = Math.min(N - 1, Math.ceil((Math.max(a.z, b.z, c.z) + R) / cell));
        const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(d) < 1e-12) continue;

        /* Rasteriza el triángulo proyectado en XZ y conserva la cota más alta
           de cada celda (la superficie que pisaría el avatar). */
        for (let j = j0; j <= j1; j++) {
          const z = -R + (j + .5) * cell;
          for (let k = i0; k <= i1; k++) {
            const x = -R + (k + .5) * cell;
            const w0 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
            const w1 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
            const w2 = 1 - w0 - w1;
            if (w0 < -.001 || w1 < -.001 || w2 < -.001) continue;
            const y = w0 * a.y + w1 * b.y + w2 * c.y;
            if (y < minY || y > maxY) continue;
            const oi = j * N + k;
            if (Number.isNaN(arr[oi]) || y > arr[oi]) arr[oi] = y;
          }
        }
      }
    });

    this.roomMap = { obj, arr, N, R, cell };
    this.roomSample.obj = null;
    this.roomSample.y = null;
    return this.roomMap;
  }

  /* Consulta O(1) del mapa: apoya el avatar en la celda más alta de las
     cuatro vecinas (evita que los pies entren en el canto de un relieve).
     El suavizado vertical de `player.js` convierte ese apoyo en una rampa
     visual, así que no hay saltos. Devuelve null si no hay datos. */
  roomMapHeight(x, z) {
    const m = this.roomMap;
    if (!m) return null;
    const fx = (x + m.R) / m.cell - .5, fz = (z + m.R) / m.cell - .5;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= m.N - 1 || j >= m.N - 1) return null;
    const a = m.arr, N = m.N, k = j * N + i;
    let y = -Infinity, v = a[k]; if (v > y) y = v;
    v = a[k + 1]; if (v > y) y = v;
    v = a[k + N]; if (v > y) y = v;
    v = a[k + N + 1]; if (v > y) y = v;
    return y === -Infinity ? null : y;
  }

  /* Escalón máximo sobre el mapa de alturas. El mapa guarda la cota más alta de cada celda sin mirar desde
     dónde se llega: sin este límite la avatar «subía» de un paso a un banco de 1,05 m desde la tarima de
     0,23 m (el rayo anterior solo aceptaba superficies hasta 55 cm por encima de la altura actual). El
     movimiento del preludio (player.js) trata como obstáculo la celda que queda más alta que eso. */
  roomStepBlocked(x, z, y, max = .55) {
    if (!this.roomMap || this.roomMap.obj !== this.roomObj) return false;
    const h = this.roomMapHeight(x, z);
    return h !== null && h > y + max;
  }

  /* Altura real del escenario de una sala con terrazas. Solo se usa cuando
     la sala declara `floorRay: true` en sus metadatos; las salas planas
     siguen con la altura fija de siempre (coste cero).
     - El rayo nace 1,6 m sobre el avatar y solo acepta superficies que se
       puedan pisar (hasta 55 cm por encima de la altura actual): así no
       "sube" a techos, barandas altas ni al núcleo flotante de SOL.
     - Se recalcula cada 25 cm de desplazamiento; entre muestra y muestra se
       reutiliza la altura, que es lo que evita el raycast por frame. */
  roomHeight(x, z, currentY) {
    const obj = this.roomObj;
    if (!obj) return null;
    const c = this.roomSample;
    if (c.obj !== obj) { c.obj = obj; c.x = NaN; c.z = NaN; c.y = null }
    const dx = x - c.x, dz = z - c.z;
    if (c.y !== null && dx * dx + dz * dz < .0625) return c.y;
    this.origin.set(x, currentY + 1.6, z);
    this.raycaster.set(this.origin, this.down);
    const hits = this.raycaster.intersectObject(obj, true);
    let best = null;
    for (const h of hits) {
      const y = h.point.y;
      if (y <= currentY + .55 && (best === null || y > best)) best = y;
    }
    c.x = x; c.z = z; c.y = best;
    return best;
  }

  getHeight(x, z, currentY, isAtrium) {
    if (isAtrium) {
      const sa = this.surfaceAt?.(x, z, currentY);
      if (sa && !sa.blocked) return sa.y;
      if (x * x + z * z < 28) return 2.42;
      if (atriumFBXObj) {
        this.origin.set(x, currentY + 1.8, z);
        this.raycaster.set(this.origin, this.down);
        const hits = this.raycaster.intersectObject(atriumFBXObj, true);
        let bestY = -Infinity;
        for (const h of hits) {
          if (h.point.y <= currentY + 0.65 && h.point.y > bestY) bestY = h.point.y;
        }
        if (bestY > -100) return bestY;
      }
      return (x * x + z * z < 28) ? 2.42 : 1.10;
    } else {
      const r = S.room ? rooms[S.room - 1] : null;

      // 0. Mapa precalculado (RE): contacto con los relieves del piso sin
      //    lanzar rayos. Se invalida solo si cambió la sala.
      if (this.roomMap && this.roomMap.obj === this.roomObj) {
        const h = this.roomMapHeight(x, z);
        if (h !== null) return h;
      }

      // 0b. Salas con terrazas: la altura sale del propio escenario para
      //     que el avatar suba y baje con la espiral en vez de usar una
      //     tarima plana que lo deja flotando o hundido.
      if (r?.floorRay) {
        const h = this.roomHeight(x, z, currentY);
        if (h !== null) return h;
      }

      // 1. Prioridad: altura fijada explícitamente en el controlador
      if (this.roomFloorY !== null && this.roomFloorY !== undefined) {
        return this.roomFloorY;
      }

      // 2. Consulta directa a los metadatos de la sala activa
      if (r) {
        const fy = r.floorY ?? r.start?.y;
        if (fy !== undefined && fy !== null) {
          this.roomFloorY = fy;
          return fy;
        }
      }

      // 3. Fallback
      return currentY > 1.0 ? currentY : 2.42;
    }
  }
}

export const groundController = new GroundController();

let atriumFBXObj = null;
export function setAtriumFBXObj(obj) { atriumFBXObj = obj; }
export function getAtriumFBXObj() { return atriumFBXObj; }