import { track } from '../lib/track.js';

// Momento 1 · Impacto. Todo ocurre en el 3D: la pantalla monumental (scenes/wall.js), la activación
// (ui/activation.js) y la órbita de la cámara (scenes/gl.js). El HTML solo guarda el texto accesible.
export function createM1() {
  return {
    id: 'm1',
    track: track(document.getElementById('m1'), 1.2, { entry: false }),
    start() {},
    dom() {},
  };
}
