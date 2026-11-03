/* ======================================================================
   FLAUXUS — core/voiceState.js
   Estado mínimo de la locución en off. Vive aparte para que AudioSystem
   pueda silenciar la voz sin importar la UI ni crear un ciclo.
   ====================================================================== */
export const VO = { active: false, armed: true, el: null, tok: 0, cache: new Map() };
