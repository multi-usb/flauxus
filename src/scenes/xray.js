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

export function createXray(hero, { mobile, reducedMotion }) {
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
  // El esqueleto vive en coordenadas de escena (pies en y = 0), igual que la figura. Se carga DESPUÉS de PRESS START
  // (fuera del presupuesto de la primera carga), en un momento libre.
  let bones = null;
  let loading = false;
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
    hero.scene.add(bones);
  });
  };
  // Índice espacial para el rayo (se construye en un momento libre: ~100 ms una sola vez)
  const buildBVH = () => hero.meshes.forEach((m) => {
    if (!m.geometry.boundsTree) { m.geometry.computeBoundsTree = computeBoundsTree; m.geometry.computeBoundsTree(); }
    m.raycast = acceleratedRaycast;
  });
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 200)))(buildBVH);

  // ---------- Entrada: cursor en escritorio; tap/arrastre en táctil ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointer = { x: 0, y: 0, inside: false, touching: false, dirty: false };
  const RADIUS = mobile ? 96 : 130; // px CSS
  let amount = 0;
  let hit = false;
  let hitY = -1;
  let releaseAt = 0;
  let pulse = 0;
  const castAt = { x: -1e4, y: -1e4 };
  raycaster.firstHitOnly = true;
  let leaveAt = 0;

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !pointer.touching) return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; pointer.dirty = true;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    pointer.touching = true; pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; pointer.dirty = true;
    castAt.x = -1e4; // un toque siempre se evalúa
  }, { passive: true });
  const up = (e) => {
    if (e.pointerType !== 'touch') return;
    pointer.touching = false;
    releaseAt = performance.now() + 600; // la radiografía se queda un instante tras soltar
  };
  addEventListener('pointerup', up, { passive: true });
  addEventListener('pointercancel', up, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.inside = false; });
  let scrolled = false;
  addEventListener('scroll', () => { pointer.dirty = true; scrolled = true; }, { passive: true }); // la cámara se mueve: recalcular

  // enabled: la escena del personaje está en pantalla; scale: resolución interna (px internos por px CSS)
  function update({ enabled, dt, time, scale, level }) {
    if (!loading && document.documentElement.classList.contains('started')) {
      loading = true;
      (window.requestIdleCallback || ((fn) => setTimeout(fn, 300)))(loadBones);
    }
    // Con el índice espacial, el rayo cuesta décimas de ms: se lanza en cada cuadro en que el puntero o la cámara se movieron.
    const active = mobile ? pointer.touching : pointer.inside;
    const now = performance.now();
    const moved = Math.abs(pointer.x - castAt.x) + Math.abs(pointer.y - castAt.y) > 0.5 || scrolled;
    if (pointer.dirty && enabled && active && moved) {
      pointer.dirty = false;
      scrolled = false;
      castAt.x = pointer.x; castAt.y = pointer.y;
      ndc.set((pointer.x / innerWidth) * 2 - 1, -(pointer.y / innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, hero.camera);
      const h = raycaster.intersectObjects(hero.meshes, false)[0];
      hit = !!h;
      hitY = h ? h.point.y : -1;
    }
    const touchHeld = mobile ? (pointer.touching || performance.now() < releaseAt) : true;
    const want = enabled && pointer.inside && hit && touchHeld ? 1 : 0;
    // Aparece al instante; al salir se cierra rápido (90 ms) sin parpadear entre huecos (brazo/torso).
    if (want) { amount = 1; leaveAt = 0; } else {
      if (!leaveAt) leaveAt = now;
      if (now - leaveAt > 60) amount = Math.max(0, amount - dt / 0.09);
    }
    pulse = Math.max(0, pulse - dt * 1.6);

    const open = amount * (1 + pulse * 0.18);
    uniforms.uRadius.value = RADIUS * scale * open;
    uniforms.uCenter.value.set(pointer.x * scale, (innerHeight - pointer.y) * scale);
    uniforms.uTime.value = reducedMotion ? 0 : time;
    uniforms.uLevel.value = level;
    uniforms.uPulse.value = pulse;
    uniforms.uScale.value = scale;
    const on = amount > 0;
    for (const l of layers) l.visible = on;
    if (bones) bones.visible = on;
    return { amount, x: pointer.x, y: pointer.y, radius: RADIUS * open, hit: hit && want > 0, hitY, touching: pointer.touching };
  }
  // Una nota de María Clara acaba de sonar: los huesos se encienden.
  function note(v = 1) { pulse = Math.max(pulse, v); }

  return { update, note };
}
