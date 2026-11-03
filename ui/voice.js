/* ======================================================================
   FLAUXUS — ui/voice.js
   Locución en off de María Clara. Lee los textos/archivos de cada ficha
   de sala; si el audio no existe, subtitula con ritmo de lectura.
   ====================================================================== */
import { $, clamp, sleep } from '../core/util.js';
import { S } from '../core/state.js';
import { DEV_ENTRY_PICKER } from '../core/config.js';
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
export function voStop() { VO.tok++; VO.active = false; try { VO.el?.pause() } catch { } VO.el = null; $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none' }
export async function voRun(id) {
  const tok = ++VO.tok, list = VO_TEXT[id] || []; VO.armed = false; VO.active = false;
  if (!list.length || S.heard.has(id)) { VO.armed = true; return }
  VO.active = true; $('btnVoSkip').style.display = 'block'; A.ambient?.set(.22, .8);
  for (let k = 0; k < list.length; k++) {
    const frag = list[k], words = frag.t.split(/\s+/), base = VO_FILES[id]?.[k];
    const el = base ? await voLoad(base) : null; if (tok !== VO.tok) return;
    $('voText').innerHTML = words.map(w => `<span class="w">${escH(w)}</span>`).join(' '); $('voSrc').textContent = DEV_ENTRY_PICKER ? `fuente interna · ${frag.src}${el ? '' : ' · sin audio (subtítulo con ritmo de lectura)'}` : '';
    $('vo').classList.add('show'); const spans = [...$('voText').children], est = Math.max(3, words.length * .4 + .8), t0 = performance.now(); let dur = est, useEl = false;
    if (el) { try { el.muted = A.muted; el.currentTime = 0; await el.play(); useEl = true; VO.el = el; if (isFinite(el.duration) && el.duration > 0) dur = el.duration } catch { } }
    if (tok !== VO.tok) { try { el?.pause() } catch { } return }
    await new Promise(res => {
      const iv = setInterval(() => {
        if (tok !== VO.tok) { clearInterval(iv); res(); return }
        const el2 = (performance.now() - t0) / 1000, p = useEl && el.duration ? el.currentTime / el.duration : el2 / dur;
        const n = Math.floor(clamp(p, 0, 1) * spans.length * 1.04); spans.forEach((sp, i) => sp.classList.toggle('on', i < n));
        if ((useEl ? el.ended : p >= 1) || el2 > dur + 5) { clearInterval(iv); res() }
      }, 80)
    });
    VO.el = null; if (tok !== VO.tok) return;
    spans.forEach(sp => sp.classList.add('on')); await sleep(k < list.length - 1 ? 800 : 1300); if (tok !== VO.tok) return
  }
  $('vo').classList.remove('show'); $('btnVoSkip').style.display = 'none'; VO.active = false; VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1.5)
}
$('btnVoSkip').onclick = () => { const id = S.room; voStop(); VO.armed = true; S.heard.add(id); A.ambient?.set(.4, 1); toast('Locución saltada · puedes seguir explorando') };
