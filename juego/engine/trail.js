/* ======================================================================
   FLAUXUS — engine/trail.js
   Estela mágica del personaje (sala FA♯ · El cuerpo).

   Un único `THREE.Points` con un búfer fijo de partículas (pool): no se
   crean ni destruyen objetos mientras se juega. Cada partícula nace junto
   al cuerpo cuando la avatar se mueve, sube y se arremolina despacio, y se
   apaga en 1,4–2,6 s. El color parte del verde FLAUXUS (#C2FE0B) con un
   núcleo casi blanco: luminosa pero sin saturar la pantalla.

   Coste: una llamada de dibujo, mezcla aditiva sin escritura de
   profundidad y un bucle de CPU de ≤ 420 partículas por cuadro. En calidad
   baja (táctil) el pool baja a 180 y la emisión a la mitad.
   ====================================================================== */
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aLife;
  attribute float aSize;
  attribute float aSeed;
  uniform float uScale;
  varying float vLife;
  varying float vSeed;
  void main() {
    vLife = aLife;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // crece al nacer y se encoge al apagarse
    float k = (0.5 + 0.5 * smoothstep(0.0, 0.15, 1.0 - aLife)) * (0.45 + 0.55 * aLife);
    gl_PointSize = aSize * k * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uTime;
  varying float vLife;
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.16, 0.0, d);
    // centelleo suave, distinto para cada partícula
    float tw = 0.75 + 0.25 * sin(uTime * 9.0 + vSeed * 40.0);
    vec3 col = mix(uColor, vec3(1.0, 1.0, 0.92), core * 0.5);
    float a = (halo * 0.7 + core * 0.6) * vLife * tw;
    gl_FragColor = vec4(col * a, a);
  }
