import * as THREE from 'three';

// Piso retro-futurista: retícula de perspectiva infinita (videojuego 3D clásico), verde de marca sobre negro.
// Un solo plano con shader: líneas antialias en espacio de mundo (cada 1 m y cada 4 m), que se desvanecen hacia el
// horizonte; el plano sigue a la cámara para que nunca se vea su borde.
// Reacciona sin distraer: · el scroll la desliza (flujo hacia la cámara, con inercia)
//                         · el cursor enciende un charco de luz suave donde apunta sobre el piso
//                         · el bombo la aviva apenas.
// Bajo los pies de María Clara se apaga para que ella quede limpia.
export function createGrid({ mobile = false, reducedMotion = false } = {}) {
  const SIZE = 160;
  const uniforms = {
    uColor: { value: new THREE.Color(0xc2fe0b) },
    uCam: { value: new THREE.Vector3() },
    uPtr: { value: new THREE.Vector2(0, 0) },
    uPtrOn: { value: 0 },
    uFlow: { value: 0 },
    uBeat: { value: 0 },
    uFall: { value: mobile ? 0.07 : 0.05 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uCam; uniform vec2 uPtr;
      uniform float uPtrOn, uFlow, uBeat, uFall;
      varying vec3 vW;
      float lines(vec2 p, float s, float w) {
        vec2 q = p / s;
        vec2 fw = max(fwidth(q), vec2(1e-4));
        vec2 g = abs(fract(q - 0.5) - 0.5) / fw;
        // cuando la celda mide pocos píxeles (cerca del horizonte) la línea se apaga: sin moaré
        float far = 1.0 - smoothstep(0.12, 0.4, max(fw.x, fw.y));
        return (1.0 - min(min(g.x, g.y) / w, 1.0)) * far;
      }
      void main() {
        vec2 p = vW.xz + vec2(0.0, uFlow);
        float d = distance(vW.xz, uCam.xz);
        float minor = lines(p, 1.0, 1.0);
        float major = lines(p, 4.0, 1.4);
        float fade = exp(-d * uFall);                       // se pierde hacia el horizonte
        float feet = smoothstep(0.6, 2.4, length(vW.xz));   // limpio bajo sus pies
        float pool = exp(-pow(distance(vW.xz, uPtr) / 1.8, 2.0)) * uPtrOn;
        float a = (minor * 0.11 + major * 0.3) * fade * (0.25 + 0.75 * feet) * (1.0 + pool * 1.8 + uBeat * 0.4);
        a += pool * 0.035 * fade;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  const ray = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  let flowV = 0;
  let lastY = scrollY;

  // ptr: {x, y} en px (o x < 0 si no hay puntero); dt en s; beat 0..1
  function update(camera, ptr, dt, beat = 0) {
    const c = camera.position;
    uniforms.uCam.value.copy(c);
    // El plano acompaña a la cámara en pasos de 4 m (las líneas no se mueven).
    mesh.position.x = Math.round(c.x / 4) * 4;
    mesh.position.z = Math.round(c.z / 4) * 4;
    // Flujo por scroll, con inercia
    const sy = scrollY;
    const dy = sy - lastY;
    lastY = sy;
    if (!reducedMotion) {
      flowV += (Math.max(-60, Math.min(60, dy)) * 0.004 - flowV) * Math.min(1, dt * 6);
      uniforms.uFlow.value = (uniforms.uFlow.value + flowV) % 400;
    }
    // Charco de luz bajo el cursor
    let on = 0;
    if (ptr.x >= 0) {
      ndc.set((ptr.x / innerWidth) * 2 - 1, -(ptr.y / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(floor, hit) && hit.distanceTo(c) < 40) {
        uniforms.uPtr.value.set(hit.x, hit.z);
        on = 1;
      }
    }
    uniforms.uPtrOn.value += (on - uniforms.uPtrOn.value) * Math.min(1, dt * 4);
    uniforms.uBeat.value = reducedMotion ? 0 : beat;
  }
  return { mesh, update };
}
