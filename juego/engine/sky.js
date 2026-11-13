/* ======================================================================
   FLAUXUS — engine/sky.js
   Cielo procedural y partículas ambientales. Todo es GPU:

   · createGalaxy()   Galaxia de SOL♯. La nebulosa se HORNEA una sola vez a
                      una textura (ruido fractal 3D evaluado sobre la esfera,
                      sin costura) y se pinta en una esfera interior que gira
                      despacio: cero ruido por píxel en cada cuadro. Encima,
                      dos capas de estrellas (Points) a distintas
                      profundidades que titilan en el shader, y un disco de
                      polvo que orbita alrededor del holograma.
                      Total: 4 llamadas de dibujo, sin trabajo de CPU por
                      partícula.

   · createFireflies() Luciérnagas (LA♯ y atrio): un solo Points cuyo
                      vaivén, brillo y parpadeo se calculan en el vertex
                      shader a partir de una semilla por partícula. La CPU
                      solo sube el reloj.
   ====================================================================== */
import * as THREE from 'three';

const NOISE = /* glsl */`
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

/* Hornea la nebulosa en una textura equirectangular. Se ejecuta una vez (≈ un cuadro). */
function bakeNebula(renderer, w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float lon = vUv.x * 6.2831853, lat = (vUv.y - 0.5) * 3.14159265;
        vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        // banda galáctica inclinada: la nebulosa se concentra en un plano
        vec3 axis = normalize(vec3(0.35, 0.9, 0.2));
        float band = exp(-pow(dot(d, axis) * 2.6, 2.0));
        float n1 = fbm(d * 2.2 + 3.0), n2 = fbm(d * 4.6 - 1.7 + n1), n3 = fbm(d * 9.0 + n2 * 2.0);
        float cloud = smoothstep(0.38, 0.9, n1 * 0.6 + n2 * 0.5) * (0.25 + 0.75 * band);
        float dustLane = smoothstep(0.5, 0.75, n3) * band;
        // paleta: violeta profundo → cian del traje → rosado; un respiro del verde FLAUXUS en los nudos más densos
        vec3 col = vec3(0.012, 0.010, 0.022);
        col += vec3(0.22, 0.08, 0.42) * cloud;
        col += vec3(0.05, 0.42, 0.50) * pow(cloud, 2.0) * smoothstep(0.35, 0.75, n2);
        col += vec3(0.62, 0.14, 0.42) * pow(cloud, 3.0) * smoothstep(0.45, 0.85, n3);
        col += vec3(0.42, 0.55, 0.03) * pow(cloud, 5.0) * 0.7;
        col *= 1.0 - dustLane * 0.55;
        // polvo de estrellas lejano, horneado (las estrellas que titilan son Points aparte)
        vec3 g = floor(d * 190.0); float s = hash(g);
        float star = step(0.9965, s) * (0.35 + 0.65 * hash(g + 3.1));
        col += vec3(0.85, 0.9, 1.0) * star * (0.5 + band);
        // se apaga hacia el horizonte inferior: el escenario se recorta contra negro
        col *= smoothstep(-0.55, 0.05, d.y) * 0.9 + 0.1;
        col *= 0.5;                                  // espacio profundo: la nebulosa acompaña, no ilumina
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  sc.add(quad);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(prev);
  quad.geometry.dispose(); mat.dispose();
  return rt;
}

const STAR_VERT = /* glsl */`
  attribute float aSeed; attribute float aSize;
  uniform float uTime; uniform float uPx;
  varying float vTw; varying float vSeed;
  void main() {
    vSeed = aSeed;
    vTw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 2.4) + aSeed * 40.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPx * (0.7 + 0.3 * vTw);
    gl_Position = projectionMatrix * mv;
  }`;
const STAR_FRAG = /* glsl */`
  varying float vTw; varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5; float d = length(p);
    float a = smoothstep(0.5, 0.0, d); a *= a;
    vec3 c = mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.8, 0.95), step(0.7, vSeed));
    c = mix(c, vec3(0.76, 1.0, 0.3), step(0.94, vSeed));
    gl_FragColor = vec4(c * a * vTw, a * vTw);
  }`;

function starLayer(n, rMin, rMax, sizeMin, sizeMax, time, px) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // esfera superior (el cielo), algo más densa cerca de la banda galáctica
    const u = Math.random() * 2 - 1, th = Math.random() * 6.2832, r = rMin + Math.random() * (rMax - rMin), s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(th) * r; pos[i * 3 + 1] = Math.abs(u) * r * .9 - r * .08; pos[i * 3 + 2] = s * Math.sin(th) * r;
    seed[i] = Math.random(); size[i] = sizeMin + Math.pow(Math.random(), 3) * (sizeMax - sizeMin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: time, uPx: px }, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -8;
  return p;
}

export function createGalaxy(renderer, { low = false, orbitCenter = new THREE.Vector3(0, 14, -58), orbitRadius = 30, pivotY = orbitCenter.y } = {}) {
  /* (las estrellas se dibujan como discos suaves de 1–4 px: finas, sin bloques) */
  const group = new THREE.Group();
  const time = { value: 0 }, px = { value: 1 };
  const rt = bakeNebula(renderer, low ? 1024 : 2048, low ? 512 : 1024);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(190, 48, 24),
    new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false })
  );
  dome.renderOrder = -10; dome.frustumCulled = false; dome.rotation.z = .25;
  group.add(dome);

  const far = starLayer(low ? 500 : 1100, 150, 175, .8, 1.7, time, px);
  const near = starLayer(low ? 120 : 260, 80, 120, 1.1, 2.6, time, px);
  group.add(far, near);

  /* Polvo que orbita alrededor del holograma: un disco inclinado de partículas; la órbita se resuelve en el
     vertex shader (ángulo = fase + tiempo · velocidad kepleriana aproximada). */
  const N = low ? 220 : 520, pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = orbitRadius * (.55 + Math.random() * .75); pos[i * 3 + 1] = (Math.random() - .5) * 5; pos[i * 3 + 2] = Math.random() * 6.2832; seed[i] = Math.random(); size[i] = 1.2 + Math.pow(Math.random(), 2) * 3.2; }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  dg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const dm = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uPx: px },
    vertexShader: /* glsl */`
      attribute float aSeed; attribute float aSize; uniform float uTime; uniform float uPx; varying float vTw; varying float vSeed;
      void main() {
        vSeed = aSeed;
        float r = position.x, a = position.z + uTime * (0.9 / sqrt(r)) * (0.6 + aSeed * 0.8);
        vec3 p = vec3(cos(a) * r, position.y + sin(uTime * 0.4 + aSeed * 30.0) * 0.8, sin(a) * r * 0.55);
        vTw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 50.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPx * (0.6 + 0.4 * vTw);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  const dust = new THREE.Points(dg, dm); dust.frustumCulled = false; dust.renderOrder = -6;
  dust.position.copy(orbitCenter); dust.rotation.set(.38, 0, -.22);
  group.add(dust);

  let orbitScale = 1;
  return {
    group,
    /** El disco de polvo acompaña al holograma cuando este se escala para caber en el cuadro (desde `pivotY`). */
    setOrbitScale(s) {
      if (s === orbitScale) return; orbitScale = s;
      dust.scale.setScalar(s); dust.position.y = pivotY + (orbitCenter.y - pivotY) * s;
    },
    update(dt, t) {
      time.value = t;
      px.value = Math.max(1, renderer.domElement.height / 720);
      dome.rotation.y = t * .004;         // giro orbital muy lento de toda la galaxia
      far.rotation.y = t * .006;
      near.rotation.y = -t * .011;        // la capa cercana gira al revés: paralaje de profundidad
    },
    dispose() {
      rt.dispose(); dome.geometry.dispose(); dome.material.dispose();
      for (const o of [far, near, dust]) { o.geometry.dispose(); o.material.dispose(); }
    }
  };
}

