// Lente de la radiografía: un aro fino con luz difusa hacia dentro que sigue al cursor (o al dedo)
// y se abre con la intensidad de la radiografía. Cuando suena una nota de María Clara se enciende (.note).
// Es una capa fija sobre toda la página: mientras el videojuego está abierto se desactiva por completo
// (setActive(false): oculta, sin tamaño, sin destellos pendientes) y al volver arranca desde un estado limpio.
export function createLens() {
  const el = document.getElementById('lens');
  const cursor = document.getElementById('cursor');
  let shown = false;
  let active = true;
  const label = document.createElement('b');
  label.className = 'lens-note';
  el.append(label);
  let off = 0;

  // Estado de reposo: invisible, sin aro, sin nota y sin área.
  function clear() {
    clearTimeout(off);
    shown = false;
    el.classList.remove('on', 'note');
    cursor?.classList.remove('lens');
    el.style.opacity = '0';
    el.style.width = '0px';
    el.style.height = '0px';
    label.textContent = '';
  }

  return {
    // Suena una nota de María Clara: el aro se enciende y aparece el nombre de la nota.
    flash(name) {
      if (!active) return;
      label.textContent = name;
      el.classList.add('note');
      clearTimeout(off);
      off = setTimeout(() => el.classList.remove('note'), 420);
    },
    update({ amount = 0, x = 0, y = 0, radius = 0 }) {
      if (!active) return;
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
    // false: la lente desaparece y deja de responder (juego abierto). true: vuelve a escuchar, desde cero.
    setActive(on) {
      active = !!on;
      el.hidden = !active;
      clear();
    },
  };
}
