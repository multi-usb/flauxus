import * as THREE from 'three';
import { QUALITY, MAX_DPR, SCANLINE_STRENGTH } from '../config.js';

// El único shader de posproceso de la landing.
// La escena se dibuja a resolución interna baja y aquí se escala con "nearest" (look PS2).
// Encima: scanlines (manual §04), encendido/apagado CRT (línea blanca, manual §06) y rebobinado
// (ruido VHS a 12 fps + 2 bandas + desaturación + skew 2°, manual §06). Sin bloom, sin blur, sin glow.
const fragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform float uDpr;
  uniform float uTime;
  uniform float uScan;
  uniform float uScanEnabled;
  uniform float uVignette;
  uniform float uRewind;
  uniform float uPower;
  uniform float uLevel;
  uniform float uWipe;
  uniform float uGlitch;
  // Modo código: la imagen se redibuja con caracteres (F L A U X S) según su luminancia.
  uniform sampler2D tGlyphs;
  uniform float uGlyphs;
  uniform vec2 uRes;
  uniform float uCell;
  uniform float uCode;      // 0..1 cantidad de código (verde sobre negro)
  uniform float uCodeLine;  // 0..1 debajo de esta línea (en pantalla) la imagen es código
  uniform float uFlood;     // 0..1 inundación: negro sobre verde
  uniform vec3 uGreen;
  uniform float uFlash;     // destello del clímax (un solo golpe, nunca repetido)
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    // Encendido CRT: primero una línea blanca horizontal que se abre a lo ancho, luego la imagen se abre en vertical.
    float lineW = smoothstep(0.0, 0.35, uPower);
    float openY = smoothstep(0.35, 1.0, uPower);
    float h = mix(0.003, 1.0, openY);
    float dy = (vUv.y - 0.5) / h;
    if (abs(vUv.x - 0.5) > lineW * 0.5 || abs(dy) > 0.5) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      #include <colorspace_fragment>
      return;
    }
    vec2 uv = vec2(vUv.x, dy + 0.5);

    // Rebobinado
    float t12 = floor(uTime * 12.0) / 12.0;
    float bands = 0.0;
    if (uRewind > 0.001) {
      uv.x += (uv.y - 0.5) * 0.0349 * uRewind;               // skew 2°
      float b1 = fract(1.0 - t12 * 0.43);
      float b2 = fract(0.55 - t12 * 0.29);
      bands = step(abs(uv.y - b1), 0.022) + step(abs(uv.y - b2), 0.009);
      uv.x += bands * uRewind * (hash(vec2(t12, floor(uv.y * 90.0))) - 0.5) * 0.08;
    }

    // El audio alimenta un glitch leve: en los picos, una banda horizontal se desplaza.
    float t24 = floor(uTime * 24.0);
    float glit = step(0.72, uLevel) * step(0.9, hash(vec2(floor(uv.y * 40.0), t24)));
    uv.x += glit * (hash(vec2(t24, uv.y)) - 0.5) * 0.03 * uLevel;

    // Barrido por bandas (transición hacia el HTML): cada franja horizontal sale hacia un lado.
    float outside = 0.0;
    if (uWipe > 0.0) {
      float band = floor(uv.y * 14.0);
      float dir = mod(band, 2.0) * 2.0 - 1.0;
      float k = clamp((uWipe - hash(vec2(band, 3.7)) * 0.45) / 0.55, 0.0, 1.0);
      uv.x += dir * k * k * 1.25;
      outside = step(1.0, uv.x) + step(uv.x, 0.0);
    }
    // Golpe de glitch en las transiciones: bandas que saltan y canales separados.
    float ca = 0.0;
    if (uGlitch > 0.0) {
      float t30 = floor(uTime * 30.0);
      float row = floor(uv.y * 24.0);
      uv.x += step(0.68, hash(vec2(row, t30))) * (hash(vec2(t30, row)) - 0.5) * 0.14 * uGlitch;
      ca = 0.008 * uGlitch;
    }

    vec3 col = texture2D(tScene, uv).rgb;
    if (ca > 0.0) {
      col.r = texture2D(tScene, uv + vec2(ca, 0.0)).r;
      col.b = texture2D(tScene, uv - vec2(ca, 0.0)).b;
    }
    // ---- Modo código / inundación ----
    float codeAmt = max(uCode * step(vUv.y, uCodeLine), uRewind * 0.85 * (1.0 - uFlood));
    if (codeAmt > 0.001 || uFlood > 0.001) {
      vec2 grid = uRes / (uCell * uDpr);
      vec2 cellUv = (floor(uv * grid) + 0.5) / grid;
      vec2 local = fract(uv * grid);
      vec3 s = texture2D(tScene, cellUv).rgb;
      float L = smoothstep(0.01, 0.55, dot(s, vec3(0.299, 0.587, 0.114)));
      float idx = floor(L * (uGlyphs - 1.0) + 0.5);
      float m = texture2D(tGlyphs, vec2((idx + local.x) / uGlyphs, local.y)).r;
      col = mix(col, uGreen * m, codeAmt);
      col = mix(col, mix(uGreen, vec3(0.0), m), uFlood);
    }
    // Línea que convierte el código en imagen
    if (uCode > 0.001 && uCodeLine > 0.0 && uCodeLine < 1.0) {
      col = mix(col, uGreen, step(abs(vUv.y - uCodeLine) * uRes.y, 1.5 * uDpr));
    }
    col *= 1.0 - clamp(outside, 0.0, 1.0);
    col = mix(col, vec3(1.0), uFlash * 0.75);

    if (uRewind > 0.001) {
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l), 0.8 * uRewind);                 // desaturación
      vec2 cell = floor(gl_FragCoord.xy / (uDpr * 2.0));
      float n = hash(cell + t12 * 37.0);
      col = mix(col, vec3(n), 0.28 * uRewind);                // grano VHS
      col += bands * 0.22 * uRewind;
    }

    // Línea blanca del encendido
    col = mix(vec3(1.0), col, openY * openY);

    // Scanlines: periodo 2 px CSS, línea oscura al 40 %.
    float row = mod(floor(gl_FragCoord.y / uDpr), 2.0);
    col *= 1.0 - (uScan + uLevel * 0.12) * row * uScanEnabled; // las scanlines respiran con la música

    // Viñeta suave del CRT del manual (solo con CRT activo).
    float d = length(vUv - 0.5) * 1.4142;
    col *= 1.0 - uVignette * smoothstep(0.55, 1.0, d);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Atlas de caracteres ordenados de menos a más tinta: los del nombre FLAUXUS hacen la imagen.
