/* ======================================================================
   FLAUXUS — core/time.js
   Reloj global. `T` es un binding vivo: quien lo importa ve el valor
   actualizado sin necesidad de pasarlo por parámetro.
   ====================================================================== */
export let T = 0;

/** Avanza el reloj un frame. Solo Main.js lo llama. */
export function tickTime(dt) { T += dt }
