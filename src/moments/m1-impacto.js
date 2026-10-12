import { track } from '../lib/track.js';

// Momento 1 · Impacto. Todo ocurre en el 3D: la pantalla monumental (scenes/wall.js), la activación
// (ui/activation.js) y la órbita de la cámara (scenes/gl.js). El HTML solo guarda el texto accesible.
export function createM1() {
  const m1 = document.getElementById('m1');
  const lockup = m1?.querySelector('.hero-lockup');
  const copy = m1?.querySelector('.hero-copy');
  const avatar = m1?.querySelector('.hero-mini-avatar');

  return {
    id: 'm1',
    track: track(document.getElementById('m1'), 1.2, { entry: false }),
    start() {},
    dom(e, q) {
      // q progresa de 0 a 1 mientras la cámara gira hacia la espalda de María Clara.
      // Desvanecemos y desplazamos suavemente los textos del Hero entre q=0 y q=0.32
      // para que la transición hacia el portal sea limpia, cinematográfica y sin superposiciones.
      const raw = Math.max(0, Math.min(1, 1 - q / 0.32));
      const fade = raw * raw * (3 - 2 * raw); // curva smoothstep orgánica

      if (lockup) {
        lockup.style.opacity = fade.toFixed(3);
        lockup.style.transform = `translate3d(calc(var(--hero-px, 0px) * -0.65 - ${(1 - fade) * 36}px), 0, 0)`;
        lockup.style.filter = fade < 0.99 ? `blur(${((1 - fade) * 6).toFixed(1)}px)` : 'none';
        lockup.style.pointerEvents = fade < 0.05 ? 'none' : 'auto';
      }
      if (copy) {
        copy.style.opacity = fade.toFixed(3);
        copy.style.transform = `translate3d(calc(var(--hero-px, 0px) * -0.9 + ${(1 - fade) * 36}px), 0, 0)`;
        copy.style.filter = fade < 0.99 ? `blur(${((1 - fade) * 6).toFixed(1)}px)` : 'none';
        copy.style.pointerEvents = fade < 0.05 ? 'none' : 'auto';
      }
      if (avatar) {
        avatar.style.opacity = fade.toFixed(3);
        avatar.style.transform = `translate3d(0, ${((1 - fade) * 24).toFixed(1)}px, 0) scale(${0.92 + 0.08 * fade})`;
        avatar.style.filter = fade < 0.99 ? `blur(${((1 - fade) * 4).toFixed(1)}px)` : 'none';
        avatar.style.pointerEvents = fade < 0.05 ? 'none' : 'auto';
      }
    },
  };
}
