// Máscara de las fotografías de María Clara: sin rectángulos ni óvalos.
// Centro nítido sobre su rostro (--mx/--my); hacia afuera la imagen se FRAGMENTA: bloques que se apagan con ruido,
// franjas horizontales desplazadas (como una señal que se corta) y un polvo de píxeles sueltos que se funde con el
// negro. Se dibuja en un lienzo pequeño (bloques de verdad) y se usa como mask-image; se precalcula por pasos de
// revelado (la foto "se condensa" con el scroll) y cada foto tiene su propia semilla.
const STEPS = 10;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
// ruido de valor 2D suave (para que el borde tenga forma de nebulosa y no de círculo)
function makeNoise(seed) {
  const r = rng(seed);
  const G = 9;
  const g = Array.from({ length: G * G }, r);
  const at = (x, y) => g[((y % G) + G) % G * G + ((x % G) + G) % G];
  return (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}

// aspect = alto / ancho de la foto; mx, my en 0..1; devuelve STEPS URLs (de casi nada a revelado completo)
export function buildMasks(aspect, mx, my, seed) {
  const W = 120;
  const H = Math.round(W * aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const n1 = makeNoise(seed);
  const n2 = makeNoise(seed * 7 + 3);
  // franjas: grupos de filas con desplazamiento horizontal propio (la señal "se corre")
  const r = rng(seed * 13 + 1);
  const slices = [];
  for (let y = 0; y < H;) { const h = 2 + Math.floor(r() * 7); const dx = r() < 0.45 ? Math.round((r() - 0.5) * 14) : 0; slices.push({ y, h, dx }); y += h; }
  const dust = Float32Array.from({ length: W * H }, r);
  const edge = Float32Array.from({ length: W * H }, r);
  const urls = [];
  const img = g.createImageData(W, H);
  // copia ampliada sin suavizado: los bloques siguen siendo bloques al escalar la máscara
  const big = document.createElement('canvas');
  big.width = W * 3;
  big.height = H * 3;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  for (let k = 1; k <= STEPS; k++) {
    const rev = k / STEPS;
    const R = 0.12 + rev * 0.24; // radio del núcleo nítido (en unidades del ancho): nunca llega a los lados
    for (const sl of slices) {
      for (let y = sl.y; y < Math.min(H, sl.y + sl.h); y++) {
        for (let x = 0; x < W; x++) {
          const sx = x - sl.dx * (1 - rev * 0.3);
          const dx = (sx / W - mx);
          const dy = (y / W - my * aspect);
          // borde de nebulosa: el radio se deforma con dos escalas de ruido
          const warp = (n1(sx / 16, y / 16) - 0.5) * 0.32 + (n2(sx / 6, y / 6) - 0.5) * 0.12;
          const d = Math.hypot(dx, dy * 0.9) - R * (1 + warp);
          let a;
          if (d < -0.1) a = 1; // centro nítido
          else if (d > 0.22) a = dust[y * W + x] > 0.992 - rev * 0.006 ? 0.5 : 0; // polvo suelto
          else {
            const t = (d + 0.1) / 0.32; // 0 = dentro, 1 = afuera
            const p = 1 - t * t;
            // bloques que se apagan con ruido (fragmentación digital), dentro de la franja
            a = dust[y * W + ((x >> 1) << 1)] < p ? Math.min(1, p * 1.4) : 0;
          }
          // los cuatro lados de la caja también se desmoronan: ningún borde recto sobrevive
          const e = Math.min(x / W, 1 - x / W, y / H, 1 - y / H) / 0.22;
          if (e < 1 && a > 0) a = edge[y * W + ((x >> 1) << 1)] < e * e ? a : 0;
          const i = (y * W + x) * 4;
          img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0; img.data[i + 3] = Math.round(a * 255);
        }
      }
    }
    g.putImageData(img, 0, 0);
    bg.clearRect(0, 0, big.width, big.height);
    bg.drawImage(c, 0, 0, big.width, big.height);
    urls.push(big.toDataURL('image/png'));
  }
  return urls;
}
export const MASK_STEPS = STEPS;
