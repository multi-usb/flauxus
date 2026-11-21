/* ======================================================================
   FLAUXUS — ui/epilogue.js
   Partitura de la huella: resumen de las seis salas y descarga del PNG.
   ====================================================================== */
import { $, INKH, LIMEH, PAPER, FONT, SERIF } from '../core/util.js';
import { S, rooms } from '../core/state.js';
import { entry, entryLabel, ENTRIES, seen } from '../core/config.js';
import { A, killBus, tone } from '../AudioSystem.js';
import { drawMotif } from '../rooms/motif.js';
import { hideRoomDom } from './hud.js';

export function renderEntries() {
  const keys = Object.keys(ENTRIES), n = keys.filter(k => seen.has(k)).length;
  $('epEntries').innerHTML = `<div class="eyebrow">Entradas descubiertas · ${n} de 4</div><div class="entrow">${keys.map(k => { const d = ENTRIES[k], on = seen.has(k); return `<div class="ent${on ? ' on' : ''}${k === entry ? ' now' : ''}"><b>${d.tag}</b><span>${on ? (d.skill || 'estado base') : 'por descubrir'}</span></div>` }).join('')}</div><p class="entnote">${n >= 4 ? 'Recorriste las cuatro puertas: cada una cambia la forma de jugar el mismo museo.' : 'Cada satélite —fanzine, afiche, baraja— abre una posibilidad distinta dentro del mismo museo. Vuelve a entrar desde otro para descubrirla.'}</p>`
}
/* La partitura no se muestra hasta que su autor la firma: el nombre entra en el
   PNG descargable, no solo en la interfaz. */
let traceName = '';
const cleanName = v => v.replace(/\s+/g, ' ').trim().slice(0, 40);
function showTrace() {
  const result = $('traceResult');
  if (!traceName) { result.hidden = true; return; }
  result.hidden = false;
  result.dataset.name = traceName;
  $('traceCanvas').setAttribute('aria-label', `Partitura de la huella de ${traceName}`);
  drawTrace();
  (document.fonts?.ready || Promise.resolve()).then(drawTrace);
}
export function showEpilogue(cur) {
  S.phase = 'epilogue'; renderEntries(); hideRoomDom(); cur?.stop?.(); killBus(); $('roomUI').classList.remove('active'); $('btnBack').style.display = 'none'; $('epilogue').classList.add('show');
  $('nameGate').hidden = !!traceName; showTrace();
  if (!traceName) setTimeout(() => $('traceName').focus({ preventScroll: true }), 80);
  const mins = ((performance.now() - S.sessionStart) / 60000).toFixed(1); $('epSummary').textContent = `Recorrido: ${[...S.completed].map(i => rooms[i - 1].note).join(' → ')} · duración total: ${mins} min · ${entryLabel.toLowerCase()}`; tone(523.25, 1.2, 'sine', .06, 0, A.master)
}
/* ---- firma y descarga ---- */
const nameGate = $('nameGate'), nameInput = $('traceName');
nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
nameGate.addEventListener('submit', e => {
  e.preventDefault();
  const name = cleanName(nameInput.value);
  if (name.length < 2) {
    nameInput.setCustomValidity('Escribe tu nombre para firmar la partitura.');
    nameInput.reportValidity();
    return;
  }
  nameInput.setCustomValidity('');
  traceName = name;
  nameInput.value = name;
  nameGate.hidden = true;
  showTrace();
  $('downloadTrace').focus({ preventScroll: true });
});
/* ---- tarjeta para compartir ----
   La huella se descarga como una pieza vertical 1080 × 1920, pensada para
   redes: marca arriba, titular, cifras del recorrido, los seis momentos y
   el cierre. Todo se dibuja en el canvas para que el PNG salga idéntico
   en cualquier pantalla. */
