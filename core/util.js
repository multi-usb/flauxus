/* ======================================================================
   FLAUXUS — core/util.js
   Utilidades, constantes y primitivas compartidas por todo el proyecto.
   Aquí no hay estado de juego: solo funciones puras y valores fijos.
   ====================================================================== */
import * as THREE from 'three';

export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t };
export const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?input=touch fuerza la interfaz táctil (solo para pruebas en escritorio; la landing tiene el mismo parámetro).
export const TOUCH = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window) || new URLSearchParams(location.search).get('input') === 'touch';
document.body.classList.toggle('touch', TOUCH);
export const V3 = THREE.Vector3;
export const LIME = 0xc2fe0b, LIMEH = '#c2fe0b', PAPER = '#efeadb', INKH = '#0d0e09', PALE = 0x8f8c7c;
// Tipografía de los textos dibujados en canvas (minijuegos, rótulos del atrio, epílogo): la de la landing.
// SERIF conserva su nombre histórico; ahora es la display Tektur (notas, cifras, rótulos).
export const FONT = "'Space Grotesk','Segoe UI',system-ui,sans-serif", SERIF = "'Tektur','Space Grotesk',system-ui,sans-serif";
// Dentro de la landing (iframe), la marca y la esquina superior izquierda son de la página anfitriona (style.css).
export let EMBEDDED = false;
try { EMBEDDED = window.self !== window.top; } catch { EMBEDDED = true; }
document.body.classList.toggle('embedded', EMBEDDED);
/* Embebido: el botón «Salir» es del propio juego (va en la barra superior, junto al resto del HUD) y le pide
   a la landing que cierre. Al avisar «listo», la landing retira su botón de respaldo: ya no hay dos sistemas
   dibujando controles en la misma esquina. */
if (EMBEDDED) {
  const ex = document.getElementById('btnExit');
  /* Antes de avisar a la landing se apaga el juego (audio, voz, bucle y WebGL): Main.js escucha «flauxus:teardown». */
  if (ex) { ex.hidden = false; ex.addEventListener('click', () => { dispatchEvent(new Event('flauxus:teardown')); try { parent.postMessage({ type: 'flauxus:exit' }, location.origin); } catch { } }); }
  try { parent.postMessage({ type: 'flauxus:ready' }, location.origin); } catch { }
}
export const qs = new URLSearchParams(location.search);
