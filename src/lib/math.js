export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Normaliza un progreso al tramo [a, b].
export const span = (p, a, b) => clamp01((p - a) / (b - a));

export const lerp = (a, b, t) => a + (b - a) * t;

// Suavizado de tramo (para transiciones de cámara entre momentos).
export const smooth = (t) => t * t * (3 - 2 * t);

// Interpolación Catmull-Rom por tramos entre claves [t, ...valores].
// La columna `linearCol` (si se indica) se interpola en línea recta (curva "lineal" del manual para la cámara).
export function sampleKeys(keys, t, linearCol = -1) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = clamp01((t - k1[0]) / (k2[0] - k1[0]));
  const out = [];
  for (let c = 1; c < k1.length; c++) {
    out.push(c === linearCol ? lerp(k1[c], k2[c], u) : catmull(k0[c], k1[c], k2[c], k3[c], u));
  }
  return out;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
