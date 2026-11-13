/* ======================================================================
   FLAUXUS — core/voiceState.js
   Estado mínimo de la locución en off. Vive aparte para que AudioSystem
   pueda silenciar la voz sin importar la UI ni crear un ciclo.
   ====================================================================== */
/* t = segundo de la narración que marca ahora el reloj de los subtítulos (ui/voice.js). */
export const VO = { active: false, armed: true, el: null, tok: 0, t: 0, cache: new Map() };
