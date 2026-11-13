import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// RADIOGRAFÍA al hover (tap/arrastre en móvil).
// Bajo el cursor se abre un círculo donde la piel de María Clara se DISUELVE (umbral con ruido + borde verde que
// arde en el frente de disolución) y aparece lo que hay debajo:
//   1. tejido blando: la propia malla como carcasa translúcida (fresnel tenue),
//   2. el esqueleto: MODELADO hueso por hueso (tools/skeleton.mjs → public/models/skeleton.glb, 95 piezas: cráneo con
//      órbitas, cavidad nasal, pómulos, dientes y mandíbula; vértebras con arco y apófisis; 12 pares de costillas…)
//      y ajustado a su pose medida. El GLB de María Clara no trae huesos: es una reconstrucción, no anatomía del modelo.
// Aparece al instante: el rayo contra su malla usa un índice espacial (three-mesh-bvh) y corre en cada cuadro.
// Cuando suena una nota de María Clara (pulse) los huesos se encienden y el círculo se abre un poco más.
const VERDE = new THREE.Color(0xc2fe0b);

// Umbral del círculo con ruido: el borde no es un compás, es una disolución orgánica que hierve despacio.
const DISSOLVE = /* glsl */ `
  float xHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float xNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(xHash(i), xHash(i + vec2(1, 0)), f.x), mix(xHash(i + vec2(0, 1)), xHash(i + vec2(1, 1)), f.x), f.y);
  }
  // devuelve la distancia firmada al frente de disolución (negativa = dentro de la radiografía)
  float xFront(vec2 p, vec2 c, float r, float t) {
    vec2 q = (p - c) / max(r, 1.0);
    float n = xNoise(q * 3.2 + t * 0.35) * 0.6 + xNoise(q * 9.0 - t * 0.6) * 0.4;
    return distance(p, c) - r * (0.72 + 0.28 * n);
  }
`;

const vertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uTime;
  uniform float uLevel;
  uniform float uPulse;
  uniform float uScale;
  uniform float uKind;
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  ${DISSOLVE}
  void main() {
    vec2 p = gl_FragCoord.xy;
    if (uRadius < 0.5) discard;
    float f = xFront(p, uCenter, uRadius, uTime);
    if (f > 0.0) discard;
    float inner = smoothstep(0.0, -uRadius * 0.35, f);          // se afirma hacia el centro del círculo
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    float scan = 0.78 + 0.22 * step(1.0, mod(p.y / uScale, 3.0));
    float a;
    vec3 col = uColor;
    if (uKind < 0.5) {
      // tejido blando: casi invisible, solo el contorno del cuerpo
      a = (0.004 + fres * 0.1) * (0.6 + uLevel * 0.5);
      a *= scan * (0.35 + 0.65 * inner);
      gl_FragColor = vec4(col * a, 1.0);
    } else {
      // hueso opaco: luz de escáner (de frente-arriba) que revela el volumen, cavidades oscuras, borde brillante;
      // una línea de barrido recorre la lente; con cada nota el hueso se enciende.
      vec3 n = normalize(vN);
      float l = max(dot(n, normalize(vec3(0.3, 0.6, 0.8))), 0.0);
      float l2 = max(dot(n, normalize(vec3(-0.5, 0.2, 0.6))), 0.0);
      float sweep = exp(-pow((p.y - uCenter.y + uRadius * (1.0 - 2.0 * fract(uTime * 0.45))) / (3.0 * uScale), 2.0));
      vec3 c = uColor * (0.05 + 0.9 * pow(l, 1.3) + 0.2 * l2) * (0.85 + uLevel * 0.3 + uPulse * 0.7);
      c += mix(uColor, vec3(1.0), 0.6) * (pow(fres, 2.0) * 0.75 + uPulse * 0.25 * fres + sweep * 0.35);
      gl_FragColor = vec4(c * scan * (0.55 + 0.45 * inner), 1.0);
    }
    #include <colorspace_fragment>
  }
