import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { clamp01 } from './math.js';

// Cada momento ocupa un tramo de scroll: una "entrada" (la sección sube desde abajo, 1 pantalla)
// y un "pin" (la sección queda fija `screens` pantallas). El director lee e (entrada) y q (pin) a partir
// del scroll suavizado, así todo queda ligado al scroll y se rebobina al subir.
export function track(section, screens, { entry = true } = {}) {
  // La entrada se crea antes que el pin del mismo elemento para que su posición se calcule sin el espaciador.
  const enter = entry ? ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'top top' }) : null;
  const pin = screens > 0
    ? ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${innerHeight * screens}`,
      pin: true,
      anticipatePin: 1,
    })
    : null;

  return {
    get start() { return enter ? enter.start : pin.start; },
    get end() { return pin ? pin.end : enter.end; },
    read(y) {
      const e = enter ? clamp01((y - enter.start) / Math.max(1, enter.end - enter.start)) : 1;
      const q = pin ? clamp01((y - pin.start) / Math.max(1, pin.end - pin.start)) : e;
      return { e, q };
    },
  };
}
