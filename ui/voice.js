/* ======================================================================
   FLAUXUS — ui/voice.js
   Locución en off de María Clara, con subtítulos guiados: UNA frase a la
   vez, sincronizada con la grabación de la sala.

   · Pistas: audio/locucion/pistas.js (frases con t0/t1 y el inicio de cada
     palabra, tomados del audio real). Si una ficha trae texto sin grabación,
     se le arma la misma estructura con tiempos estimados por longitud.
   · Reloj: mientras la voz suena manda el.currentTime (pausas, saltos y
     cambios de pestaña se recalculan solos, no hay temporizadores sueltos
     por frase). Si el audio no carga, no puede sonar todavía (autoplay sin
     gesto) o se atasca, los mismos tiempos avanzan con un reloj propio y la
     voz se engancha en ese instante al primer gesto del usuario.
   · Caja: siempre mide dos líneas (style.css), así el HUD y el encuadre de
     la cámara no se mueven al cambiar de frase. Si una frase no cabe en dos
     líneas con el ancho real, se parte por palabras (paginar).
   ====================================================================== */
import { $, sleep } from '../core/util.js';
import { S } from '../core/state.js';
import { DEV_ENTRY_PICKER, VO_AUDIO } from '../core/config.js';
import { VO_TEXT } from '../Rooms.js';
import { PISTAS } from '../audio/locucion/pistas.js';
import { A } from '../AudioSystem.js';
import { toast } from './toast.js';
import { VO } from '../core/voiceState.js';

export { VO };

/* Mismo criterio que las grabaciones de las salas (AudioSystem.js): Ogg Vorbis donde se puede, AAC en Safari/iOS. */
const EXT = (() => { try { return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? '.ogg' : '.m4a' } catch { return '.m4a' } })();
const r2 = x => Math.round(x * 100) / 100;

/* ---------------- pistas ---------------- */
/* Texto sin grabación → frases breves (corta en el punto, o en la última coma si la frase se alarga). */
export function frasesDe(txt, max = 62) {
  const out = []; let cur = []; const len = a => a.join(' ').length;
  for (const p of txt.trim().split(/\s+/)) {
    if (cur.length && len(cur) + 1 + p.length > max) {
      let k = cur.length; for (let i = cur.length - 1; i > 0; i--) if (/[,;:)]$/.test(cur[i - 1]) && len(cur.slice(0, i)) >= 20) { k = i; break }
      out.push(cur.slice(0, k).join(' ')); cur = cur.slice(k)
    }
    cur.push(p);
    if (/[.?!…]["»)]?$/.test(p) && len(cur) >= 12) { out.push(cur.join(' ')); cur = [] }
  }
  if (cur.length) out.push(cur.join(' ')); return out
}
/* Tiempos estimados por longitud, al ritmo medido en las grabaciones (~0,35 s por palabra, con respiro en la puntuación). */
export function pistaEstimada(list) {
  const segs = []; let t = .4;
  for (const frag of list) for (const texto of frasesDe(frag.t)) {
    const w = []; for (const p of texto.split(/\s+/)) { w.push(r2(t)); t += .12 + p.length * .04 + (/[.,;:?!)]$/.test(p) ? .3 : 0) }
    segs.push({ t0: w[0], t1: r2(t - .25), texto, w })
  }
  return { audio: null, estimada: true, dur: r2(t + .3), segs }
}
const EST = new Map();
export function voPista(id) {
  if (PISTAS[id]) return PISTAS[id];
  if (!VO_TEXT[id]?.length) return null;
  if (!EST.has(id)) EST.set(id, pistaEstimada(VO_TEXT[id])); return EST.get(id)
}

/* ---------------- audio: carga perezosa, por sala ---------------- */
/* Devuelve { el, listo, ok, mal }: `listo` se cumple con true cuando la grabación ya está entera en memoria y
   con false si falla. Se descarga con fetch y se le entrega al <audio> como Blob: son archivos pequeños
   (130–780 KB) y así la voz puede empezar en cualquier segundo aunque el servidor no atienda peticiones por
   rangos (sin ellas el navegador no deja saltar dentro de un <audio> y la voz volvería a empezar desde cero al
   engancharse tarde); además fetch sí descarga antes del primer gesto, también en iOS. */
