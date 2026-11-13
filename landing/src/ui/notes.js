// Notas de María Clara al recorrer su cuerpo con la radiografía (o al tocarlo en pantallas táctiles).
// El cuerpo se divide en 7 franjas de altura (pies → cabeza) = 7 notas de grave a agudo (audio/engine.js, NOTES).
// Disparo controlado: una nota solo cuando el cursor cambia de franja (o vuelve a pasar con un gesto amplio),
// con un descanso mínimo de 420 ms y sin reaccionar a movimientos de pocos píxeles. En táctil, cada toque suena.
// Explorar = entrar a su memoria: al entrar al cuerpo la composición se pausa (audio.explore) y suena la nota de esa
// altura; al salir (tras 250 ms sin tocarla, para no parpadear entre brazo y torso) las notas se apagan y la música
// vuelve desde donde quedó. Respuesta audiovisual en el mismo instante: huesos encendidos, lente y nombre de la nota.
import { NOTES } from '../audio/engine.js';

const HEIGHT = 1.9; // m (pies en 0)
const COOLDOWN = 420;

export function createNoteTrigger({ audio, backend, lens }) {
  let lastAt = 0;
  let lastZone = -1;
  let lastX = -1e4;
  let lastY = -1e4;
  let wasTouching = false;

  const stats = { fired: 0, sounded: 0, names: [] };
  function fire(zone, x, y, now) {
    stats.fired++;
    lastAt = now;
    lastZone = zone;
    lastX = x;
    lastY = y;
    const pan = (x / innerWidth) * 1.2 - 0.6;
    audio.note(zone, { pan, gain: 0.9 }).then((r) => {
      // Sin sonido, la respuesta visual igual ocurre (más suave): el cuerpo sigue siendo un instrumento.
      if (r) { stats.sounded++; stats.names.push(r.name); }
      const delay = r ? r.delay * 1000 : 0;
      setTimeout(() => {
        backend.xrayNote?.(r ? 1 : 0.5);
        lens.flash?.(NOTES[zone].name);
      }, delay);
    });
  }

  let pendingTap = 0;
  let inside = false;
  let outSince = 0;
  function update(xs, now) {
    if (xs.touching && !wasTouching) pendingTap = now; // el rayo llega unos cuadros después del toque
    wasTouching = xs.touching;
    if (!xs.hit || xs.hitY < 0) {
      if (!xs.hit) lastZone = -1;
      if (pendingTap && now - pendingTap > 500) pendingTap = 0;
      if (inside) {
        if (!outSince) outSince = now;
        if (now - outSince > 250) { inside = false; audio.explore(false); }
      }
      return;
    }
    outSince = 0;
    const zone = Math.max(0, Math.min(NOTES.length - 1, Math.floor((xs.hitY / HEIGHT) * NOTES.length)));
    if (!inside) {
      inside = true;
      audio.explore(true);
      pendingTap = 0;
      if (now - lastAt > 220) fire(zone, xs.x, xs.y, now);
      return;
    }
    if (pendingTap && xs.amount > 0.2) {
      pendingTap = 0;
      if (now - lastAt > 220) fire(zone, xs.x, xs.y, now);
      return;
    }
    if (xs.amount < 0.5 || now - lastAt < COOLDOWN) return;
    const moved = Math.hypot(xs.x - lastX, xs.y - lastY);
    if (moved < 18) return;
    if (zone !== lastZone || (moved > 110 && now - lastAt > 1400)) fire(zone, xs.x, xs.y, now);
  }
  // Juego abierto: la exploración se corta en seco (sin esperar los 250 ms) y la música queda lista para volver.
  function reset() {
    if (inside) audio.explore(false);
    inside = false;
    outSince = 0;
    pendingTap = 0;
    wasTouching = false;
    lastZone = -1;
  }
  return { update, reset, stats, get inside() { return inside; } };
}
