/* ======================================================================
   FLAUXUS — core/inputState.js
   Estado compartido del puntero y del teclado. Los listeners viven en
   Main.js; el movimiento y las salas solo leen estos valores.
   ====================================================================== */
export const ptr = { x: innerWidth / 2, y: innerHeight / 2, down: false, type: 'mouse', ui: false };
export const ptrActive = () => ptr.type === 'mouse' || ptr.down;
export const keys = new Set();