`;

export function createMagicTrail({ color = 0xc2fe0b, low = false } = {}) {
  const N = low ? 180 : 420;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const life = new Float32Array(N), maxLife = new Float32Array(N), size = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = Math.random(); pos[i * 3 + 1] = -999; }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;

  let head = 0, acc = 0, time = 0;
  const last = new THREE.Vector3(), dir = new THREE.Vector2(0, 1); let hasLast = false;
  const rate = low ? 55 : 110; // partículas por segundo a velocidad de caminata

  function spawn(x, y, z, speed, bx, bz) {
    const i = head; head = (head + 1) % N;
    const a = Math.random() * Math.PI * 2, r = .1 + Math.random() * .3, back = .35 + Math.random() * .5;
    // nace detrás del cuerpo (contra el sentido de la marcha): la estela queda atrás, no encima
    pos[i * 3] = x + bx * back + Math.cos(a) * r;
    pos[i * 3 + 1] = y + .2 + Math.random() * 1.5; // de los tobillos a los hombros
    pos[i * 3 + 2] = z + bz * back + Math.sin(a) * r;
    // deriva lenta hacia arriba y hacia afuera: un remolino que se queda atrás
    vel[i * 3] = Math.cos(a) * (.12 + Math.random() * .2);
    vel[i * 3 + 1] = .18 + Math.random() * .35;
    vel[i * 3 + 2] = Math.sin(a) * (.12 + Math.random() * .2);
    maxLife[i] = 1.8 + Math.random() * 1.4;
    life[i] = 1;
    // la mayoría finas; unas pocas más grandes («fragmentos luminosos»)
    // tamaño en metros (como PointsMaterial con sizeAttenuation): 17–29 cm; los fragmentos, 55 cm
    size[i] = (Math.random() < .12 ? .55 : .17 + Math.random() * .12) * (1 + Math.min(1, speed / 8) * .25);
  }

  return {
    points,
    /** Emite según la velocidad (m/s). Llamar cada cuadro con la posición de la avatar. */
    emit(p, speed, dt) {
      /* sentido de la marcha a partir del desplazamiento real: la estela nace detrás */
      if (hasLast) { const dx = p.x - last.x, dz = p.z - last.z, l = Math.hypot(dx, dz); if (l > 1e-4) dir.set(dx / l, dz / l) }
      last.copy(p); hasLast = true;
      if (speed < .3) return;
      acc += rate * Math.min(1.4, speed / 5.4) * dt;
      let born = false;
      while (acc >= 1) { acc -= 1; spawn(p.x, p.y, p.z, speed, -dir.x, -dir.y); born = true; }
      if (born) geo.attributes.aSize.needsUpdate = true; // el tamaño se fija al nacer: hay que subirlo a la GPU
    },
    update(dt, renderer) {
      time += dt;
      mat.uniforms.uTime.value = time;
      /* escala física: alto del búfer / (2·tan(fov/2)); fov vertical de las salas = 62° */
      if (renderer) mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(31 * Math.PI / 180));
      let any = false;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        any = true;
        life[i] = Math.max(0, life[i] - dt / maxLife[i]);
        // remolino: giro suave alrededor del eje vertical y frenado progresivo
        const vx = vel[i * 3], vz = vel[i * 3 + 2], sw = 1.6 * dt;
        vel[i * 3] = (vx - vz * sw) * (1 - .6 * dt);
        vel[i * 3 + 2] = (vz + vx * sw) * (1 - .6 * dt);
        vel[i * 3 + 1] *= (1 - .35 * dt);
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      if (any) {
        geo.attributes.position.needsUpdate = true;
        geo.attributes.aLife.needsUpdate = true;
      }
    }
  };
}

/* ======================================================================
   Cinta de recorrido sobre el piso (FA♯): la trayectoria que queda inscrita.

   Una sola malla (tira de triángulos) con un búfer FIJO de `max` puntos: al
   llenarse, el punto más viejo sale por la cola. No crece la geometría ni la
   memoria por mucho que dure la partida.
   El shader le da vida: la cinta ondula levemente, su brillo «corre» hacia
   la cabeza, los bordes son suaves y la cola se disuelve.
   ====================================================================== */
export function createFloorRibbon({ max = 160, color = 0xc2fe0b, width = .8 } = {}) {
  const pts = new Float32Array(max * 3); let n = 0;
  const pos = new Float32Array(max * 2 * 3), aU = new Float32Array(max * 2), aSide = new Float32Array(max * 2), aW = new Float32Array(max * 2);
  const idx = new Uint16Array((max - 1) * 6);
  for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
  for (let i = 0; i < max; i++) { aSide[i * 2] = -1; aSide[i * 2 + 1] = 1; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  geo.setAttribute('aW', new THREE.BufferAttribute(aW, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);
  const uni = { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uGain: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */`
      attribute float aU; attribute float aSide; attribute float aW; uniform float uTime;
      varying float vU; varying float vSide;
      void main() {
        vU = aU; vSide = aSide;
        vec3 p = position;
        p.y += 0.02 + 0.03 * sin(aU * 40.0 - uTime * 2.0) * aU;   // respira: leve ondulación vertical
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uColor; uniform float uGain; varying float vU; varying float vSide;
      float h(float x) { return fract(sin(x * 91.7) * 43758.5453); }
      void main() {
        float edge = 1.0 - vSide * vSide;                          // bordes suaves
        float core = pow(edge, 3.0);
        float flow = 0.55 + 0.45 * sin(vU * 60.0 - uTime * 3.2);   // pulsos que corren hacia la cabeza
        float grain = 0.8 + 0.2 * h(floor(vU * 140.0));            // textura orgánica
        float tail = pow(vU, 1.35);                                // la cola se disuelve
        float head = smoothstep(0.9, 1.0, vU);                     // la cabeza brilla
        vec3 col = mix(uColor, vec3(1.0, 1.0, 0.9), core * 0.45 + head * 0.4);
        float a = edge * (0.25 + 0.75 * tail) * flow * grain * (0.85 + head * 0.9) * uGain;
        gl_FragColor = vec4(col * a, a);
      }`
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2;

  function rebuild() {
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = pts[b * 3] - pts[a * 3], tz = pts[b * 3 + 2] - pts[a * 3 + 2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      /* ancho variable: nace fino en la cola, engorda hacia la cabeza y ondula a lo largo */
      const u = n > 1 ? i / (n - 1) : 1, w = width * (.35 + .65 * u) * (.75 + .25 * Math.sin(i * .9)) * .5;
      const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      pos.set([x - tz * w, y, z + tx * w, x + tz * w, y, z - tx * w], i * 6);
      aU[i * 2] = aU[i * 2 + 1] = u; aW[i * 2] = aW[i * 2 + 1] = w;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.aU.needsUpdate = true; geo.attributes.aW.needsUpdate = true;
    geo.setDrawRange(0, Math.max(0, n - 1) * 6);
  }

  return {
    mesh,
    /** Añade un punto al recorrido (posición del piso). */
    push(x, y, z) {
      if (n === max) { pts.copyWithin(0, 3); n--; }
      pts.set([x, y, z], n * 3); n++;
      rebuild();
    },
    reset() { n = 0; geo.setDrawRange(0, 0); },
    update(t, gain = 1) { uni.uTime.value = t; uni.uGain.value = gain; }
  };
}