const RAMP = [' ', '.', ':', '+', 'L', 'F', 'U', 'X', 'S', 'A'];
async function buildGlyphs() {
  try { await document.fonts.load('800 28px "Martian Mono"'); } catch { /* respaldo del sistema */ }
  const S = 32;
  const c = document.createElement('canvas');
  c.width = S * RAMP.length;
  c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.font = '800 26px "Martian Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  RAMP.forEach((ch, i) => ctx.fillText(ch, i * S + S / 2, S / 2 + 1));
  const texture = new THREE.CanvasTexture(c);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { texture, count: RAMP.length };
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export function createPipeline(canvas, { quality, crt }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 1);

  const target = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;

  const uniforms = {
    tScene: { value: target.texture },
    uDpr: { value: 1 },
    uTime: { value: 0 },
    uScan: { value: crt ? SCANLINE_STRENGTH : 0 },
    uScanEnabled: { value: 1 },
    uVignette: { value: crt ? 0.35 : 0 },
    uRewind: { value: 0 },
    uPower: { value: 0 },
    uLevel: { value: 0 },
    uWipe: { value: 0 },
    uGlitch: { value: 0 },
    tGlyphs: { value: null },
    uGlyphs: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCell: { value: 9 },
    uCode: { value: 0 },
    uCodeLine: { value: 1 },
    uFlood: { value: 0 },
    uGreen: { value: new THREE.Color(0xc2fe0b) },
    uFlash: { value: 0 },
  };
  buildGlyphs().then((g) => { uniforms.tGlyphs.value = g.texture; uniforms.uGlyphs.value = g.count; });
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, depthTest: false, depthWrite: false }),
  );
  const fxScene = new THREE.Scene();
  fxScene.add(quad);
  const fxCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let preset = QUALITY[quality];
  let width = 0;
  let height = 0;

  function resize() {
    width = innerWidth;
    height = innerHeight;
    const iw = Math.max(2, Math.round(width * preset.scale));
    const ih = Math.max(2, Math.round(height * preset.scale));
    if (preset.postfx) {
      const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      target.setSize(iw, ih);
      uniforms.uDpr.value = dpr;
      renderer.getDrawingBufferSize(uniforms.uRes.value);
      uniforms.uCell.value = width < 768 ? 7 : 9;
      canvas.classList.remove('pixelated');
    } else {
      // Preset baja: sin posproceso. El canvas se dibuja pequeño y el navegador lo escala con píxel duro.
      renderer.setPixelRatio(1);
      renderer.setSize(iw, ih, false);
      canvas.classList.add('pixelated');
    }
  }

  function setQuality(name) {
    preset = QUALITY[name];
    resize();
  }

  function render(scene, camera, time) {
    uniforms.uTime.value = time;
    if (preset.postfx) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(fxScene, fxCamera);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  resize();
  return {
    renderer,
    uniforms,
    resize,
    render,
    setQuality,
    get postfx() { return preset.postfx; },
    get scale() { return preset.scale; },
    get aspect() { return width / height; },
  };
}
