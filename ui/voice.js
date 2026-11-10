/* ======================================================================
   FLAUXUS — ui/voice.js
   Locución en off de María Clara. Lee los textos/archivos de cada ficha
   de sala; si el audio no existe, subtitula con ritmo de lectura.
   ====================================================================== */
import { $, clamp, sleep } from '../core/util.js';
import { S } from '../core/state.js';
import { DEV_ENTRY_PICKER, VO_AUDIO } from '../core/config.js';
import { VO_TEXT, VO_FILES } from '../Rooms.js';
import { A } from '../AudioSystem.js';
import { toast } from './toast.js';
import { VO } from '../core/voiceState.js';

export { VO };

export const escH = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export function voLoad(base) {
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
/* La caja muestra siempre LÍNEAS ENTERAS. Su alto lo decide la maquetación (tope por formato en style.css y lo
   que el HUD le deje): si el texto no cabe, #voText se limita a un número entero de líneas y avanza de línea en
   línea con la lectura. Antes se recortaba la caja a un alto cualquiera y la última línea salía cortada a media
   altura. FIT guarda la altura de línea y cuántas caben (99 = todas). */
const FIT = { lh: 21, lines: 99, w: 0, h: 0, n: 0 };
function voFit() {
  /* Se mide con el texto suelto y se vuelve a limitar en el mismo paso (no llega a pintarse); la posición de
     lectura se conserva sin animación. */
  const box = $('vo'), tx = $('voText'), st = tx.scrollTop; tx.style.scrollBehavior = 'auto'; tx.style.maxHeight = ''; box.scrollTop = 0;
  FIT.w = innerWidth; FIT.h = innerHeight; FIT.n = 0; FIT.lh = parseFloat(getComputedStyle(tx).lineHeight) || 21; FIT.lines = 99;
  const over = box.scrollHeight - box.clientHeight; // lo que hoy no cabe en la caja
  if (over > 1) { FIT.lines = Math.max(2, Math.floor((tx.clientHeight - over + .5) / FIT.lh)); tx.style.maxHeight = (FIT.lines * FIT.lh) + 'px'; tx.scrollTop = st }
  tx.style.scrollBehavior = ''
}
export function voStop() { VO.tok++; VO.active = false; try { VO.el?.pause() } catch { } VO.el = null; $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none' }
export async function voRun(id) {
  const tok = ++VO.tok, list = VO_TEXT[id] || []; VO.armed = false; VO.active = false;
  if (!list.length || S.heard.has(id)) { VO.armed = true; return }
  VO.active = true; $('btnVoSkip').style.display = 'block'; A.ambient?.set(.22, .8);
  for (let k = 0; k < list.length; k++) {
    const frag = list[k], words = frag.t.split(/\s+/), base = VO_AUDIO ? VO_FILES[id]?.[k] : null;
    const el = base ? await voLoad(base) : null; if (tok !== VO.tok) return;
    $('voText').innerHTML = words.map(w => `<span class="w">${escH(w)}</span>`).join(' '); $('voSrc').textContent = DEV_ENTRY_PICKER ? `fuente interna · ${frag.src}${el ? '' : ' · sin audio (subtítulo con ritmo de lectura)'}` : '';
    $('vo').classList.add('show'); $('voText').scrollTop = 0; voFit(); const spans = [...$('voText').children], est = Math.max(3, words.length * .4 + .8), t0 = performance.now(); let dur = est, useEl = false;
    if (el) { try { el.muted = A.muted; el.currentTime = 0; await el.play(); useEl = true; VO.el = el; if (isFinite(el.duration) && el.duration > 0) dur = el.duration } catch { } }
    if (tok !== VO.tok) { try { el?.pause() } catch { } return }
    await new Promise(res => {
      const iv = setInterval(() => {
        if (tok !== VO.tok) { clearInterval(iv); res(); return }
        const el2 = (performance.now() - t0) / 1000, p = useEl && el.duration ? el.currentTime / el.duration : el2 / dur;
        const n = Math.floor(clamp(p, 0, 1) * spans.length * 1.04); spans.forEach((sp, i) => sp.classList.toggle('on', i < n));
        /* si el texto no cabe (pantallas bajas), avanza por líneas enteras: la que suena queda penúltima, con la
           siguiente ya a la vista. Al girar o redimensionar se vuelve a calcular cuántas líneas caben. */
        /* También cada segundo: el sitio de la caja cambia cuando aparece o se va un aviso vecino del HUD. */
        if (innerWidth !== FIT.w || innerHeight !== FIT.h || ++FIT.n >= 12) voFit();
        const tx = $('voText'), cw = spans[Math.min(spans.length - 1, n)];
        if (cw && FIT.lines < 99) { const line = Math.round((cw.offsetTop - spans[0].offsetTop) / FIT.lh), top = Math.max(0, line - (FIT.lines - 2)) * FIT.lh; if (Math.abs(tx.scrollTop - top) > 1) tx.scrollTop = top }
        if ((useEl ? el.ended : p >= 1) || el2 > dur + 5) { clearInterval(iv); res() }
      }, 80)
    });
    VO.el = null; if (tok !== VO.tok) return;
    spans.forEach(sp => sp.classList.add('on')); await sleep(k < list.length - 1 ? 800 : 1300); if (tok !== VO.tok) return
  }
  $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none'; VO.active = false; VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1.5)
}
$('btnVoSkip').onclick = () => { const id = S.room; voStop(); VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1); toast('Locución saltada · puedes seguir explorando') };
