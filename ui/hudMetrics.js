/* ======================================================================
   FLAUXUS — ui/hudMetrics.js
   UNA sola medición del HUD por tanda (Main.js la lanza cada 8 cuadros) y
   tres lectores: la cámara (player.js · franja libre para la avatar), las
   interfaces de los minijuegos (--ui-top / GX.uiTop) y el holograma de SOL
   (piezas de la mitad alta). Antes cada uno medía por su cuenta, en cuadros
   distintos, las mismas piezas: hasta tres maquetaciones forzadas donde
   basta una. Aquí solo se LEEN cajas; quien escribe estilos es Main.js.
   ====================================================================== */
import { GX } from '../GameContext.js';

/* Qué aporta cada pieza: BAND = delimita la franja libre de la columna central · LOW = siempre es «lo de abajo»
   · TOP = empuja hacia abajo las interfaces de los minijuegos · SKY = puede tapar el cielo (holograma de SOL). */
const BAND = 1, LOW = 2, TOP = 4, SKY = 8;
const PIECES = [
  ['#progress', BAND | TOP | SKY], ['#btnBack', BAND | TOP | SKY], ['#btnVoSkip', BAND | TOP | SKY], ['#btnSkip', BAND | TOP | SKY],
  ['#roomHint', BAND | TOP | SKY], ['#roomInfo', BAND | SKY], ['#objective', SKY], ['#hud .brandwrap', SKY], ['#hud .rightTop', SKY],
  ['#unlock', BAND], ['#coach', BAND], ['#prompt', BAND], ['#btnWalk', BAND], ['#btnLook', BAND],
  ['#vo', BAND | LOW], ['#joy', BAND | LOW], ['#laFrame', BAND | LOW], ['#tray', BAND | LOW], ['#laStatus', BAND | LOW],
  ['#laBtns', BAND | LOW], ['#miBtns', BAND | LOW], ['#handWrap', BAND]
];

/* top/bot: franja libre (px) en la columna central · uiTop: borde inferior de la franja superior del HUD (+10 px)
   · sky/skyN: piezas de la mitad alta como { x0, x1 (NDC), b (fracción del alto) } · sceneTop: límite superior
   extra que publica el minijuego activo cuando dibuja su interfaz en el lienzo (MI: los paneles de las frases;
   SOL: el sitio del sensor de la cabeza) · miBtnsTop: borde superior de los botones de MI (0 si no se ven). */
export const HM = { top: 0, bot: 1e5, uiTop: 0, sky: [], skyN: 0, sceneTop: 0, miBtnsTop: 0, n: 0 };
const VIS = { visibilityProperty: true }, VIS_SKY = { visibilityProperty: true, opacityProperty: true };
let els = null;

export function measureHud(W, H) {
  els ||= PIECES.map(([q, f]) => ({ el: document.querySelector(q), f })).filter(p => p.el);
  const x0 = W * .36, x1 = W * .64; let top = 0, bot = H, ui = 0; HM.skyN = 0; HM.miBtnsTop = 0;
  for (const { el, f } of els) {
    if (!el.offsetParent) continue;                                    // display:none (propio o heredado)
    if (el.checkVisibility && !el.checkVisibility(VIS)) continue;      // visibility:hidden (menú, epílogo, ayuda)
    const r = el.getBoundingClientRect(); if (r.width < 3 || r.height < 3) continue;
    if (f & TOP) ui = Math.max(ui, r.bottom);
    if (el.id === 'miBtns') HM.miBtnsTop = r.top;
    if (f & BAND && r.right >= x0 && r.left <= x1) {
      if (!(f & LOW) && r.top + r.bottom < H) top = Math.max(top, r.bottom); else bot = Math.min(bot, r.top)
    }
    if (f & SKY && r.bottom > 0 && r.top <= H * .5 && (!el.checkVisibility || el.checkVisibility(VIS_SKY))) {
      const o = HM.sky[HM.skyN] || (HM.sky[HM.skyN] = { x0: 0, x1: 0, b: 0 }); HM.skyN++;
      o.x0 = (r.left - 8) / W * 2 - 1; o.x1 = (r.right + 8) / W * 2 - 1; o.b = (r.bottom + 8) / H
    }
  }
  HM.top = Math.max(top, HM.sceneTop || 0); HM.bot = bot; HM.uiTop = Math.round(ui + 10); HM.n++;
  GX.uiTop = HM.uiTop
}
