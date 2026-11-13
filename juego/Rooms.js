/* ======================================================================
   FLAUXUS — Rooms.js
   Registro central de las seis salas.

   La ficha (metadatos, luz y locución) y la lógica de cada nivel viven
   en ./rooms/<ID>.js. Este archivo solo las agrupa y las expone a Main.js.
   ====================================================================== */
import { DO, meta as DO_META } from './rooms/DO.js';
import { RE, meta as RE_META } from './rooms/RE.js';
import { MI, meta as MI_META } from './rooms/MI.js';
import { FA, meta as FA_META } from './rooms/FA.js';
import { SOL, meta as SOL_META } from './rooms/SOL.js';
import { LA, meta as LA_META } from './rooms/LA.js';
import { bindRoomContext, refreshRoomContext } from './rooms/context.js';

const ROOM_IMPLS = [DO, RE, MI, FA, SOL, LA];

/** Fichas de sala ordenadas por id (1–6). */
export const ROOMS = [DO_META, RE_META, MI_META, FA_META, SOL_META, LA_META];

/** Implementación jugable por id de sala. */
export const IMPL = Object.fromEntries(ROOMS.map((r, i) => [r.id, ROOM_IMPLS[i]]));

/** Locución en off: textos, archivos y etiqueta del disparador por sala. */
export const VO_TEXT = Object.fromEntries(ROOMS.filter(r => r.vo?.text?.length).map(r => [r.id, r.vo.text]));
export const VO_FILES = Object.fromEntries(ROOMS.filter(r => r.vo?.files?.length).map(r => [r.id, r.vo.files]));
export const TRIG_LABEL = Object.fromEntries(ROOMS.map(r => [r.id, r.vo?.trigger]).filter(([, v]) => v));

/** Llamar desde Main.js después de poblar GX. */
export function roomsInit() { bindRoomContext(); }

/** Refrescar los bindings dinámicos al inicio de cada frame. */
export function roomsUpdate() { refreshRoomContext(); }
