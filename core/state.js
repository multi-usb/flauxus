/* ======================================================================
   FLAUXUS — core/state.js
   Estado de la partida y registro de salas. `S` es un objeto mutable:
   todos los módulos ven los mismos cambios sin setters.
   ====================================================================== */
import { ROOMS } from '../Rooms.js';
import { entry } from './config.js';

export const rooms = ROOMS;
export const S = { phase: 'intro', room: 0, completed: new Set(), metrics: {}, mod: new Set(), sessionStart: 0, playStart: 0, moved: 0, nearby: 0, busy: false, coach: 0, ready: true, rfNote: false };
if (entry === 'fanzine') S.mod.add('cyborg');
if (entry === 'poster') S.mod.add('chisel');
if (entry === 'cards') S.mod.add('intention');
S.heard = new Set();

/* Cada Momento tiene su propia versión de personaje: MC_original en el
   atrio y las salas 1–3, MC_mtp (Matar al padre) en FA y LA, y MC_cyborg
   solo en SOL. La skin Cyborg del fanzine sustituye el avatar del atrio. */
const AVATAR_VERSION = { disciplined: 'original', body: 'body', cyborg: 'cyborg' };
export const skinKind = id => id
  ? (AVATAR_VERSION[rooms[id - 1]?.avatar] || 'original')
  : (S.mod.has('cyborg') ? 'cyborg' : 'original');
/* El menú y la interfaz leen el skin activo del atrio (el mismo estado que decide el avatar): body[data-skin]. */
document.body.dataset.skin = skinKind(0);
export const nextRoomId = () => { for (const r of rooms) if (!S.completed.has(r.id)) return r.id; return 0 };

/* Generaciones: invalidan cargas asíncronas de FBX cuando se cambia de escena. */
export let roomGen = 0, atriumGen = 0;
export const bumpRoomGen = () => { roomGen++ };
export const bumpAtriumGen = () => { atriumGen++ };
