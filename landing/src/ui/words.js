// Revelado palabra por palabra ligado al scroll: cada palabra sube desde detrás de su propia máscara.
// p (0..1) controla el avance; al subir el scroll, las palabras vuelven a bajar (se "rebobina").
// El texto completo queda para lectores de pantalla; las palabras animadas son aria-hidden.
export function createWords(el, { reducedMotion = false } = {}) {
  const text = el.dataset.text || el.textContent;
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  const words = text.split(' ').map((w, i, all) => {
    const mask = document.createElement('span');
    mask.className = 'wm';
    const inner = document.createElement('span');
    inner.className = 'w';
    inner.textContent = w;
    mask.append(inner);
    vis.append(mask);
    if (i < all.length - 1) vis.append(' ');
    return inner;
  });
  el.append(sr, vis);
  const n = words.length;
  const last = new Array(n).fill(-1);
  return function set(p) {
    p = Math.min(1, Math.max(0, p));
    for (let i = 0; i < n; i++) {
      // ventanas solapadas: cada palabra tarda ~2,5 "turnos" en llegar
      let v = Math.min(1, Math.max(0, (p * (n + 1.5) - i) / 2.5));
      v = reducedMotion ? (v > 0.5 ? 1 : 0) : Math.round(v * 20) / 20;
      if (v === last[i]) continue;
      last[i] = v;
      const e = 1 - Math.pow(1 - v, 3);
      words[i].style.transform = v >= 1 ? '' : `translate3d(0,${((1 - e) * 105).toFixed(1)}%,0)`;
      words[i].style.opacity = v > 0 ? '1' : '0';
    }
  };
}