`;

export function createXray(hero, { mobile, reducedMotion, renderer }) {
  const uniforms = {
    uCenter: { value: new THREE.Vector2() },
    uRadius: { value: 0 },
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uPulse: { value: 0 },
    uScale: { value: 1 },
    uColor: { value: VERDE.clone() },
  };
  const make = (kind, extra = {}) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uKind: { value: kind } },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    ...extra,
  });
  const shellMat = make(0, { side: THREE.DoubleSide });
  const boneMat = make(1, { side: THREE.FrontSide, transparent: false, depthWrite: true, blending: THREE.NormalBlending });

  // La piel se disuelve dentro del círculo (mismo frente con ruido) y su borde arde en verde.
  const patch = (mat) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uXCenter = uniforms.uCenter;
      shader.uniforms.uXRadius = uniforms.uRadius;
      shader.uniforms.uXTime = uniforms.uTime;
      shader.uniforms.uXScale = uniforms.uScale;
      shader.uniforms.uXColor = uniforms.uColor;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `uniform vec2 uXCenter; uniform float uXRadius; uniform float uXTime; uniform float uXScale; uniform vec3 uXColor;
          ${DISSOLVE}
          void main() {
            float xF = uXRadius > 0.5 ? xFront(gl_FragCoord.xy, uXCenter, uXRadius, uXTime) : 1e5;
            if (xF < 0.0) discard;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
            // frente de disolución: una franja de 0–5 px que se enciende en verde
            float xEdge = 1.0 - smoothstep(0.0, 5.0 * uXScale, xF);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uXColor, xEdge * 0.9);`);
    };
    mat.needsUpdate = true;
  };
  hero.meshes.forEach((m) => patch(m.material));
  patch(hero.silhouetteMaterial);

  const layers = [];
  for (const m of hero.meshes) {
    m.updateMatrix();
    const shell = new THREE.Mesh(m.geometry, shellMat);
    shell.matrixAutoUpdate = false;
    shell.matrix.copy(m.matrix);
    m.parent.add(shell);
    layers.push(shell);
  }
  for (const l of layers) { l.renderOrder = 6; l.frustumCulled = false; l.visible = false; }
  // El esqueleto comparte el grupo de transformación de la figura para heredar su escala y posición
  // desde el primer fotograma (también durante el acercamiento de entrada). Se carga DESPUÉS de PRESS START.
  let bones = null;
  let loading = false;
  let bonesReady = false;
  const loadBones = () => {
  loading = true;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load('/models/skeleton.glb', (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = boneMat;
      o.renderOrder = 5;
      o.frustumCulled = false;
    });
    bones = gltf.scene;
    bones.visible = false;
    hero.figure.add(bones);
    bonesReady = true;
    try {
      renderer?.compile?.(hero.scene, hero.camera);
    } catch {
      // ignore
    }
  }, undefined, (error) => {
    console.error('No se pudo cargar el esqueleto para la radiografía.', error);
  });
  };
  // Carga inmediata del esqueleto para que esté listo desde el primer instante
  loadBones();

  // Índice espacial para el rayo (se construye en un momento libre: ~100 ms una sola vez)
  const buildBVH = () => hero.meshes.forEach((m) => {
    if (!m.geometry.boundsTree) { m.geometry.computeBoundsTree = computeBoundsTree; m.geometry.computeBoundsTree(); }
    m.raycast = acceleratedRaycast;
  });
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 150)))(buildBVH);

  // ---------- Entrada: cursor en escritorio; tap/arrastre en táctil ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false, touching: false };
  const RADIUS = mobile ? 105 : 142; // px CSS
  let amount = 0;
  let hit = false;
  let hitY = -1;
  let smoothX = innerWidth / 2;
  let smoothY = innerHeight / 2;
  let hasPointer = false;
  let releaseAt = 0;
  let pulse = 0;
  raycaster.firstHitOnly = true;
  let missAt = -Infinity;
  let lastHitY = -1;
  const HIT_GRACE_MS = 240; // ventana de tolerancia para cruzar costuras del modelo con fluidez

  const move = (e) => {
    if (e.pointerType === 'touch' && !pointer.touching) return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
    if (!hasPointer) { smoothX = pointer.x; smoothY = pointer.y; hasPointer = true; }
  };
  const down = (e) => {
    if (e.pointerType !== 'touch') return;
    pointer.touching = true; pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
    smoothX = pointer.x; smoothY = pointer.y; hasPointer = true;
  };
  const up = (e) => {
    if (e.pointerType !== 'touch') return;
    pointer.touching = false;
    releaseAt = performance.now() + 600; // la radiografía se queda un instante tras soltar
  };
  const leave = () => { pointer.inside = false; };

  // Los oyentes se montan y se desmontan: con el videojuego abierto la radiografía no escucha nada.
  // (Antes eran permanentes: un toque sobre [ JUEGA YA ] —que en celular queda encima de su cuerpo— abría la
  // radiografía, el iframe del juego se tragaba el «pointerup» y el estado quedaba encendido.)
  let listening = false;
  function listen(on) {
    if (on === listening) return;
    listening = on;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    window[fn]('pointermove', move, { passive: true });
    window[fn]('pointerdown', down, { passive: true });
    window[fn]('pointerup', up, { passive: true });
    window[fn]('pointercancel', up, { passive: true });
    document[fn]('pointerleave', leave);
  }
  listen(true);

  // Estado de reposo inmediato (sin fundido): nada tocado, círculo cerrado, capas de hueso y tejido apagadas.
  function reset() {
    pointer.touching = false;
    pointer.inside = false;
    hasPointer = false;
    releaseAt = 0;
    amount = 0;
    pulse = 0;
    hit = false;
    hitY = -1;
    lastHitY = -1;
    missAt = -Infinity;
    uniforms.uRadius.value = 0;
    uniforms.uPulse.value = 0;
    for (const l of layers) l.visible = false;
    if (bones) bones.visible = false;
  }
  // false: suelta los oyentes y vuelve al reposo (juego abierto). true: vuelve a escuchar desde un estado limpio.
  function setActive(on) {
    reset();
    listen(!!on);
  }

  // enabled: la escena del personaje está en pantalla; scale: resolución interna (px internos por px CSS)
  function update({ enabled, dt, time, scale, level }) {
    if (!loading) {
      loadBones();
    }
    const active = mobile ? pointer.touching : pointer.inside;
    const now = performance.now();
    if (enabled && active) {
      ndc.set((pointer.x / innerWidth) * 2 - 1, -(pointer.y / innerHeight) * 2 + 1);
      hero.camera.updateMatrixWorld(true);
      hero.figure.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, hero.camera);
      const h = raycaster.intersectObjects(hero.meshes, false)[0];
      if (h) {
        hit = true;
        hitY = h.point.y;
        lastHitY = hitY;
        missAt = -Infinity;
      } else {
        if (missAt < 0) missAt = now;
        hit = lastHitY >= 0 && now - missAt < HIT_GRACE_MS;
        hitY = hit ? lastHitY : -1;
      }
    } else {
      hit = false;
      hitY = -1;
      lastHitY = -1;
      missAt = -Infinity;
    }

    const touchHeld = mobile ? (pointer.touching || performance.now() < releaseAt) : true;
    const want = enabled && (pointer.inside || mobile) && hit && touchHeld ? 1 : 0;

    // Transición suave, orgánica y ultra-fluida al abrir y cerrar la radiografía
    if (want) {
      amount += (1 - amount) * Math.min(1, dt * 14);
    } else {
      amount += (0 - amount) * Math.min(1, dt * 9);
      if (amount < 0.003) amount = 0;
    }

    // Suavizado directo e hiper-reactivo de coordenadas para que la lente fluya con el puntero
    const followLerp = Math.min(1, dt * 32);
    smoothX += (pointer.x - smoothX) * followLerp;
    smoothY += (pointer.y - smoothY) * followLerp;

    pulse = Math.max(0, pulse - dt * 1.6);
    const open = amount * (1 + pulse * 0.18);

    const centerX = smoothX;
    const centerY = smoothY;
    uniforms.uRadius.value = RADIUS * scale * open;
    uniforms.uCenter.value.set(centerX * scale, (innerHeight - centerY) * scale);
    uniforms.uTime.value = reducedMotion ? 0 : time;
    uniforms.uLevel.value = level;
    uniforms.uPulse.value = pulse;
    uniforms.uScale.value = scale;
    const on = amount > 0.005;
    for (const l of layers) l.visible = on;
    if (bones) bones.visible = on;
    return { amount, x: centerX, y: centerY, radius: RADIUS * open, hit: hit && want > 0, hitY, touching: pointer.touching };
  }
  // Una nota de María Clara acaba de sonar: los huesos se encienden.
  function note(v = 1) { pulse = Math.max(pulse, v); }

  return { update, note, setActive };
}
