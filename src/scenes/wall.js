import * as THREE from 'three';
import { FORMATS } from '../ui/logo.js';

// PANTALLA MONUMENTAL — la pared-pantalla detrás de María Clara (Momento 1).
// Lenguaje tomado de una pantalla de escenario (referencia de Jaime), traducido a FLAUXUS:
//   · una superficie clara con retícula fina, que se funde a negro hacia el piso: ella queda en silueta delante;
//   · jerarquía en tres niveles y nada más: marca, una cifra enorme, una frase; anotaciones mínimas;
//   · se enciende como un sistema (línea CRT → retícula por filas → marca → cifra → frase) y queda viva:
//     la celda bajo el cursor se marca, la cinta corre, y el pulso DO4 la invierte un instante.
// Todo el texto es grande a propósito: la escena se dibuja a baja resolución (look PS2); lo pequeño va en HTML.
const VERDE = '#C2FE0B';

export function createWall(scene, { mobile, tri }) {
  // Medidas (m) y lienzo. En móvil la pared es más alta y el texto se apila sobre su cabeza.
  const W = mobile ? 4.4 : 11;
  const H = mobile ? 7.2 : 5.5;
  const Z = -5;
  // Se dibuja en un espacio de diseño (CW × CH) y el lienzo físico es más chico: subir la textura cuesta menos.
  const CW = mobile ? 1024 : 2048;
  const PS = mobile ? 1 : 0.78;
  const CH = Math.round((CW * H) / W);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(CW * PS);
  canvas.height = Math.round(CH * PS);
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  mesh.position.set(0, H / 2, Z);
  scene.add(mesh);

  // Contraluz: la pantalla ilumina la espalda y el contorno de ella.
  const back = new THREE.DirectionalLight(0xffffff, 0);
  back.position.set(0, 3, Z + 1);
  back.target.position.set(0, 1, 0);
  scene.add(back, back.target);

  // Escritorio: logotipo horizontal; móvil (pantalla en retrato): el cuadrado FLAU / XUS.
  const LOGO = FORMATS[mobile ? 'cuadrado' : 'horizontal'];
  const logoPaths = LOGO.letters.map((d) => new Path2D(d));
  const LOGO_W = mobile ? 0.5 : 0.62; // fracción del ancho de columna
  const COLS = mobile ? 6 : 10;
  const ROWS_N = mobile ? 12 : 9;

  // Estado (lo escribe gl.js desde la secuencia de activación)
  const st = { power: 0, grid: 0, logo: 0, num: 0, load: 0, tag: 0, live: false, cell: [-1, -1], tape: 0, invert: 0, rowsDx: [0, 0, 0] };
  let dirty = true;
  let lastDraw = 0;
  let fontsReady = false;
  Promise.all([
    document.fonts.load('900 200px "Tektur"'),
    document.fonts.load('900 200px "Unbounded"'),
    document.fonts.load('600 40px "Martian Mono"'),
    document.fonts.load('500 60px "Space Grotesk"'),
  ]).then(() => { fontsReady = true; dirty = true; }).catch(() => { fontsReady = true; });

  const TAG_A = 'La flautista que se convierte en cyborg,';
  const TAG_B = 'nota a nota.';
  const NUM = '261,63–466,16';

  function draw() {
    const g = ctx;
    g.setTransform(PS, 0, 0, PS, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, CW, CH);
    if (st.power <= 0) return;

    // Superficie blanca que se funde a negro hacia el piso (ella delante). Todo el texto en negro sólido, sin grises:
    // la jerarquía la dan el tamaño y el peso. El pulso DO4 la invierte un instante.
    const top = st.invert ? '#0a0a0a' : '#ececec';
    const mid = st.invert ? '#141414' : '#d6d6d6';
    const grad = g.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, top);
    grad.addColorStop(0.5, mid);
    grad.addColorStop(0.78, st.invert ? '#000' : '#5a5a5a');
    grad.addColorStop(1, '#000');
    // Encendido CRT: una línea que se abre en vertical desde el centro
    const open = Math.min(1, st.power);
    const h = Math.max(4, CH * open);
    g.save();
    g.beginPath();
    g.rect(0, (CH - h) / 2, CW, h);
    g.clip();
    g.fillStyle = grad;
    g.fillRect(0, 0, CW, CH);
    if (open < 1) { g.fillStyle = '#fff'; g.globalAlpha = 1 - open; g.fillRect(0, 0, CW, CH); g.globalAlpha = 1; }

    const ink = st.invert ? '#FFFFFF' : '#000000';
    const soft = ink; // sin grises: etiquetas y datos también en negro sólido

    // Retícula: columnas desiguales + filas, se dibuja de arriba hacia abajo
    const colX = [];
    for (let i = 1; i < COLS; i++) colX.push(Math.round((CW * (i + (i % 3 === 1 ? 0.35 : 0))) / COLS));
    const rowY = [];
    for (let i = 1; i < ROWS_N; i++) rowY.push(Math.round((CH * i) / ROWS_N));
    const gy = CH * st.grid;
    g.strokeStyle = st.invert ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.18)';
    g.lineWidth = mobile ? 1.5 : 2;
    g.beginPath();
    for (const x of colX) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, gy); }
    for (const y of rowY) if (y < gy) { g.moveTo(0, y + 0.5); g.lineTo(CW, y + 0.5); }
    g.stroke();

    // Celda bajo el cursor: solo un relleno (sin esquinas de mira)
    const [cc, cr] = st.cell;
    if (st.live && cc >= 0) {
      const xs = [0, ...colX, CW];
      const ys = [0, ...rowY, CH];
      const x0 = xs[cc]; const x1 = xs[cc + 1]; const y0 = ys[cr]; const y1 = ys[cr + 1];
      if (x1 && y1) {
        g.fillStyle = st.invert ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.11)';
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }

    // Composición: escritorio = columna izquierda (ella está al centro); móvil = banda alta sobre su cabeza
    const L = mobile ? 0.07 * CW : 0.06 * CW;
    const T = mobile ? 0.05 * CH : 0.1 * CH;
    const colW = mobile ? CW * 0.8 : CW * 0.36;

    // 1 · Marca (vector real), las franjas llegan por separado
    if (st.logo > 0) {
      const lw = colW * LOGO_W;
      const s = lw / LOGO.box[2];
      g.save();
      g.translate(L, T);
      g.scale(s, s);
      g.translate(-LOGO.box[0], -LOGO.box[1]);
      g.fillStyle = soft;
      // Letras sólidas; cada franja se recorta con solape (sin líneas) y llega por separado.
      const nb = LOGO.bands.length;
      LOGO.bands.forEach(([y0, y1], row) => {
        const t = Math.min(1, Math.max(0, st.logo * nb - row));
        if (t <= 0) return;
        g.save();
        g.beginPath();
        g.rect(LOGO.box[0] - 400, y0 - 0.6, LOGO.box[2] + 800, y1 - y0 + 1.2);
        g.clip();
        g.translate((1 - t) * (row % 2 ? 240 : -240) + st.rowsDx[row % 3], 0);
        logoPaths.forEach((p) => g.fill(p, 'evenodd'));
        g.restore();
      });
      g.restore();
    }
    if (!fontsReady) { g.restore(); return; }
    const logoH = colW * LOGO_W * (LOGO.box[3] / LOGO.box[2]);

    // 2 · Anotación bajo la marca
    g.textBaseline = 'top';
    g.fillStyle = soft;
    g.font = `600 ${mobile ? 40 : 34}px "Martian Mono"`;
    if (st.logo >= 1) g.fillText('SISTEMA DE IDENTIDAD', L, T + logoH + (mobile ? 48 : 28));

    // 3 · Cifra enorme: primero la carga (000 → 100), luego el rango de la escala en Hz
    const numY = T + logoH + (mobile ? 136 : 150);
    let numSize = mobile ? 150 : 210;
    g.fillStyle = ink;
    g.font = `900 ${numSize}px "Unbounded"`;
    // La cifra nunca invade la columna derecha (ni el borde en móvil): se ajusta a su caja.
    const numMax = mobile ? colW : CW * 0.625 - L - CW * 0.035;
    const numW = g.measureText(mobile ? "261,63–" : NUM).width;
    if (numW > numMax) { numSize = Math.floor(numSize * numMax / numW); g.font = `900 ${numSize}px "Unbounded"`; }
    let numText = '';
    if (st.num > 0 && st.num < 1) numText = String(Math.round(st.load * 100)).padStart(3, '0');
    if (st.num >= 1) numText = NUM;
    if (mobile && st.num >= 1) {
      g.fillText('261,63–', L, numY);
      g.fillText('466,16', L, numY + numSize * 0.86);
    } else if (numText) {
      g.fillText(numText, L, numY);
    }
    // Unidad / barra de carga
    g.font = `600 ${mobile ? 38 : 36}px "Martian Mono"`;
    g.fillStyle = soft;
    const unitY = mobile && st.num >= 1 ? numY + numSize * 1.86 : numY + numSize * 0.95;
    if (st.num > 0 && st.num < 1) {
      g.fillText('% CARGA', L, unitY);
      g.fillStyle = soft;
      g.fillRect(L, unitY + 50, colW * 0.8 * st.load, 8);
      g.strokeStyle = soft; g.lineWidth = 2; g.strokeRect(L, unitY + 50, colW * 0.8, 8);
    } else if (st.num >= 1) {
      g.fillText(mobile ? 'HZ · DO4 → LA♯4' : 'HZ · DO4 → LA♯4 · ESCALA DE TONOS ENTEROS', L, unitY);
    }

    // 4 · Frase (COPY), se escribe; segunda línea en peso alto
    if (st.tag > 0) {
      const tagY = unitY + (mobile ? 90 : 120);
      const n = Math.round(st.tag * (TAG_A.length + TAG_B.length));
      const fs = mobile ? 54 : 56;
      const lh = Math.round(fs * 1.18);
      g.font = `500 ${fs}px "Space Grotesk"`;
      g.fillStyle = ink;
      const lastY = wrap(g, TAG_A.slice(0, n), L, tagY, colW, lh);
      if (n > TAG_A.length) {
        g.font = `700 ${fs}px "Space Grotesk"`;
        g.fillStyle = soft;
        g.fillText(TAG_B.slice(0, n - TAG_A.length), L, lastY + lh);
      }
    }

    // 5 · Columna derecha (solo escritorio): anotaciones mínimas, todas datos reales
    if (!mobile && st.live) {
      const R = CW * 0.625;
      g.font = `600 ${27}px "Martian Mono"`;
      g.fillStyle = soft;
      const notes = ['MARÍA CLARA', 'LOZADA OCAMPO', '', `${tri} TRIÁNGULOS`, 'LA4 = 440 HZ', '', `CINTA ${tape(st.tape)}`];
      notes.forEach((t, i) => g.fillText(t, R, CH * 0.22 + i * 42));
      // En línea: punto verde con borde negro
      g.fillStyle = VERDE; g.fillRect(R, CH * 0.22 + 8 * 42, 22, 22);
      g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(R, CH * 0.22 + 8 * 42, 22, 22);
      g.fillStyle = ink; g.fillText('EN LÍNEA', R + 38, CH * 0.22 + 8 * 42 - 4);
    }
    g.restore();
  }

  function wrap(g, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = test;
    }
    if (line) g.fillText(line, x, yy);
    return yy;
  }
  const tape = (s) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // Cursor → celda de la retícula (rayo contra el plano de la pared)
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pointer(x, y, camera) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(mesh, false)[0];
    let cell = [-1, -1];
    if (hit) {
      const u = hit.uv.x; const v = 1 - hit.uv.y;
      const colX = [];
      for (let i = 1; i < COLS; i++) colX.push((i + (i % 3 === 1 ? 0.35 : 0)) / COLS);
      let c = 0; while (c < colX.length && u > colX[c]) c++;
      cell = [c, Math.floor(v * ROWS_N)];
    }
    if (cell[0] !== st.cell[0] || cell[1] !== st.cell[1]) { st.cell = cell; dirty = true; }
  }

  // v: valores nuevos del estado; se redibuja como máximo ~12 veces por segundo y solo si algo cambió.
  function set(v, now) {
    for (const k in v) {
      const val = v[k];
      if (k === 'rowsDx') { if (val.some((d, i) => Math.abs(d - st.rowsDx[i]) > 0.5)) { st.rowsDx = val.slice(); dirty = true; } continue; }
      if (typeof val === 'number' ? Math.abs(val - st[k]) > 0.004 : val !== st[k]) { st[k] = val; dirty = true; }
    }
    back.intensity = st.power * (st.invert ? 0.2 : 1.4);
    if (!dirty || now - lastDraw < 80) return;
    dirty = false;
    lastDraw = now;
    draw();
    tex.needsUpdate = true;
  }

  draw();
  return { mesh, set, pointer, get visible() { return mesh.visible; }, setVisible(v) { mesh.visible = v; back.visible = v; } };
}