let mark = null;
function brandMark() {
  if (mark) return mark;
  const im = mark = new Image();
  im.decoding = 'async';
  im.src = new URL('brand/flauxus-horizontal-verde.svg', document.baseURI).href;
  return im;
}
function rr(x, px, py, w, h, r) {
  x.beginPath(); x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath()
}
function detailOf(r, m) {
  if (!m) return 'por jugar';
  if (m.skipped) return 'saltado';
  if (r.id === 1) return `aire sostenido · ${Math.round(m.air || 0)} s`;
  if (r.id === 2) return `${m.hits || 0} golpes certeros · ${Math.round(m.avgMs || 0)} ms`;
  if (r.id === 3) return `${(m.vals || []).length} respiraciones`;
  if (r.id === 4) return `${Math.round(m.dist || 0)} m recorridos`;
  if (r.id === 5) return `${(m.order || []).length} sensores conectados`;
  if (r.id === 6) return `${m.cuts || 0} fragmento${m.cuts === 1 ? '' : 's'} intervenido${m.cuts === 1 ? '' : 's'}`;
  return `${Math.round(m.duration || 0)} s`
}
export function drawTrace() {
  if (!traceName) return;
  const c = $('traceCanvas'), x = c.getContext('2d'), w = c.width, h = c.height, M = S.metrics, u = w / 1080;
  const pad = w * .0667, done = S.completed.size, total = rooms.length, entries = seen.size;
  const cuts = M[6]?.cuts || 0;
  const sessionMin = S.sessionStart ? (performance.now() - S.sessionStart) / 60000 : 0;
  const gameSec = rooms.reduce((a, r) => a + (M[r.id]?.duration || 0), 0);
  const mins = Math.max(1, Math.round(sessionMin || gameSec / 60));
  const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const now = new Date(), date = `${String(now.getDate()).padStart(2, '0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  /* fondo: negro del museo, halo verde y una trama de puntos muy tenue */
  const bg = x.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#15170f'); bg.addColorStop(.55, INKH); bg.addColorStop(1, '#111307');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const glow = x.createRadialGradient(w * .82, h * .1, 0, w * .82, h * .1, w * .8);
  glow.addColorStop(0, 'rgba(194,254,11,.2)'); glow.addColorStop(.45, 'rgba(194,254,11,.05)'); glow.addColorStop(1, 'rgba(194,254,11,0)');
  x.fillStyle = glow; x.fillRect(0, 0, w, h * .62);
  let seed = 17; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  x.fillStyle = 'rgba(239,234,219,.035)';
  for (let i = 0; i < 1400; i++) x.fillRect(rnd() * w, rnd() * h, 1.2 * u, 1.2 * u);

  /* cabecera: logotipo oficial + fecha */
  const lg = brandMark(), lw = w * .29, lh = lw * 232 / 1104;
  if (lg.complete && lg.naturalWidth) x.drawImage(lg, pad, h * .0417, lw, lh);
  else lg.addEventListener('load', () => { try { drawTrace() } catch { } }, { once: true });
  x.fillStyle = 'rgba(239,234,219,.55)'; x.font = `600 ${Math.round(20 * u)}px ${FONT}`; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
  x.fillText(date, w - pad, h * .066);
  x.strokeStyle = 'rgba(194,254,11,.38)'; x.lineWidth = 2 * u;
  x.beginPath(); x.moveTo(pad, h * .088); x.lineTo(w - pad, h * .088); x.stroke();

  /* titular */
  x.fillStyle = LIMEH; x.fillRect(pad, h * .122, 10 * u, 10 * u);
  x.font = `700 ${Math.round(21 * u)}px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(`RECORRIDO COMPLETADO · ${done} DE ${total}`, pad + 26 * u, h * .127 + 5 * u);
  x.fillStyle = PAPER; x.font = `800 ${Math.round(98 * u)}px ${SERIF}`; x.textBaseline = 'alphabetic';
  x.fillText('LA PARTITURA', pad, h * .202);
  x.fillText('DE TU HUELLA', pad, h * .258);

  /* firma: el nombre de quien completó el recorrido */
  const pre = 'HUELLA DE ', upper = traceName.toUpperCase();
  x.fillStyle = 'rgba(239,234,219,.5)'; x.font = `600 ${Math.round(17 * u)}px ${FONT}`;
  x.fillText(pre, pad, h * .281);
  const preW = x.measureText(pre).width, maxName = w - pad * 2 - preW;
  let ns = 26 * u;
  x.font = `900 ${Math.round(ns)}px ${SERIF}`;
  while (ns > 15 * u && x.measureText(upper).width > maxName) {
    ns -= u; x.font = `900 ${Math.round(ns)}px ${SERIF}`;
  }
  x.fillStyle = LIMEH; x.fillText(upper, pad + preW, h * .281);

  /* entrada y resumen breve */
  x.fillStyle = 'rgba(239,234,219,.68)'; x.font = `400 ${Math.round(27 * u)}px ${FONT}`;
  x.fillText('Tu aire, tu pulso, tus pausas, tu recorrido,', pad, h * .304);
  x.fillText('tus conexiones y tu reensamblaje.', pad, h * .326);

  /* cifras: minutos en grande y tres contadores a la derecha */
  x.fillStyle = 'rgba(239,234,219,.42)'; x.font = `600 ${Math.round(18 * u)}px ${FONT}`;
  x.fillText('TU RECORRIDO EN NÚMEROS', pad, h * .352);
  x.fillStyle = LIMEH; x.font = `800 ${Math.round(178 * u)}px ${SERIF}`;
  const num = String(mins); x.fillText(num, pad, h * .447);
  const nw = x.measureText(num).width;
  x.fillStyle = 'rgba(239,234,219,.7)'; x.font = `600 ${Math.round(34 * u)}px ${FONT}`;
  x.fillText('MIN', pad + nw + 18 * u, h * .447);
  x.fillStyle = 'rgba(239,234,219,.45)'; x.font = `500 ${Math.round(18 * u)}px ${FONT}`;
  x.fillText('MINUTOS EN EL MUSEO', pad, h * .475);

  const rx = w * .55, rows = [
    [`${String(done).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, 'MOMENTOS'],
    [`${String(entries).padStart(2, '0')} / 04`, 'ENTRADAS'],
    [`${String(cuts).padStart(2, '0')}`, 'INTERVENCIONES']
  ];
  rows.forEach((row, i) => {
    const y = h * (.398 + i * .04);
    x.strokeStyle = 'rgba(239,234,219,.14)'; x.lineWidth = 1.2 * u;
    x.beginPath(); x.moveTo(rx, y - 31 * u); x.lineTo(w - pad, y - 31 * u); x.stroke();
    x.fillStyle = i === 2 ? LIMEH : PAPER; x.font = `700 ${Math.round(40 * u)}px ${SERIF}`;
    x.fillText(row[0], rx, y);
    x.fillStyle = 'rgba(239,234,219,.45)'; x.font = `500 ${Math.round(16 * u)}px ${FONT}`;
    x.fillText(row[1], rx + 150 * u, y - 3 * u);
  });

  /* seis momentos en dos columnas */
  const gap = 20 * u, tw = (w - pad * 2 - gap) / 2, th = h * .073, ty = h * .515;
  rooms.forEach((r, i) => {
    const m = M[r.id], ok = S.completed.has(r.id), px = pad + (i % 2) * (tw + gap), py = ty + Math.floor(i / 2) * (th + gap);
    rr(x, px, py, tw, th, 14 * u);
    x.fillStyle = ok ? 'rgba(239,234,219,.055)' : 'rgba(239,234,219,.022)'; x.fill();
    x.strokeStyle = ok ? 'rgba(194,254,11,.38)' : 'rgba(239,234,219,.1)'; x.lineWidth = 1.4 * u; x.stroke();
    x.textAlign = 'left';
    x.fillStyle = ok ? LIMEH : 'rgba(239,234,219,.3)'; x.font = `700 ${Math.round(29 * u)}px ${SERIF}`;
    x.fillText(r.note, px + 22 * u, py + 42 * u);
    x.fillStyle = ok ? PAPER : 'rgba(239,234,219,.4)'; x.font = `700 ${Math.round(22 * u)}px ${FONT}`;
    x.fillText(r.title, px + 22 * u, py + 77 * u);
    x.fillStyle = 'rgba(239,234,219,.46)'; x.font = `400 ${Math.round(16 * u)}px ${FONT}`;
    x.fillText(detailOf(r, m), px + 22 * u, py + 111 * u);
    drawMotif(x, r.id, ok ? m : null, px + tw - 52 * u, py + th / 2, 33 * u, ok ? LIMEH : 'rgba(239,234,219,.25)');
  });

  /* cierre y pie de marca */
  x.fillStyle = LIMEH; x.fillRect(pad, h * .783, 54 * u, 4 * u);
  x.fillStyle = PAPER; x.font = `700 ${Math.round(42 * u)}px ${SERIF}`;
  x.fillText('SEIS SALAS. UNA HUELLA.', pad, h * .806);
  x.strokeStyle = 'rgba(239,234,219,.16)'; x.lineWidth = 1.2 * u;
  x.beginPath(); x.moveTo(pad, h * .885); x.lineTo(w - pad, h * .885); x.stroke();
  x.fillStyle = 'rgba(239,234,219,.52)'; x.font = `500 ${Math.round(16 * u)}px ${FONT}`;
  x.textAlign = 'left'; x.fillText('FLAUXUS · LA PARTITURA DE LA HUELLA', pad, h * .922);
  x.textAlign = 'right'; x.fillText(date, w - pad, h * .922);
  x.fillStyle = 'rgba(239,234,219,.35)'; x.font = `400 ${Math.round(15 * u)}px ${FONT}`;
  x.textAlign = 'left'; x.fillText('Un museo que no se queda quieto · flauxus.vercel.app', pad, h * .948);
  x.textAlign = 'right'; x.fillText(entryLabel, w - pad, h * .948);
  x.textAlign = 'left'
}
$('downloadTrace').onclick = () => {
  if (!traceName) return;
  const slug = traceName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'huella';
  const a = document.createElement('a');
  a.download = `flauxus-partitura-${slug}.png`;
  a.href = $('traceCanvas').toDataURL('image/png');
  a.click();
};
/* «Rebobinar y empezar de nuevo»: el progreso solo vive en memoria, así que recargar ya lo deja todo en su estado
   inicial (nivel, avatar, cámara, HUD, escaleras). Se quita `?room=` para que el reinicio caiga siempre en la portada
   y el primer Momento, aunque se hubiera entrado por un acceso directo; el resto de parámetros (entrada, pruebas) sigue. */
$('restart').onclick = () => { const u = new URL(location.href); u.searchParams.delete('room'); u.hash = ''; dispatchEvent(new Event('flauxus:teardown')); location.replace(u.href) };
