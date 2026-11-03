/* ======================================================================
   FLAUXUS — ui/hud.js
   HUD común: fichas de sala, progreso, avisos y transiciones. No conoce
   el flujo de juego ni el movimiento: solo pinta lo que le piden.
   ====================================================================== */
import { $, TOUCH } from '../core/util.js';
import { S, rooms, nextRoomId } from '../core/state.js';
import { voStop } from './voice.js';

export { toast } from './toast.js';

export function hideRoomDom() { voStop(); $('miUI').style.display = 'none'; $('laUI').style.display = 'none'; $('brief').classList.remove('show'); $('done').classList.remove('show'); $('btnSkip').style.display = 'none' }

export function setRoomInfo(k, t, d) { $('roomKicker').textContent = k; $('roomTitle').textContent = t; $('roomDesc').textContent = d }
export function hint(t) { $('roomHint').textContent = t || '' }
export function renderProgress() {
  const t = nextRoomId();
  $('progress').innerHTML = rooms.map(r => `<div class="pip${S.completed.has(r.id) ? ' done' : ''}${r.id === t && S.phase === 'atrium' ? ' next' : ''}${S.room === r.id ? ' cur' : ''}" data-room="${r.id}" title="${r.title}"><b>${S.completed.has(r.id) ? '✓' : r.short}</b></div>`).join('');
  $('objective').textContent = t ? `Ahora: ${rooms[t - 1].note} · ${rooms[t - 1].title}` : 'Las seis salas están completas';
}
export function fade(fn) {
  const f = $('flash');
  f.classList.add('on');
  setTimeout(async () => {
    try { await fn?.(); } catch (e) { console.error(e); }
    requestAnimationFrame(() => f.classList.remove('on'));
  }, 270);
}
export function titleCard(r) { const c = $('titleCard'); $('tcNote').textContent = r.note; $('tcTitle').textContent = r.title; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show') }
export const ctlRow = (r) => r.ctl.map(c => `<div class="ctl"><span class="keys">${(TOUCH ? c[1] : c[0]).map(k => TOUCH ? `<span class="tchip">${k}</span>` : `<kbd>${k}</kbd>`).join('')}</span><span>${c[2]}</span></div>`).join('');
