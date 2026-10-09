// Perfil del dispositivo, sin leer el user agent (manual de producción: matchMedia + maxTouchPoints + ancho).
export function detectProfile() {
  // ?input=touch fuerza el perfil táctil (solo para pruebas en escritorio).
  const forceTouch = new URLSearchParams(location.search).get('input') === 'touch';
  const coarse = forceTouch || matchMedia('(pointer: coarse)').matches;
  const touch = coarse || (navigator.maxTouchPoints > 0 && innerWidth < 1024);
  const small = innerWidth < 768;
  const weak = (navigator.hardwareConcurrency || 8) <= 4;
  const mobile = touch || small;
  return {
    touch,
    mobile,
    model: mobile || weak ? 'mobile' : 'desktop',
    quality: mobile ? 'media' : 'alta',
    // CRT (scanlines + viñeta del shader) apagado por defecto en táctil; se usa la capa CSS al 14 % (manual §07).
    crt: !touch,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}
