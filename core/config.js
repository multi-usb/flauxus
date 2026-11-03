/* ======================================================================
   FLAUXUS — core/config.js
   Configuración de entrada, baraja, calidad y preludio. Son valores
   estáticos que se leen desde varios módulos; no contienen lógica de sala.
   ====================================================================== */
import { $, qs, TOUCH } from './util.js';

export const ALIAS = { direct: 'direct', directa: 'direct', redes: 'direct', fanzine: 'fanzine', zine: 'fanzine', poster: 'poster', afiche: 'poster', cards: 'cards', baraja: 'cards', cartas: 'cards' };
export const entry = ALIAS[(qs.get('entry') || (qs.get('cards') ? 'cards' : 'direct')).toLowerCase()] || 'direct';
/* Los tres satélites físicos son PUERTAS al mismo sistema: cada una cambia lo que el usuario PUEDE HACER (guía de satélites):
   fanzine → Skin Cyborg · afiche → Cincel de Deconstrucción · baraja → Intención. Se reconocen con ?entry=fanzine|poster|cards
   (la baraja además lleva sus cartas: ?entry=cards&cards=PAUSA,RETARDA,MI INTENCIÓN). */
export const ENTRIES = {
   direct: { label: 'Entrada directa', tag: 'Directa', skill: null, blurb: '' },
   fanzine: { label: 'Entrada · fanzine', tag: 'Fanzine', skill: 'Skin Cyborg', blurb: 'Llegaste desde el fanzine: tu avatar es la versión cuerpo + tecnología. Sus dispositivos laten con el sonido y con tu movimiento.' },
   poster: { label: 'Entrada · afiche', tag: 'Afiche', skill: 'Cincel de Deconstrucción', blurb: 'Llegaste desde el afiche: en MataЯ al padre podrás intervenir los fragmentos de la partitura con el cincel.' },
   cards: { label: 'Entrada · baraja', tag: 'Baraja', skill: 'Intención', blurb: 'Llegaste desde la baraja: las cartas que decidiste se vuelven decisiones de fraseo en el Momento 3.' }
};
export const entryLabel = ENTRIES[entry].label;
// Cartas de la baraja → variables del sistema (semántica PROVISIONAL, pendiente de validar con Anna y María Clara)
export const CARDS = {
   PAUSA: { n: 'PAUSA', d: 'Una respiración extra tras la frase.' },
   ACELERA: { n: 'ACELERA', d: 'La frase corre.' },
   RETARDA: { n: 'RETARDA', d: 'La frase se arrastra.' },
   REPITE: { n: 'REPITE', d: 'La frase vuelve, más tenue.' },
   SILENCIA: { n: 'SILENCIA', d: 'La frase calla; su tiempo queda vacío.' },
   DESVIA: { n: 'DESVÍA', d: 'La frase arranca desde adentro y regresa a su inicio.' },
   INSISTE: { n: 'INSISTE', d: 'El final de la frase insiste.' },
   INTENCION: { n: 'MI INTENCIÓN', d: 'Tú decides la regla para esa frase.', wild: true }
};
export const OPLIST = ['PAUSA', 'ACELERA', 'RETARDA', 'REPITE', 'SILENCIA', 'DESVIA', 'INSISTE'];
export const normCard = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
export const CARD_ALIAS = { PAUSA: 'PAUSA', ACELERA: 'ACELERA', RETARDA: 'RETARDA', REPITE: 'REPITE', SILENCIA: 'SILENCIA', DESVIA: 'DESVIA', INSISTE: 'INSISTE', INTENCION: 'INTENCION', MIINTENCION: 'INTENCION' };
export const HAND = entry === 'cards' ? (() => { const r = (qs.get('cards') || '').split(/[,;|]/).map(normCard).map(x => CARD_ALIAS[x]).filter(Boolean).slice(0, 4); return r.length ? r : ['PAUSA', 'RETARDA', 'INTENCION'] })() : [];
// el sistema acumula las entradas ya descubiertas (solo registro: cada puerta sigue entregando su posibilidad al entrar por ella)
export const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } } };
export const seen = new Set(LS.get('flauxus.entries.v1', []));
$('entryLabel').textContent = ENTRIES[entry].skill || entryLabel; $('entryLabel').classList.toggle('skill', !!ENTRIES[entry].skill);
$('introEntry').textContent = (ENTRIES[entry].skill ? entryLabel + ' · ' + ENTRIES[entry].skill : entryLabel) + ' · mejor con audífonos';
export const DEV_ENTRY_PICKER = true; // herramienta de prueba del prototipo: poner en false para publicar
if (DEV_ENTRY_PICKER) $('devPick').innerHTML = '<span>Simular entrada:</span>' + Object.keys(ENTRIES).map(k => `<a href="?entry=${k}${k === 'cards' ? '&cards=PAUSA,RETARDA,MI%20INTENCI%C3%93N' : ''}" class="${k === entry ? 'on' : ''}">${ENTRIES[k].tag}</a>`).join(''); else $('devPick').remove();

/* ---------------- calidad (presupuesto de rendimiento) ----------------
   alta: escritorio · baja: táctil (o ?q=low para probarla en escritorio). El nº de luces es fijo por nivel. */
export const LOWQ = TOUCH || qs.get('q') === 'low';
export const QUALITY = LOWQ ? { tier: 'low', shadows: false, shadowMap: 0, pts: 1, spot: false, tex: 1024, aniso: 2, merge: qs.has('merge') }
   : { tier: 'high', shadows: true, shadowMap: 1024, pts: 2, spot: true, tex: 2048, aniso: 8, merge: qs.has('merge') };
export const SHADOW_R = 9; // radio (m) del frustum de sombra alrededor del avatar

/* ---------------- preludio ----------------
   Antes de cada minijuego el usuario CAMINA por la sala mientras escucha a María Clara.
   PRELUDE.enabled=false → vuelve al flujo anterior (sala → ficha → juego). */
export const PRELUDE = { enabled: true, R: 14, start: { x: 0, z: 4.2 }, trigR: 2.5 };

export const EXPERIMENT = { miToFa: true }; // el fraseo de MI mueve ligeramente el tempo de FA (PENDIENTE DE VALIDACIÓN)