export function voLoad(base) {
  if (VO.cache.has(base)) return VO.cache.get(base);
  const el = new Audio(); el.preload = 'auto';
  const o = { el, listo: null, ok: false, mal: false };
  o.listo = fetch(new URL(base + EXT, document.baseURI).href).then(r => { if (!r.ok) throw new Error(r.status); return r.blob() })
    .then(b => { el.src = URL.createObjectURL(b); o.ok = true; return true }, () => { o.mal = true; return false });
  VO.cache.set(base, o); return o
}
/* La sala la pide mientras la cortina de carga aún tapa la escena (ui/prelude.js). */
export function voPreload(id) { const p = voPista(id); if (VO_AUDIO && p?.audio && !S.heard.has(id)) voLoad(p.audio) }

/* ---------------- páginas: lo que se ve de una vez ---------------- */
/* Cada frase es una página si cabe en dos líneas con el ancho real de la caja; si no (celulares estrechos), se
   parte por la palabra que mejor equilibra las mitades —mejor tras una coma— y cada parte hereda el instante en
   que empieza su primera palabra. `hasta` = cuándo se retira: al entrar la siguiente, o poco después de callar
   si viene una pausa larga (la caja no se queda con una frase vieja). */
function paginar(pista) {
  const m = $('voText').querySelector('.vm'), lh = parseFloat(getComputedStyle(m).lineHeight) || 24, out = [];
  const lineas = t => { m.textContent = t; return Math.round(m.offsetHeight / lh) };
  const partir = (pal, w, t1) => {
    const texto = pal.join(' ');
    if (pal.length < 2 || lineas(texto) <= 2) { out.push({ t0: w[0], t1, texto }); return }
    const tot = texto.length; let best = 1, bs = 1e9, acc = 0;
    for (let i = 1; i < pal.length; i++) { acc += pal[i - 1].length + 1; const sc = Math.abs(acc - tot / 2) - (/[,;:.?!)]$/.test(pal[i - 1]) ? tot * .18 : 0); if (sc < bs) { bs = sc; best = i } }
    partir(pal.slice(0, best), w.slice(0, best), w[best]); partir(pal.slice(best), w.slice(best), t1)
  };
  for (const s of pista.segs) partir(s.texto.split(/\s+/), s.w, s.t1);
  m.textContent = '';
  out.forEach((p, i) => { const n = out[i + 1]; p.hasta = n ? (n.t0 - p.t1 <= 1.2 ? n.t0 : p.t1 + .45) : p.t1 + .6 });
  return out
}
function paginaEn(pags, t) { let p = null; for (const q of pags) { if (q.t0 <= t) p = q; else break } return p && t < p.hasta ? p : null }

/* ---------------- caja: dos capas que se relevan ---------------- */
/* La frase que entra sube 6 px mientras aparece y la que sale se desvanece (200 ms, style.css): nunca hay un
   cuadro en blanco entre dos frases seguidas. Con prefers-reduced-motion el relevo es un corte limpio. */
const BOX = { capas: null, k: 0, txt: '', ro: null, sucio: false };
function capas() {
  if (!BOX.capas) {
    BOX.capas = [...$('voText').querySelectorAll('.vl')];
    if ('ResizeObserver' in window) { BOX.ro = new ResizeObserver(() => { BOX.sucio = true }); BOX.ro.observe($('voText')) }
    else addEventListener('resize', () => { BOX.sucio = true })
  }
  return BOX.capas
}
function pintar(txt) {
  if (txt === BOX.txt) return; BOX.txt = txt; const c = capas(), sale = c[BOX.k];
  sale.classList.remove('on'); sale.classList.add('out');
  if (!txt) return;
  BOX.k ^= 1; const entra = c[BOX.k]; entra.classList.remove('on', 'out'); entra.textContent = txt; void entra.offsetWidth; entra.classList.add('on');
  $('voLive').textContent = txt   // lectores de pantalla: la frase vigente, sin interrumpir (aria-live="polite")
}
function limpiar() { BOX.txt = ''; for (const c of capas()) { c.classList.remove('on', 'out'); c.textContent = '' } $('voLive').textContent = '' }

