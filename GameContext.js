/* ======================================================================
   FLAUXUS — GameContext.js
   Contenedor de referencias compartidas entre Main.js y Rooms.js.
   Rompe la dependencia circular: Main ← GameContext ← Rooms,
   en lugar del ciclo roto Main ↔ Rooms.
   ====================================================================== */

/**
 * GX — contexto global del juego.
 * - Main.js lo rellena con GX._set(refs) al inicio.
 * - Main.js actualiza GX.W, GX.H, GX.T, etc. cada frame.
 * - Rooms.js lo importa y usa las variables de módulo que se copian
 *   en roomsInit(). Para valores dinámicos (W, H, T, ptr, ctx, bloom,
 *   S, avatarObj, roomGroup) se leen de GX directamente en cada uso.
 */
export const GX = {
  /* Three.js / scene */
  scene: null, camera: null, bloom: null, roomGroup: null, avatarObj: null,
  /* Canvas 2D */
  ctx2d: null,
  /* Estado del juego */
  S: null,
  /* Helpers de render */
  mat: null, makeDust: null, glowSprite: null, makeTextSprite: null,
  animAvatar: null, rimSet: null,
  /* FX 2D */
  burst: null, ringFx: null, ftext: null, shake: null, glowCircle: null, bolt: null, toScreen: null,
  /* Constantes (inmutables) */
  LIME: 0, LIMEH: '', PAPER: '', SERIF: '', FONT: '', PALE: 0,
  CARDS: null, OPLIST: null, HAND: null, EXPERIMENT: null, QUALITY: null,
  V3: null,
  /* Utilidades (inmutables) */
  clamp: null, lerp: null, damp: null, rand: null, lerpAngle: null,
  /* Input */
  TOUCH: false, ptr: null, keys: null, ptrActive: null, moveInput: null,
  /* UI */
  hint: null, toast: null, $: null,
  /* Juego */
  finish: null, groundController: null,
  /* Dinámicos — se actualizan cada frame desde Main.js */
  W: 0, H: 0, DPR: 1, T: 0, roomGen: 0,

  /** Llamar desde Main.js después de declarar todas las variables */
  _set(refs) {
    Object.assign(this, refs);
  }
};