/* Luciérnagas: n puntos que deambulan dentro de un anillo (rMin–rMax) entre yMin e yMax. */
export function createFireflies({ n = 120, rMin = 3, rMax = 13, yMin = .6, yMax = 6, colorA = 0xb07bff, colorB = 0xff7ad9, size = .22 } = {}) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, r = rMin + Math.sqrt(Math.random()) * (rMax - rMin);
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = yMin + Math.random() * (yMax - yMin); pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const u = { uTime: { value: 0 }, uScale: { value: 400 }, uA: { value: new THREE.Color(colorA) }, uB: { value: new THREE.Color(colorB) }, uSize: { value: size }, uGain: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float uTime; uniform float uScale; uniform float uSize;
      varying float vGlow; varying float vMix;
      void main() {
        float t = uTime;
        // vaivén orgánico: tres senos desfasados por eje, distintos para cada luciérnaga
        vec3 w = vec3(
          sin(t * (0.21 + aSeed.x * 0.3) + aSeed.y * 40.0) * 1.3 + sin(t * 0.9 + aSeed.z * 20.0) * 0.25,
          sin(t * (0.33 + aSeed.y * 0.25) + aSeed.z * 31.0) * 0.7,
          cos(t * (0.19 + aSeed.z * 0.3) + aSeed.x * 27.0) * 1.3 + cos(t * 0.8 + aSeed.y * 17.0) * 0.25);
        vec4 mv = modelViewMatrix * vec4(position + w, 1.0);
        // parpadeo lento, con apagados breves (como una luciérnaga)
        float b = 0.5 + 0.5 * sin(t * (0.7 + aSeed.x * 1.6) + aSeed.y * 60.0);
        vGlow = smoothstep(0.15, 0.9, b);
        vMix = aSeed.z;
        gl_PointSize = uSize * (0.6 + aSeed.x * 0.8) * (0.5 + 0.5 * vGlow) * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA; uniform vec3 uB; uniform float uGain; varying float vGlow; varying float vMix;
      void main() {
        vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard;
        float halo = smoothstep(0.5, 0.0, d), core = smoothstep(0.14, 0.0, d);
        vec3 c = mix(uA, uB, vMix) * halo + vec3(1.0) * core * 0.6;
        float a = (halo * 0.55 + core * 0.5) * vGlow * uGain;
        gl_FragColor = vec4(c * a, a);
      }`
  });
  const points = new THREE.Points(g, m); points.frustumCulled = false; points.renderOrder = 3;
  return {
    points,
    set gain(v) { u.uGain.value = v; },
    update(t, renderer) { u.uTime.value = t; if (renderer) u.uScale.value = renderer.domElement.height / (2 * Math.tan(31 * Math.PI / 180)); },
    dispose() { g.dispose(); m.dispose(); }
  };
}