/* ---------------- reproducción ---------------- */
const R = { iv: 0, quita: null, fin: null };
function soltar() {
  clearInterval(R.iv); R.iv = 0; R.quita?.(); R.quita = null;
  try { VO.el?.pause() } catch { } VO.el = null;
  const f = R.fin; R.fin = null; f?.()
}
export function voStop() { VO.tok++; VO.active = false; soltar(); $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none' }
export async function voRun(id) {
  const tok = ++VO.tok, pista = voPista(id); soltar(); VO.armed = false; VO.active = false;
  if (!pista || S.heard.has(id)) { VO.armed = true; return }
  VO.active = true; $('btnVoSkip').style.display = 'block'; A.ambient?.set(.22, .8);
  const carga = VO_AUDIO && pista.audio ? voLoad(pista.audio) : null;
  limpiar(); $('vo').classList.add('show');
  $('voSrc').textContent = DEV_ENTRY_PICKER ? `fuente interna · ${(VO_TEXT[id] || []).map(f => f.src).join(' / ') || 'grabación'}${pista.estimada ? ' · sin grabación (tiempos estimados)' : ''}` : '';
  /* un momento para que la grabación llegue y arranque en el segundo 0; si tarda más, se engancha en marcha */
  if (carga && !carga.ok && !carga.mal) await Promise.race([carga.listo, sleep(1200)]);
  /* y dos cuadros de margen: la sala acaba de descubrirse y sus primeros cuadros son los más pesados; si la voz
     arrancara en medio, la primera frase llegaría tarde */
  await Promise.race([new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))), sleep(400)]);
  if (tok !== VO.tok) return;

  let pags = paginar(pista), modo = 'reloj', el = null, t = 0, base = 0, pend = false, ultC = -1, quieto = 0, fuera = false;
  BOX.sucio = false;
  const finT = Math.max(pista.dur, pags[pags.length - 1].t1 + .6);
  const quitaGesto = () => { R.quita?.(); R.quita = null };
  const ponGesto = e => {
    if (R.quita || fuera) return; const g = () => sonar(e);
    addEventListener('pointerdown', g, true); addEventListener('keydown', g, true);
    R.quita = () => { removeEventListener('pointerdown', g, true); removeEventListener('keydown', g, true) }
  };
  /* Intenta que la voz suene desde el instante que marca el reloj. Si el navegador no deja (autoplay sin gesto),
     los subtítulos siguen con su reloj y se reintenta en el primer toque o tecla. */
  function sonar(e) {
    if (tok !== VO.tok || modo === 'audio' || pend || fuera || t > pista.dur - .6) return;
    pend = true; VO.el = e;
    try { e.muted = A.muted; e.currentTime = t } catch { }
    let pr; try { pr = e.play() } catch (err) { pr = Promise.reject(err) }
    Promise.resolve(pr).then(() => {
      pend = false; if (tok !== VO.tok) { try { e.pause() } catch { } return }
      el = e; modo = 'audio'; ultC = -1; quieto = 0; e.muted = A.muted; quitaGesto();
      if (Math.abs(e.currentTime - t) > .35) { try { e.currentTime = t } catch { } }   // el salto previo a play() no prendió
    }, err => {
      pend = false; if (tok !== VO.tok) return; if (VO.el === e) VO.el = null;
      if (err?.name === 'NotAllowedError') ponGesto(e); else fuera = true   // archivo ilegible: solo subtítulos
    })
  }
  const aReloj = () => { modo = 'reloj'; base = performance.now() - t * 1000; try { el?.pause() } catch { } if (VO.el === el) VO.el = null };
  if (carga?.ok) sonar(carga.el); else carga?.listo.then(si => { if (si) sonar(carga.el) });

  await new Promise(res => {
    R.fin = res;
    R.iv = setInterval(() => {
      if (tok !== VO.tok) return;
      if (modo === 'audio') {
        const c = el.currentTime;
        if (el.ended) { t = Math.max(t, c); aReloj(); fuera = true }
        else {
          /* la voz manda; si se queda quieta (el sistema la pausó, la red se cortó) los subtítulos esperan con
             ella unos segundos y luego siguen solos: la sala no puede quedarse sin armar el círculo */
          quieto = c === ultC ? quieto + 40 : 0; ultC = c; t = c;
          if (quieto > (el.paused ? 1500 : 4000)) { const e = el; aReloj(); el = null; ponGesto(e) }
        }
      } else { base ||= performance.now(); t = (performance.now() - base) / 1000 }   // el reloj propio nace en su primer tic
      if (BOX.sucio) { BOX.sucio = false; pags = paginar(pista) }
      VO.t = t; const p = paginaEn(pags, t); pintar(p ? p.texto : '');
      if (modo === 'reloj' && t >= finT) { clearInterval(R.iv); R.iv = 0; R.fin = null; res() }
    }, 40)
  });
  if (tok !== VO.tok) return;
  quitaGesto(); try { VO.el?.pause() } catch { } VO.el = null;
  $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none'; VO.active = false; VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1.5)
}
$('btnVoSkip').onclick = () => { const id = S.room; voStop(); VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1); toast('Locución saltada · puedes seguir explorando') };
