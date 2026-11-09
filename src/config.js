// Configuración editable de la landing. Un solo lugar para lo que todavía no está decidido.

// URL del juego. [ JUEGA YA ] lo abre a pantalla completa dentro de la landing (ui/game.js); vite.config.js lo
// sirve en /juego/ desde ../juego. Vacía = el CTA reproduce el concept art a pantalla completa (fuente de verdad §19).
export const GAME_URL = '/juego/';

// Recorrido de scroll de cada momento fijado, en pantallas (1 = la altura de la ventana).
// Las animaciones de cada momento están escritas en proporciones de este recorrido, así que alargarlo
// no cambia la coreografía: solo le da a cada cuadro más espacio. Antes M3/M4/M5 apretaban 3–4 cuadros
// por pantalla (M5: una sala cada ~0,3 pantallas) y el scroll se sentía hipersensible después del portal.
// Ritmo objetivo: ~0,6–0,7 pantallas por cuadro, parecido al de M1 y M2.
// Tercera pasada (nov 2026): el recorrido seguía sintiéndose rápido para LEER. El scroll es el nativo del navegador
// (no hay multiplicadores ni librería de inercia: solo un suavizado de lectura de 120 ms), así que la velocidad
// percibida depende de cuánta rueda/dedo hace falta por cuadro de contenido. Se sube a ~1 pantalla por cuadro:
// una frase, una fotografía con su texto o una sala por cada «pantalla» de desplazamiento.
export const SCROLL_SCREENS = {
  m1: 1.6, // 1.2 → 1.6
  m2: 1.8, // 1.2 → 1.8 · el portal se enciende y deja leer el aviso antes de pasar
  m3: 5.0, // 1.6 → 3.2 → 5.0 · A, B (+ rebobinado), C y la escala de notas
  m4: 5.0, // 2.4 → 3.2 → 5.0 · cinco fotografías, dos citas y el nombre
  m5: 6.6, // 2.4 → 4.4 → 6.6 · seis salas (~0,8 pantallas cada una), la octava y la cita
};

export const MODELS = {
  desktop: '/models/chr_mariaclara_hero_desktop.glb',
  mobile: '/models/chr_mariaclara_hero_mobile.glb',
};

// Presets de calidad (TECHNICAL_SPEC: resolución interna 0,6 escritorio / 0,5 móvil; manual §07: preset baja sin posproceso).
// scale = resolución interna del 3D respecto al viewport (CSS px). scanlines = intensidad de la línea oscura (manual: 40 %).
export const QUALITY = {
  alta: { scale: 0.6, postfx: true },
  media: { scale: 0.5, postfx: true },
  baja: { scale: 0.5, postfx: false },
};

export const MAX_DPR = 1.5;
export const SCANLINE_STRENGTH = 0.4;

// Si el FPS cae por debajo de este valor durante FPS_FALL_SECONDS se baja a preset "baja" (manual §07).
export const FPS_FLOOR = 30;
export const FPS_FALL_SECONDS = 5;
