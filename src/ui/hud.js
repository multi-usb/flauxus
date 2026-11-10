// HUD fijo en HTML (manual §07: los menús son HTML, no 3D): esquinas de visor, contador de cinta
// y aviso de rebobinado. El contador avanza con el scroll y retrocede al rebobinar.
const TAPE_SECONDS = 180; // la página completa equivale a 3 minutos de cinta

export function createHud() {
  const root = document.getElementById('hud');
  const counter = root.querySelector('.hud-counter');
  const iso = root.querySelector('.hud-iso');
  let lastText = '';
  let wasRewinding = false;
  let scrolled = false;

  // El logo X interactivo: al darle click devuelve al hero
  if (iso) {
    iso.setAttribute('role', 'button');
    iso.setAttribute('aria-label', 'Volver al Hero');
    iso.setAttribute('tabindex', '0');
    const returnToHero = (e) => {
      e?.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    iso.addEventListener('click', returnToHero);
    iso.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') returnToHero(e);
    });
  }

  return {
    update({ rewind, scrollY, moment }) {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const secs = Math.round((scrollY / max) * TAPE_SECONDS);
      const text = `00:${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      if (text !== lastText && counter) counter.textContent = lastText = text;

      const rewinding = rewind > 0.3;
      if (rewinding !== wasRewinding) root.classList.toggle('rewinding', (wasRewinding = rewinding));
      const s = scrollY > 40;
      if (s !== scrolled) root.classList.toggle('scrolled', (scrolled = s));

      // La X se muestra fuera del hero para volver en cualquier momento sin superponerse con el logo del hero.
      // En los créditos (M6) se retira: allí el contenido se recorre en vertical y pasaba por debajo de ella
      // (tapaba «INTEGRANTES», el logotipo de la universidad o «BY REWIND/»), y «Tomar aire de nuevo» ya
      // devuelve al inicio.
      if (iso) {
        const showIso = scrollY > 140 && moment !== 'm6';
        iso.classList.toggle('active-nav', showIso);
      }
    },
  };
}
