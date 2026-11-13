// Cursor de escritorio: un punto circular verde que sigue al puntero sin retraso (posición exacta, solo transform).
// Reacciona sin distraer: sobre algo interactivo ([data-cursor]) crece a un disco translúcido; al hacer clic se contrae;
// sobre el cuerpo de María Clara se oculta y la lente de la radiografía toma su lugar (ui/lens.js).
export function createCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const el = document.getElementById('cursor');
  el.innerHTML = '<i></i>';
  const html = document.documentElement;
  html.classList.add('custom-cursor');
  let x = -100;
  let y = -100;
  let queued = false;
  const paint = () => { queued = false; el.style.transform = `translate3d(${x}px,${y}px,0)`; };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    el.classList.add('visible');
    const t = e.target.closest?.('[data-cursor], a, button');
    el.classList.toggle('hot', !!(t && !t.disabled));
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') el.classList.add('down'); }, { passive: true });
  addEventListener('pointerup', () => el.classList.remove('down'), { passive: true });
  document.addEventListener('pointerleave', () => el.classList.remove('visible'));
}
