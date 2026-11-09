/* ======================================================================
   FLAUXUS — engine/hologram.js
   Holograma monumental de SOL♯: María Clara con la skin cyborg, de unos
   130 m de alto, tocando la flauta detrás del escenario.

   No es un personaje: no camina por el escenario, no colisiona, no recibe
   ni proyecta sombras y no interviene en el minijuego.

   Técnica (impostor): la figura NO se dibuja a tamaño gigante en la escena.
   Se renderiza pequeña, en su propia escena, a una textura de 512×640
   (256×320 en calidad baja) y esa textura se proyecta en un único plano
   enorme con un shader holográfico. Así:
   · el coste de relleno (píxeles) de una figura de 50 m con mezcla aditiva
     se reduce a un plano con una lectura de textura;
   · la malla con skinning se dibuja una sola vez, a baja resolución y a
     media frecuencia (30 Hz), fuera de las pasadas de sombras y de bloom
     de la escena principal;
   · el aspecto holográfico (barrido, aberración cian/rosado, contorno
     luminoso, parpadeo, interferencias) sale del shader del plano.

   Reutiliza el rig cyborg que la sala ya carga para la avatar (misma
   geometría, mismas texturas, mismos clips horneados): no hay modelo nuevo.

   Coreografía: la pose de flauta del juego (IK sobre la boca) con giro
   lento de torso, balanceo, respiración con la música y frases de pasos
   en el sitio cada 4,5 s.

   Rendimiento adaptativo: si el tiempo por cuadro sube, la textura se
   actualiza cada 4 cuadros y, si sigue alto, se congela (queda la última
   imagen: el holograma no desaparece, solo deja de moverse).
   ====================================================================== */
import * as THREE from 'three';
import { avatar, animAvatar } from './avatar.js';
import { REDUCE } from '../core/util.js';

const CYAN = new THREE.Color(0x19c6d9), PINK = new THREE.Color(0xff4fb8);

