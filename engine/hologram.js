/* ======================================================================
   FLAUXUS — engine/hologram.js
   Holograma coreográfico de SOL♯: María Clara con la skin cyborg,
   gigante y translúcida, interpretando en el fondo negro del nivel.

   No es un personaje: no camina por el escenario, no colisiona, no recibe
   ni proyecta sombras y no interviene en el minijuego. Es una presencia
   escénica lejos, detrás del núcleo.

   Reutiliza el rig cyborg que la sala ya carga para la avatar (misma
   geometría, mismas texturas, mismos clips Idle/Walking horneados): no hay
   modelo nuevo. Solo cambia el material (una capa aditiva cian/rosada con
   líneas de barrido) y la animación:
   · la pose de flauta del juego (IK sobre la boca) mientras gira despacio,
     se balancea y respira con el volumen de la música;
   · cada 4,5 s alterna con pasos en el sitio (clip Walking) que, con el
     giro, se leen como un desplazamiento coreográfico.

   Rendimiento: una malla con skinning + un mixer. Se vigila el tiempo por
   cuadro: si sube, el holograma se anima a la mitad de frecuencia y, si
   sigue alto, se apaga. En calidad baja (táctil) arranca a media frecuencia.
   ====================================================================== */
import * as THREE from 'three';
import { avatar, animAvatar } from './avatar.js';

const CYAN = new THREE.Color(0x19c6d9), PINK = new THREE.Color(0xff4fb8);

export function createHologram({ low = false, scale = 4.2 } = {}) {
  const root = avatar('cyborg');
  const u = root.userData;
  root.scale.setScalar(scale);
  root.renderOrder = 2;
  root.visible = false; // aparece cuando el rig real (no el marcador provisional) está listo

  const time = { value: 0 };
  const holoMat = new THREE.MeshBasicMaterial({
    color: CYAN.clone(), transparent: true, opacity: .34,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide
  });
  /* Líneas de barrido en espacio de pantalla y un parpadeo leve: lectura de holograma sin posproceso. */
  holoMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = time;
    sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float scan = 0.62 + 0.38 * step(0.5, fract(gl_FragCoord.y * 0.22 - uTime * 3.0));
       float band = 0.85 + 0.15 * sin(gl_FragCoord.y * 0.012 + uTime * 1.7);
       gl_FragColor.rgb *= scan * band;
       gl_FragColor.a *= scan;`
    );
  };

  let ready = false;
  function adopt() {
    root.traverse(o => {
      if (!o.isMesh) return;
      /* La geometría es la del rig en caché (la comparte la avatar de la sala): marcarla para que
         clearGroup() no la libere al salir de SOL. */
      if (o.geometry) o.geometry.userData.keep = true;
      o.material = holoMat;
      o.castShadow = false; o.receiveShadow = false; o.renderOrder = 2; // después de los anillos del núcleo
    });
    if (u.flute) u.flute.userData.mat = null; // el fundido de la flauta no toca el material del holograma
    root.visible = true;
    ready = true;
  }
  Promise.resolve(u.loading).then(() => { if (u.loaded) adopt(); });

  /* Vigilancia de coste: media móvil del tiempo de cuadro (ms). */
  let avg = 16, level = low ? 1 : 0, frame = 0, cool = 4;
  const base = { yaw: 0, y: 0 };

  return {
    group: root,
    place(x, y, z, yaw = 0) { root.position.set(x, y, z); root.rotation.y = yaw; base.yaw = yaw; base.y = y; },
    update(dt, t, music = 0) {
      if (!ready || level >= 2) return;
      avg += (dt * 1000 - avg) * Math.min(1, dt / 1.5);
      cool -= dt;
      if (cool <= 0) {
        if (avg > 40 && level < 2) { level++; cool = 4; if (level >= 2) { root.visible = false; return; } }
        else if (avg > 26 && level < 1) { level = 1; cool = 4; }
      }
      if (level === 1 && (frame++ & 1)) return; // media frecuencia
      time.value = t;

      /* Coreografía: frases de 4,5 s que alternan pose de flauta y pasos en el sitio. */
      const phrase = Math.floor(t / 4.5) % 2, steps = phrase === 1;
      animAvatar(root, steps ? 1.6 : 0, t, true, music);
      if (u.actions?.walk) u.actions.walk.timeScale = .55; // pasos lentos, de danza
      root.rotation.y = base.yaw + Math.sin(t * .32) * 1.1 + (steps ? Math.sin(t * .9) * .25 : 0);
      root.position.y = base.y + Math.sin(t * 1.1) * .12 * root.scale.y;
      u.visual.rotation.z = Math.sin(t * 1.25) * .07;
      u.visual.rotation.x = Math.sin(t * .8) * .04;

      /* Color: cian del traje que deriva hacia el rosado; brilla un poco más con la música. */
      const k = .5 + .5 * Math.sin(t * .45);
      holoMat.color.copy(CYAN).lerp(PINK, k * .55);
      holoMat.opacity = (.38 + Math.min(.14, music * .12)) * (.93 + .07 * Math.sin(t * 23.0));
    },
    dispose() { holoMat.dispose(); }
  };
}
