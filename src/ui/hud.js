// HUD fijo en HTML (manual §07: los menús son HTML, no 3D): esquinas de visor, contador de cinta
// y aviso de rebobinado. El contador avanza con el scroll y retrocede al rebobinar.
const TAPE_SECONDS = 180; // la página completa equivale a 3 minutos de cinta

export function createHud() {
  const root = document.getElementById('hud');
  const counter = root.querySelector('.hud-counter');
  let lastText = '';
  let wasRewinding = false;
  let scrolled = false;

  return {
    update({ rewind, scrollY }) {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const secs = Math.round((scrollY / max) * TAPE_SECONDS);
      const text = `00:${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      if (text !== lastText) counter.textContent = lastText = text;

      const rewinding = rewind > 0.3;
      if (rewinding !== wasRewinding) root.classList.toggle('rewinding', (wasRewinding = rewinding));
      const s = scrollY > 40;
      if (s !== scrolled) root.classList.toggle('scrolled', (scrolled = s));
    },
  };
}
