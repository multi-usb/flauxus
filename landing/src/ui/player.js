// Concept art a pantalla completa: lo que hace [ JUEGA YA ] mientras GAME_URL esté vacía (fuente de verdad §19).
// Reutiliza el mismo elemento <video> del canal actual (no se descarga nada nuevo).
export function createPlayer({ channels, profile }) {
  const root = document.getElementById('player');
  const holder = root.querySelector('.player-video');
  const close = root.querySelector('.player-close');
  let returnFocus = null;

  function open() {
    returnFocus = document.activeElement;
    const v = channels.video();
    v.controls = false;
    holder.replaceChildren(v);
    if (!profile.reducedMotion) v.play().catch(() => {});
    root.hidden = false;
    document.documentElement.classList.add('player-open');
    close.focus({ preventScroll: true });
  }

  function hide() {
    if (root.hidden) return;
    root.hidden = true;
    holder.replaceChildren();
    document.documentElement.classList.remove('player-open');
    returnFocus?.focus?.({ preventScroll: true });
  }

  close.addEventListener('click', hide);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { open, close: hide };
}
