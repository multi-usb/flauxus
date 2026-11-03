/* ======================================================================
   FLAUXUS — engine/ground.js
   Controlador de suelo optimizado: altura de tarima fija inmediata
   en salas para 60 FPS estables sin coste de CPU ni vibraciones.
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
  }

  reset() {
    // No limpiar roomFloorY aquí: placeFBX llama a reset() durante la carga
  }

  clearRoom() {
    this.roomFloorY = null;
    this.roomObj = null;
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
      // 1. Prioridad: altura fijada explícitamente en el controlador
      if (this.roomFloorY !== null && this.roomFloorY !== undefined) {
        return this.roomFloorY;
      }

      // 2. Consulta directa a los metadatos de la sala activa
      if (S.room && rooms[S.room - 1]) {
        const r = rooms[S.room - 1];
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