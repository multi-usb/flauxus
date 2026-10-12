// Lente de la radiografía: un aro fino con luz difusa hacia dentro que sigue al cursor (o al dedo)
// y se abre con la intensidad de la radiografía. Cuando suena una nota de María Clara se enciende (.note).
export function createLens() {
  const el = document.getElementById('lens');
  const cursor = document.getElementById('cursor');
  let shown = false;
  const label = document.createElement('b');
  label.className = 'lens-note';
  el.append(label);
  let off = 0;
  return {
    // Suena una nota de María Clara: el aro se enciende y aparece el nombre de la nota.
    flash(name) {
      label.textContent = name;
      el.classList.add('note');
      clearTimeout(off);
      off = setTimeout(() => el.classList.remove('note'), 420);
    },
    update({ amount = 0, x = 0, y = 0, radius = 0 }) {
      const on = amount > 0.001;
      el.style.opacity = Math.min(1, amount * 1.15).toFixed(3);
      if (on !== shown) {
        shown = on;
        el.classList.toggle('on', on);
        cursor?.classList.toggle('lens', on);
      }
      if (!on) return;
      const d = Math.max(0, radius * 2);
      el.style.width = `${d.toFixed(1)}px`;
      el.style.height = `${d.toFixed(1)}px`;
      el.style.transform = `translate3d(${(x - radius).toFixed(1)}px,${(y - radius).toFixed(1)}px,0)`;
    },
  };
}
