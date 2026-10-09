// Visualización del sonido (control #sound): en lugar de barras de ecualizador, una onda orgánica dibujada con la
// forma de onda REAL de la mezcla (audio.wave, 48 muestras suavizadas). Una línea continua con extremos que se
// afinan y una "membrana" translúcida que respira con los graves (audio.bands[0]) y se abre con el bombo.
// Sin sonido (o silenciado) queda una línea plana. Con reduced-motion se dibuja a menos cuadros por segundo.
export function createSoundViz(canvas, audio, profile = {}) {
  const W = 76;
  const H = 24;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const btn = canvas.closest('button');
  const N = 48;
  const pts = new Float32Array(N);
  let color = '#C2FE0B';
  let flooded = null;
  let t = 0;
  let skip = 0;
  let idle = false;

  // Curva suave por puntos medios (cuadráticas): sin quiebres ni segmentos rotos.
  function smooth(ys, sign) {
    g.moveTo(0, H / 2);
    for (let i = 0; i < N - 1; i++) {
      const x0 = (i / (N - 1)) * W;
      const x1 = ((i + 1) / (N - 1)) * W;
      g.quadraticCurveTo(x0, H / 2 + sign * ys[i], (x0 + x1) / 2, H / 2 + sign * (ys[i] + ys[i + 1]) / 2);
    }
    g.lineTo(W, H / 2);
  }

  function frame(flood) {
    if (flood !== flooded) { flooded = flood; color = flood ? '#000' : '#C2FE0B'; idle = false; }
    if (profile.reducedMotion && (skip++ % 3)) return;
    const on = audio.running;
    const wave = audio.wave;
    t += 0.016;
    let energy = 0;
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      const env = Math.sin(Math.PI * x); // extremos afinados
      const w = on ? wave[i] : 0;
      energy += Math.abs(w);
      pts[i] = env * w * H * 1.6;
    }
    if (!on || energy < 0.002) {
      if (idle) return; // línea plana ya dibujada: no se repinta
      idle = true;
    } else idle = false;

    const low = on ? audio.bands[0] || 0 : 0;
    const beat = on ? audio.beat : 0;
    g.clearRect(0, 0, W, H);
    // Membrana: envolvente que respira con los graves, simétrica, translúcida
    const mem = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      const env = Math.pow(Math.sin(Math.PI * x), 1.6);
      mem[i] = env * (low * 7 + beat * 3) * (0.75 + 0.25 * Math.sin(t * 3 + x * 6));
    }
    g.globalAlpha = 0.22;
    g.fillStyle = color;
    g.beginPath();
    smooth(mem, -1);
    for (let i = N - 1; i >= 0; i--) g.lineTo((i / (N - 1)) * W, H / 2 + mem[i]);
    g.fill();
    // Línea de la onda
    g.globalAlpha = btn?.getAttribute('aria-pressed') === 'false' ? 0.45 : 1;
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    g.beginPath();
    smooth(pts, 1);
    g.stroke();
    g.globalAlpha = 1;
  }
  return { frame };
}
