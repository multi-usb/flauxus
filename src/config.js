// Configuración editable de la landing. Un solo lugar para lo que todavía no está decidido.

// URL del juego. Vacía = el CTA [ JUEGA YA ] reproduce el concept art a pantalla completa (fuente de verdad §19).
export const GAME_URL = '';

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
