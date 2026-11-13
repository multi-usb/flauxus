/* ======================================================================
   FLAUXUS — engine/fx.js
   Canvas 2D superpuesto: partículas, anillos, textos flotantes, rayos,
   glows y shake. El estado vive aquí; el resto solo llama a las funciones.
   ====================================================================== */
import { $, clamp, lerp, REDUCE, LIMEH, SERIF } from '../core/util.js';
import { camera } from './renderer.js';

export const cv = $('g2d'), ctx = cv.getContext('2d');
export let W = innerWidth, H = innerHeight, DPR = 1;
export function resize2d() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px' } resize2d();
export const FXP = [], FXR = [], FXT = []; let shakeAmt = 0;
export const getShake = () => shakeAmt;
export function decayShake(dt) { shakeAmt = Math.max(0, shakeAmt - dt * 30) }
export function burst(x, y, c = LIMEH, n = 20, spd = 260, life = .7, size = 3) { if (REDUCE) n = Math.ceil(n / 3); n = Math.min(n, 40); const cap = 120; if (FXP.length > cap) FXP.splice(0, FXP.length - cap); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = spd * (.25 + Math.random() * .75); FXP.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: life * (.6 + Math.random() * .6), m: life, c, s: size * (.6 + Math.random() * .8) }) } }
export function ringFx(x, y, c = '#fff', r0 = 12, r1 = 110, life = .55, w = 2) { FXR.push({ x, y, c, r0, r1, l: life, m: life, w }) }
export function ftext(x, y, t, c = '#fff', size = 20) { FXT.push({ x, y, t, c, l: .95, m: .95, size }) }
export function shake(a) { shakeAmt = Math.max(shakeAmt, REDUCE ? a * .25 : a) }
export function fxUpdate(dt) {
  for (let i = FXP.length - 1; i >= 0; i--) { const p = FXP[i]; p.l -= dt; if (p.l <= 0) { FXP.splice(i, 1); continue } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; p.vy = p.vy * .95 + 30 * dt }
  for (let i = FXR.length - 1; i >= 0; i--) { FXR[i].l -= dt; if (FXR[i].l <= 0) FXR.splice(i, 1) } for (let i = FXT.length - 1; i >= 0; i--) { const t = FXT[i]; t.l -= dt; t.y -= 38 * dt; if (t.l <= 0) FXT.splice(i, 1) }
}
export function fxDraw() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of FXP) { const a = clamp(p.l / p.m, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.4 + a * .6), 0, 6.283); ctx.fill() }
  for (const r of FXR) { const k = 1 - r.l / r.m; ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.c; ctx.lineWidth = r.w * (1 - k) + .5; ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, 1 - Math.pow(1 - k, 3)), 0, 6.283); ctx.stroke() } ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (const t of FXT) { const a = clamp(t.l / t.m, 0, 1); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = t.c; ctx.font = `italic 700 ${t.size * (1 + (1 - a) * .15)}px ${SERIF}`; ctx.fillText(t.t, t.x, t.y) } ctx.globalAlpha = 1
}
export function bolt(x1, y1, x2, y2, col, seg = 12, amp = 14) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [lw, al] of [[6, .18], [2, .9]]) { ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); for (let i = 1; i < seg; i++) { const t = i / seg, nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1, j = (Math.random() - .5) * amp * Math.sin(t * Math.PI); ctx.lineTo(lerp(x1, x2, t) + nx / l * j, lerp(y1, y2, t) + ny / l * j) } ctx.lineTo(x2, y2); ctx.stroke() } ctx.restore() }
export function glowCircle(x, y, r, rgba0, rgba1 = 'rgba(0,0,0,0)') { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba0); g.addColorStop(1, rgba1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill() }
export function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H } }
