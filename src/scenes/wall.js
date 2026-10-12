import * as THREE from 'three';

// Fondo de escenario del Hero: retícula interactiva y resplandor verde detrás del personaje.

export function createWall(scene, { mobile }) {
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

  const COLS = mobile ? 6 : 10;
  const ROWS_N = mobile ? 12 : 9;

  // Estado (lo escribe gl.js desde la secuencia de activación)
  const st = { power: 0, grid: 0, live: false, cell: [-1, -1], invert: 0 };
  let dirty = true;
  let lastDraw = 0;
  function draw() {
    const g = ctx;
    g.setTransform(PS, 0, 0, PS, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, CW, CH);
    if (st.power <= 0) return;

    // Fondo oscuro con resplandor verde: la composición tipográfica vive ahora en la capa HTML del Hero.
    const top = st.invert ? '#080b06' : '#020403';
    const mid = st.invert ? '#10170a' : '#071007';
    const grad = g.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, top);
    grad.addColorStop(0.5, mid);
    grad.addColorStop(0.78, st.invert ? '#17200a' : '#111a08');
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
    if (!st.invert) {
      const glow = g.createRadialGradient(CW * 0.48, CH * 0.93, 0, CW * 0.48, CH * 0.93, CH * 0.9);
      glow.addColorStop(0, 'rgba(126, 190, 0, .52)');
      glow.addColorStop(0.42, 'rgba(77, 119, 0, .2)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, CW, CH);
    }
    if (open < 1) { g.fillStyle = '#010201'; g.globalAlpha = 1 - open; g.fillRect(0, 0, CW, CH); g.globalAlpha = 1; }

    // Retícula: columnas desiguales + filas, se dibuja de arriba hacia abajo
    const colX = [];
    for (let i = 1; i < COLS; i++) colX.push(Math.round((CW * (i + (i % 3 === 1 ? 0.35 : 0))) / COLS));
    const rowY = [];
    for (let i = 1; i < ROWS_N; i++) rowY.push(Math.round((CH * i) / ROWS_N));
    const gy = CH * st.grid;
    g.strokeStyle = st.invert ? 'rgba(255,255,255,.2)' : 'rgba(194,254,11,.045)';
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
        g.fillStyle = st.invert ? 'rgba(255,255,255,.14)' : 'rgba(194,254,11,.1)';
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }

    // Se conserva la retícula y el resaltado interactivo; la composición tipográfica está en HTML.
    g.restore();
    return;
  }

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