export function createHologram(renderer, { low = false, height = 92 } = {}) {
  /* ---------- escena propia: la figura a escala 1 ---------- */
  const hs = new THREE.Scene();
  const root = avatar('cyborg');
  const u = root.userData;
  hs.add(root);
  hs.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(-2, 4, 5); hs.add(dl);
  /* Encuadre ortográfico fijo: 3,0 m de ancho × 3,3 m de alto (la figura de ~2,5 m ocupa tres cuartos del alto,
     con margen para la flauta y el vaivén). */
  const VW = 3.0, VH = 3.3;
  const hcam = new THREE.OrthographicCamera(-VW / 2, VW / 2, VH - .2, -.2, .1, 20);
  hcam.position.set(0, 0, 8); hcam.lookAt(0, 0, 0); hcam.position.y = 0; hcam.updateProjectionMatrix();
  const RW = low ? 256 : 512, RH = low ? 320 : 640;
  const rt = new THREE.WebGLRenderTarget(RW, RH, { depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

  let ready = false;
  Promise.resolve(u.loading).then(() => {
    if (!u.loaded) return;
    root.traverse(o => { if (o.isMesh) { if (o.geometry) o.geometry.userData.keep = true; o.castShadow = false; o.receiveShadow = false; } });
    ready = true;
  });

  /* ---------- plano monumental ---------- */
  const uni = {
    uMap: { value: rt.texture }, uTime: { value: 0 }, uA: { value: CYAN.clone() }, uB: { value: PINK.clone() },
    uGain: { value: 0 }, uMusic: { value: 0 }, uTexel: { value: new THREE.Vector2(1 / RW, 1 / RH) },
    uCalm: { value: REDUCE ? 1 : 0 } // movimiento reducido: sin interferencias ni parpadeo
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uCalm;
      uniform sampler2D uMap; uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uGain; uniform float uMusic; uniform vec2 uTexel;
      varying vec2 vUv;
      float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      void main() {
        vec2 uv = vUv;
        // interferencia: franjas horizontales que se desplazan un instante
        float band = floor(uv.y * 46.0), t = floor(uTime * 7.0);
        float glitch = step(0.965, h1(band * 0.37 + t)) * (h1(band + t * 1.3) - 0.5) * 0.045;
        uv.x += glitch * (1.0 - uCalm);
        // aberración: el rosado y el cian se separan (más con la música)
        float split = (0.006 + uMusic * 0.01) * (0.6 + 0.4 * sin(uTime * 1.7));
        vec4 c0 = texture2D(uMap, uv), cL = texture2D(uMap, uv - vec2(split, 0.0)), cR = texture2D(uMap, uv + vec2(split, 0.0));
        float lum = dot(c0.rgb, vec3(0.299, 0.587, 0.114));
        // contorno luminoso a partir del borde del alfa (4 lecturas)
        float e = 0.0;
        e += texture2D(uMap, uv + vec2(uTexel.x * 2.5, 0.0)).a; e += texture2D(uMap, uv - vec2(uTexel.x * 2.5, 0.0)).a;
        e += texture2D(uMap, uv + vec2(0.0, uTexel.y * 2.5)).a; e += texture2D(uMap, uv - vec2(0.0, uTexel.y * 2.5)).a;
        float edge = clamp(abs(c0.a * 4.0 - e), 0.0, 1.0);
        // líneas de barrido que suben + una onda ancha que recorre la figura
        float scan = 0.55 + 0.45 * step(0.5, fract(uv.y * 150.0 - uTime * 1.6));
        float sweep = smoothstep(0.06, 0.0, abs(fract(uv.y - uTime * 0.11) - 0.5)) * 0.9;
        float k = clamp(uv.y * 1.15 + 0.12 * sin(uTime * 0.45), 0.0, 1.0);
        vec3 tint = mix(uA, uB, k * k);
        vec3 col = tint * (0.30 + lum * 1.25) * c0.a * scan;
        col += uB * cL.a * (1.0 - c0.a) * 0.55 + uA * cR.a * (1.0 - c0.a) * 0.55;   // fantasmas laterales
        col += mix(uA, vec3(1.0), 0.35) * edge * 1.1;
        col += tint * sweep * c0.a * 0.8;
        // nace de la bruma: se disuelve hacia abajo
        float fade = smoothstep(0.16, 0.44, uv.y) * smoothstep(1.0, 0.96, uv.y);
        float flick = 0.93 + 0.07 * sin(uTime * 23.0) * sin(uTime * 3.1) * (1.0 - uCalm);
        col *= fade * flick * uGain * (1.0 + uMusic * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  mat.userData.keep = true;
  const geo = new THREE.PlaneGeometry(height * (VW / VH), height); geo.userData.keep = true;
  const plane = new THREE.Mesh(geo, mat);
  plane.frustumCulled = false; plane.renderOrder = -4;

  /* halo de luz detrás de la figura: separa el holograma de la galaxia */
  const haloGeo = new THREE.PlaneGeometry(height * 1.5, height * 1.25); haloGeo.userData.keep = true;
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uA: uni.uA, uGain: uni.uGain, uTime: uni.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uA; uniform float uGain; uniform float uTime; varying vec2 vUv; void main(){ float d = length((vUv - vec2(0.5, 0.56)) * vec2(1.25, 1.0)); float a = smoothstep(0.5, 0.0, d); a = a * a * (0.16 + 0.03 * sin(uTime * 0.8)); gl_FragColor = vec4(uA * a * uGain, 1.0); }'
  });
  haloMat.userData.keep = true;
  const halo = new THREE.Mesh(haloGeo, haloMat); halo.position.z = -1.5; halo.renderOrder = -5; halo.frustumCulled = false;

  const group = new THREE.Group();
  group.add(halo, plane);

  let avg = 16, level = low ? 1 : 0, frame = 0, cool = 4, gain = 0, target = .9;
  const clear = new THREE.Color();

  function renderFigure(dt, t, music) {
    /* coreografía */
    const steps = !REDUCE && Math.floor(t / 4.5) % 2 === 1;
    animAvatar(root, steps ? 1.6 : 0, t, true, music);
    if (u.actions?.walk) u.actions.walk.timeScale = .5;                 // pasos lentos, de danza
    root.rotation.y = Math.sin(t * .31) * .55 + (steps ? Math.sin(t * .9) * .22 : 0);
    root.position.y = Math.sin(t * 1.05) * .035;
    root.position.x = Math.sin(t * .21) * .12;
    u.visual.rotation.z = Math.sin(t * 1.2) * .06;                      // balanceo de torso
    u.visual.rotation.x = Math.sin(t * .78) * .05 + music * .04;        // se inclina con la frase

    const prevRT = renderer.getRenderTarget(), prevA = renderer.getClearAlpha(), prevSh = renderer.shadowMap.enabled;
    renderer.getClearColor(clear);
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(hs, hcam);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(clear, prevA);
    renderer.shadowMap.enabled = prevSh;
  }

  return {
    group,
    place(x, y, z) { group.position.set(x, y + height / 2, z); },
    /** Intensidad objetivo (0–1): más presente en el preludio, más tenue durante el minijuego. */
    setPresence(v) { target = v; },
    update(dt, t, music = 0, camera) {
      if (!ready) return;
      uni.uTime.value = t; uni.uMusic.value = Math.min(1, music);
      gain += (target - gain) * Math.min(1, dt * 1.4); uni.uGain.value = gain;
      const k = .5 + .5 * Math.sin(t * .4);
      uni.uB.value.copy(PINK).lerp(CYAN, k * .25);
      /* siempre de frente a la cámara en horizontal: una proyección, no un cuerpo */
      if (camera) group.rotation.y = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);

      avg += (dt * 1000 - avg) * Math.min(1, dt / 1.5); cool -= dt;
      if (cool <= 0) { if (avg > 40 && level < 3) { level = 3; cool = 6; } else if (avg > 26 && level < 2) { level = 2; cool = 4; } else if (avg < 15 && level > (low ? 1 : 0)) { level--; cool = 6; } }
      frame++;
      if (level >= 3) return;                                   // congelado: queda la última imagen
      /* 30 Hz cuando el holograma es protagonista (preludio); 20 Hz durante el minijuego, donde cede el foco y
         la CPU se necesita para los sensores; 15 Hz si el equipo va justo. */
      const every = level === 2 ? 4 : target < .7 ? 3 : 2;
      if (frame % every) return;
      renderFigure(dt * every, t, music);
    },
    get level() { return level; },
    dispose() { rt.dispose(); geo.dispose(); mat.dispose(); haloGeo.dispose(); haloMat.dispose(); }
  };
}
