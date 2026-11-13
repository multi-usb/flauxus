/* ======================================================================
   FLAUXUS — rooms/motif.js
   Dibujo común de los motivos de la huella. Cada sala aporta su forma
   desde `meta.motif`; aquí solo se prepara el canvas y el estado vacío.
   ====================================================================== */
import { ROOMS } from '../Rooms.js';

export function drawMotif(x, id, m, cx, cy, s, color) {
  x.save(); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = Math.max(2, s * .05); x.lineCap = 'round';
  if (!m || m.skipped) { x.globalAlpha = .3; x.strokeRect(cx - s * .6, cy - s * .4, s * 1.2, s * .8); x.restore(); return }
  const r = ROOMS[id - 1];
  if (r?.motif) r.motif(x, m, cx, cy, s);
  x.restore()
}
