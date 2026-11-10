/* ======================================================================
   FLAUXUS — ui/epilogue.js
   Partitura de la huella: resumen de las seis salas y descarga del PNG.
   ====================================================================== */
import { $, clamp, INKH, LIMEH, SERIF } from '../core/util.js';
import { S, rooms } from '../core/state.js';
import { entry, entryLabel, ENTRIES, seen } from '../core/config.js';
import { A, killBus, tone } from '../AudioSystem.js';
import { drawMotif } from '../rooms/motif.js';
import { hideRoomDom } from './hud.js';

export function renderEntries() {
  const keys = Object.keys(ENTRIES), n = keys.filter(k => seen.has(k)).length;
  $('epEntries').innerHTML = `<div class="eyebrow">Entradas descubiertas · ${n} de 4</div><div class="entrow">${keys.map(k => { const d = ENTRIES[k], on = seen.has(k); return `<div class="ent${on ? ' on' : ''}${k === entry ? ' now' : ''}"><b>${d.tag}</b><span>${on ? (d.skill || 'estado base') : 'por descubrir'}</span></div>` }).join('')}</div><p class="entnote">${n >= 4 ? 'Recorriste las cuatro puertas: cada una cambia la forma de jugar el mismo museo.' : 'Cada satélite —fanzine, afiche, baraja— abre una posibilidad distinta dentro del mismo museo. Vuelve a entrar desde otro para descubrirla.'}</p>`
}
export function showEpilogue(cur) {
  S.phase = 'epilogue'; renderEntries(); hideRoomDom(); cur?.stop?.(); killBus(); $('roomUI').classList.remove('active'); $('btnBack').style.display = 'none'; $('epilogue').classList.add('show');
  (document.fonts?.ready || Promise.resolve()).then(drawTrace); drawTrace();
  const mins = ((performance.now() - S.sessionStart) / 60000).toFixed(1); $('epSummary').textContent = `Recorrido: ${[...S.completed].map(i => rooms[i - 1].note).join(' → ')} · duración total: ${mins} min · ${entryLabel.toLowerCase()}`; tone(523.25, 1.2, 'sine', .06, 0, A.master)
}
export function drawTrace() {
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
/* «Rebobinar y empezar de nuevo»: el progreso solo vive en memoria, así que recargar ya lo deja todo en su estado
   inicial (nivel, avatar, cámara, HUD, escaleras). Se quita `?room=` para que el reinicio caiga siempre en la portada
   y el primer Momento, aunque se hubiera entrado por un acceso directo; el resto de parámetros (entrada, pruebas) sigue. */
$('restart').onclick = () => { const u = new URL(location.href); u.searchParams.delete('room'); u.hash = ''; dispatchEvent(new Event('flauxus:teardown')); location.replace(u.href) };
