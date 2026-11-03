/* ======================================================================
   FLAUXUS — rooms/context.js
   Bindings vivos entre el contexto global (GX) y los scripts de sala.

   Cada sala importa solo los nombres que usa:
     import { W, H, ctx, LIME, hint } from './context.js';
   y este módulo reasigna esos exports desde GX al inicio de cada frame.
   Así el código de sala conserva nombres cortos (W, H, T, S…) sin
   depender de variables globales ni de un objeto intermedio en cada uso.
   ====================================================================== */
import { GX } from '../GameContext.js';

export { roomGen } from '../core/state.js';

export let S, roomGroup, avatarObj, camera, bloom, scene, mat, makeDust,
  glowSprite, makeTextSprite, animAvatar, rimSet, ctx, W, H, DPR,
  burst, ringFx, ftext, shake, glowCircle, bolt, toScreen,
  LIME, LIMEH, PAPER, SERIF, FONT, PALE, CARDS, OPLIST, HAND, EXPERIMENT,
  V3, clamp, lerp, damp, rand, lerpAngle, TOUCH, ptr, keys, ptrActive,
  hint, toast, finish, moveInput, groundController, T, $;

/** Referencias estáticas y dinámicas: se copian una vez al arrancar. */
export function bindRoomContext() {
  S = GX.S; roomGroup = GX.roomGroup; avatarObj = GX.avatarObj;
  camera = GX.camera; bloom = GX.bloom; scene = GX.scene;
  mat = GX.mat; makeDust = GX.makeDust; glowSprite = GX.glowSprite;
  makeTextSprite = GX.makeTextSprite; animAvatar = GX.animAvatar;
  rimSet = GX.rimSet; ctx = GX.ctx2d; W = GX.W; H = GX.H; DPR = GX.DPR;
  burst = GX.burst; ringFx = GX.ringFx; ftext = GX.ftext; shake = GX.shake;
  glowCircle = GX.glowCircle; bolt = GX.bolt; toScreen = GX.toScreen;
  LIME = GX.LIME; LIMEH = GX.LIMEH; PAPER = GX.PAPER; SERIF = GX.SERIF;
  FONT = GX.FONT; PALE = GX.PALE; CARDS = GX.CARDS; OPLIST = GX.OPLIST;
  HAND = GX.HAND; EXPERIMENT = GX.EXPERIMENT; V3 = GX.V3;
  clamp = GX.clamp; lerp = GX.lerp; damp = GX.damp; rand = GX.rand;
  lerpAngle = GX.lerpAngle; TOUCH = GX.TOUCH; ptr = GX.ptr; keys = GX.keys;
  ptrActive = GX.ptrActive; hint = GX.hint; toast = GX.toast;
  finish = GX.finish; moveInput = GX.moveInput;
  groundController = GX.groundController;
  T = GX.T; $ = GX.$;
}

/** Solo lo que cambia cada frame (cámara, tamaño, puntero). */
export function refreshRoomContext() {
  S = GX.S; roomGroup = GX.roomGroup; avatarObj = GX.avatarObj;
  camera = GX.camera; bloom = GX.bloom; scene = GX.scene;
  ctx = GX.ctx2d; W = GX.W; H = GX.H; DPR = GX.DPR;
  ptr = GX.ptr; T = GX.T;
}
