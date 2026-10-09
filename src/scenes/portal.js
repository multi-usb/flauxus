import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { GLYPHS, WIDTH as LOGO_W, ORIGIN } from '../ui/logo.js';
import { span } from '../lib/math.js';

// PORTAL — JUEGA YA. Un marco monumental 9:16 frente a María Clara (ella lo mira: está en +z),
// con el concept art como superficie de luz. Encima, el logotipo FLAUXUS extruido desde el mismo vector.
// El portal se enciende ligado al scroll: primero el contorno verde se dibuja, luego la pantalla se abre
// como un CRT y su luz cae sobre la espalda de ella y el piso.
export const PORTAL = { z: 6, w: 2.4, h: 4.267, base: 0.12 };
PORTAL.cy = PORTAL.base + PORTAL.h / 2;
const VERDE = 0xc2fe0b;

export function createPortal(scene, { channels, mobile }) {
  const group = new THREE.Group();
  group.position.set(0, 0, PORTAL.z);
  group.rotation.y = Math.PI; // la cara del portal mira hacia ella (-z)
  scene.add(group);

  const { w, h, base } = PORTAL;
  const cy = PORTAL.cy;
  const T = 0.22; // grosor del marco
  const D = 0.36; // profundidad del marco

  // Marco: cuatro piezas, carbón, iluminadas por la propia pantalla.
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const pieces = [
    [w + T * 2, T, 0, cy + h / 2 + T / 2],
    [w + T * 2, T, 0, cy - h / 2 - T / 2],
    [T, h, -w / 2 - T / 2, cy],
    [T, h, w / 2 + T / 2, cy],
  ].map(([pw, ph, x, y]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, D), frameMat);
    m.position.set(x, y, 0);
    return m;
  });
  group.add(...pieces);
  // Zócalo
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + T * 2 + 0.5, base, D + 0.6), frameMat);
  plinth.position.set(0, base / 2, 0);
  group.add(plinth);

  // Contorno verde que se dibuja en la ignición (dos rectángulos: exterior e interior del marco)
  const rect = (rw, rh, z) => {
    const p = [[-rw / 2, cy - rh / 2], [rw / 2, cy - rh / 2], [rw / 2, cy + rh / 2], [-rw / 2, cy + rh / 2], [-rw / 2, cy - rh / 2]];
    return new THREE.BufferGeometry().setFromPoints(p.map(([x, y]) => new THREE.Vector3(x, y, z)));
  };
  const lineMat = new THREE.LineBasicMaterial({ color: VERDE, fog: false });
  const outline = [new THREE.Line(rect(w + T * 2, h + T * 2, D / 2 + 0.002), lineMat), new THREE.Line(rect(w, h, D / 2 + 0.002), lineMat)];
  group.add(...outline);

  // Pantalla: póster → video. Un destello blanco para el encendido tipo CRT.
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x050505, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
  screen.position.set(0, cy, D / 2 - 0.04);
  group.add(screen);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false, depthWrite: false }),
  );
  flash.position.set(0, cy, D / 2 - 0.03);
  group.add(flash);

  // Reflejo en el piso: la misma imagen invertida bajo el suelo, tenue y con caída.
  const fall = document.createElement('canvas');
  fall.width = 4; fall.height = 64;
  const fctx = fall.getContext('2d');
  for (let y = 0; y < 64; y++) { const a = Math.pow(1 - y / 63, 2.2); fctx.fillStyle = `rgb(${a * 255},${a * 255},${a * 255})`; fctx.fillRect(0, y, 4, 1); }
  const alphaMap = new THREE.CanvasTexture(fall);
  const reflMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, alphaMap, depthWrite: false, toneMapped: false });
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), reflMat);
  refl.scale.y = -1;
  refl.position.set(0, -h / 2 - 0.02, D / 2 - 0.04);
  group.add(refl);

  // Luz del portal: sale de la pantalla hacia ella. Su color es el promedio real del concept art.
  const light = new THREE.PointLight(0xffffff, 0, 14, 1.4);
  light.position.set(0, cy, 1.2); // delante de la pantalla (en espacio del grupo, +z apunta hacia ella)
  group.add(light);
  averageColor(channels.poster(0)).then((c) => light.color.copy(c));

  // Logotipo FLAUXUS extruido sobre el portal (mismo vector que la web; sin deformar las letras).
  const logo = extrudeLogo();
  // En móvil el logo mide lo mismo que el portal (el encuadre vertical es angosto); en escritorio, algo más ancho.
  const logoScale = (w + T * 2 + (mobile ? 0 : 1.6)) / LOGO_W;
  logo.scale.set(logoScale, -logoScale, logoScale); // el SVG crece hacia abajo
  logo.position.set(-(LOGO_W * logoScale) / 2, cy + h / 2 + T + (mobile ? 0.85 : 1.35), 0);
  group.add(logo);

  // ---------- Texturas de la pantalla ----------
  const loader = new THREE.TextureLoader();
  const posterTex = [];
  const videoTex = [];
  function textureFor(i) {
    const v = channels.video(i);
    if (!v.paused && v.readyState >= 2) {
      if (!videoTex[i]) {
        videoTex[i] = new THREE.VideoTexture(v);
        videoTex[i].colorSpace = THREE.SRGBColorSpace;
        videoTex[i].minFilter = THREE.LinearFilter;
        videoTex[i].magFilter = THREE.NearestFilter;
        videoTex[i].generateMipmaps = false;
      }
      return videoTex[i];
    }
    if (!posterTex[i]) {
      posterTex[i] = loader.load(channels.poster(i));
      posterTex[i].colorSpace = THREE.SRGBColorSpace;
      posterTex[i].generateMipmaps = false;
      posterTex[i].minFilter = THREE.LinearFilter;
    }
    return posterTex[i];
  }

  let disturb = 0;
  channels.onChange(() => { disturb = 1; });

  // ign: 0..1 ignición (contorno → apertura de pantalla). dt en s.
  function update(ign, dt, level = 0) {
    group.visible = true;
    // 1) el contorno se dibuja alrededor del marco
    const draw = span(ign, 0, 0.45);
    for (const o of outline) o.geometry.setDrawRange(0, Math.ceil(draw * 5));
    // 2) la pantalla se abre: línea blanca horizontal que se expande en vertical
    const lineW = span(ign, 0.4, 0.55);
    const openY = span(ign, 0.55, 0.8);
    const on = ign >= 0.55;
    flash.visible = lineW > 0 && ign < 0.95;
    flash.scale.set(Math.max(0.001, lineW), Math.max(0.004, openY), 1);
    flash.material.opacity = 1 - span(ign, 0.75, 0.95);
    screen.scale.y = on ? Math.max(0.004, openY) : 1;
    if (on) {
      const tex = textureFor(channels.index);
      if (screenMat.map !== tex) { screenMat.map = tex; screenMat.color.set(0xffffff); screenMat.needsUpdate = true; reflMat.map = tex; reflMat.color.set(0xffffff); reflMat.needsUpdate = true; }
    } else if (screenMat.map) {
      screenMat.map = null; screenMat.color.set(0x050505); screenMat.needsUpdate = true;
      reflMat.map = null; reflMat.color.set(0x000000); reflMat.needsUpdate = true;
    }
    reflMat.opacity = on ? 0.22 * openY : 0;
    // 3) la luz: crece con la apertura y respira con la música; parpadea al cambiar de canal
    disturb = Math.max(0, disturb - dt * 3);
    light.intensity = (on ? 7 * openY : lineW * 2) * (1 + level * 0.35) * (1 - disturb * 0.6);
    screenMat.color.setScalar(on ? 1 - disturb * 0.5 : 0.02);
    return { on, ready: ign >= 0.9 };
  }

  // Rectángulo de la pantalla en px CSS (para alinear el HUD del portal en HTML)
  const corners = [new THREE.Vector3(), new THREE.Vector3()];
  function screenRect(camera) {
    group.updateMatrixWorld();
    // esquinas de la pantalla en espacio del grupo (rotado 180°: izquierda/derecha se invierten)
    corners[0].set(w / 2, cy + h / 2, D / 2).applyMatrix4(group.matrixWorld).project(camera);
    corners[1].set(-w / 2, cy - h / 2, D / 2).applyMatrix4(group.matrixWorld).project(camera);
    const [a, b] = corners;
    const x0 = ((a.x + 1) / 2) * innerWidth;
    const y0 = ((1 - a.y) / 2) * innerHeight;
    const x1 = ((b.x + 1) / 2) * innerWidth;
    const y1 = ((1 - b.y) / 2) * innerHeight;
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  }

  function setVisible(v) { group.visible = v; }
  function setLogo(v) { logo.visible = v; }
  update(0, 0);
  return { group, update, screenRect, setVisible, setLogo, light };
}

function extrudeLogo() {
  const loader = new SVGLoader();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${GLYPHS.map((d) => `<path d="${d}" fill-rule="evenodd"/>`).join('')}</svg>`;
  const data = loader.parse(svg);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 14, bevelEnabled: false, curveSegments: 1 });
  geo.translate(-ORIGIN.x, -ORIGIN.y, -7); // el vector trae su origen en la esquina de su caja (formato horizontal)
  // Cara frontal verde (la que mira hacia ella), laterales carbón.
  const front = new THREE.MeshBasicMaterial({ color: VERDE });
  const side = new THREE.MeshLambertMaterial({ color: 0x383838 });
  const mesh = new THREE.Mesh(geo, [front, side]);
  return mesh;
}

// Color promedio de una imagen (el póster del concept art) para teñir la luz del portal.
function averageColor(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0; let g = 0; let b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      const col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
      // normaliza el brillo: la luz conserva el tono, no la oscuridad del póster
      const max = Math.max(col.r, col.g, col.b) || 1;
      col.multiplyScalar(1 / max);
      resolve(col.convertSRGBToLinear());
    };
    img.onerror = () => resolve(new THREE.Color(1, 1, 1));
    img.src = url;
  });
}
