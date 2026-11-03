/* ======================================================================
   FLAUXUS — NavMesh.js
   Rasterizado de colisiones desde el modelo FBX, alturas, A* y cálculo de rutas
   ====================================================================== */
import * as THREE from 'three';

/* ── Referencias inyectadas por Main.js via navInit() ── */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let _player, _vel, _stairGroups, _S, _scene, _qs;
let _clamp = clamp;
let _stairLocal, _setAtriumFBXObj, _resetPlayerPhysics;
let _navCal = {}, _blockedStair = null;

/**
 * Llamar desde Main.js DESPUÉS de declarar todas las variables.
 * Evita la importación circular NavMesh ↔ Main.
 */
export function navInit(refs) {
  _player = refs.player;
  _vel = refs.vel;
  _stairGroups = refs.stairGroups;
  _S = refs.S;
  _scene = refs.scene;
  _qs = refs.qs;
  _clamp = refs.clamp;
  _stairLocal = refs.stairLocal;
  _setAtriumFBXObj = refs.setAtriumFBXObj;
  _resetPlayerPhysics = refs.resetPlayerPhysics;
  _navCal = refs.navCal || {};
  _blockedStair = Object.values(_navCal).find(c => c?.blockedStair)?.blockedStair || null;
}

export const NAV = {
  ready: false, building: false, c: .25, N: 0, x0: 0, z0: 0, K: 4, W: 4,
  BH: .125, BASE: -1.5, UP: .65, DROP: 2.2, H0: .75, H1: 1.9, yg: 0,
  H: null, nL: null, occ: null, wallD: null, ok: null, info: null, ms: 0, tris: 0,
  TRI: null, nTri: 0
};

// Spawn elevado para aterrizar con física natural sobre la plataforma
export const SPAWN = { x: 0, y: 7.5, z: 2.5 };
export let navY = 7.5;
export function setNavY(y) { navY = y; }

export const placeAtSpawn = () => {
  _player.set(SPAWN.x, SPAWN.y, SPAWN.z);
  navY = SPAWN.y;
  _resetPlayerPhysics();
};

export const navIdx = (x, z) => {
  const i = Math.floor((x - NAV.x0) / NAV.c), j = Math.floor((z - NAV.z0) / NAV.c);
  return i < 0 || j < 0 || i >= NAV.N || j >= NAV.N ? -1 : j * NAV.N + i;
};

export const navCX = c => NAV.x0 + ((c % NAV.N) + .5) * NAV.c;
export const navCZ = c => NAV.z0 + (((c / NAV.N) | 0) + .5) * NAV.c;
export const navBand = y => _clamp(Math.floor((y - NAV.BASE) / NAV.BH), 0, NAV.W * 32 - 1);

export function navFree(map, c, a, b) {
  const ba = navBand(a), bb = navBand(b), W = NAV.W;
  for (let w = 0; w < W; w++) {
    const lo = w * 32, hi = lo + 31;
    if (bb < lo || ba > hi) continue;
    const s = Math.max(ba, lo) - lo, e = Math.min(bb, hi) - lo;
    const m = ((e === 31 ? 0xffffffff : ((1 << (e + 1)) - 1) >>> 0) & ((0xffffffff << s) >>> 0)) >>> 0;
    if (map[c * W + w] & m) return false;
  }
  return true;
}

export const navHeadFree = (c, hb) => navFree(NAV.occ, c, hb + NAV.H0, hb + NAV.H1) && navFree(NAV.wallD, c, hb + NAV.H0, hb + NAV.H1);
export const navHard = (c, h) => navFree(NAV.occ, c, h + NAV.H0, h + NAV.H1);

/* ¿el punto está en la franja de margen de un muro (celda no transitable)? */
export function navSoft(x, z, h) {
  const c = navIdx(x, z);
  if (c < 0) return false;
  let bl = -1, bd = 1e9;
  for (let l = 0; l < NAV.nL[c]; l++) {
    const d = Math.abs(NAV.H[c * NAV.K + l] - h);
    if (d < bd) { bd = d; bl = l; }
  }
  return bl >= 0 && bd < .5 && !NAV.ok[c * NAV.K + bl];
}

/* Identifica el tramo recto frontal elevado que una sala declara como bloqueado
   (hoy: RE). El suelo plano del atrio NUNCA se bloquea, eliminando la pared invisible. */
export function isBlockedStair(x, z, y) {
  if (!_blockedStair) return false;
  if (y !== undefined && _blockedStair.minY !== undefined && y < _blockedStair.minY) return false;

  const g = _stairGroups?.[_blockedStair.index];
  if (!g || !g.userData || g.userData.cs === undefined) return false;

  const l = _stairLocal(g, x, z);
  return (l.x >= _blockedStair.x[0] && l.x <= _blockedStair.x[1] && l.z >= _blockedStair.z[0] && l.z <= _blockedStair.z[1]);
}

/* altura de suelo en (x,z) alcanzable desde la altura py */
export function navFloor(x, z, py, soft = false) {
  const c = navIdx(x, z);
  if (c < 0) return NaN;
  const K = NAV.K, n = NAV.nL[c];
  let best = NaN;

  // En el estrado y en las escaleras (MI, SOL, etc.) se permite subir con fluidez (0.85m)
  const nearDais = (x * x + z * z) < 38;
  const maxUp = nearDais ? 1.5 : 0.85;

  for (let l = 0; l < n; l++) {
    const h = NAV.H[c * K + l];

    // Solo se ignora la capa si pertenece al tramo recto elevado bloqueado de RE
    if (isBlockedStair(x, z, h)) continue;
    if (h > py + maxUp || h < py - NAV.DROP) continue;

    // Se acepta navHard en las escaleras para que los pasamanos de MI y SOL no asfixien el paso
    const free = h >= py - maxUp * .5
      ? (NAV.ok[c * K + l] || navHard(c, h))
      : navHeadFree(c, py - .1);
    if (free && (isNaN(best) || h > best)) best = h;
  }
  return best;
}

/* Altura de RAMPA continua */
let _hs = null, _hsFor = null;
const RS = 3;
function navHs(node) {
  if (!_hs || _hsFor !== NAV.H) { _hs = new Float32Array(NAV.N * NAV.N * NAV.K).fill(NaN); _hsFor = NAV.H; }
  const cached = _hs[node];
  if (!isNaN(cached)) return cached;
  const K = NAV.K, N = NAV.N, c = (node / K) | 0, h = NAV.H[node], ci = c % N, cj = (c / N) | 0;
  let sum = 0, ws = 0;
  for (let dj = -RS; dj <= RS; dj++) for (let di = -RS; di <= RS; di++) {
    const ni = ci + di, nj = cj + dj;
    if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
    const w = 1 - Math.hypot(di, dj) / (RS + 1);
    if (w <= 0) continue;
    const nc = nj * N + ni;
    let bh = NaN, bd = .65;
    for (let l = 0; l < NAV.nL[nc]; l++) {
      const stepH = NAV.H[nc * K + l];
      if (isBlockedStair(navCX(nc), navCZ(nc), stepH)) continue;
      if (!NAV.ok[nc * K + l] && !navHard(nc, stepH)) continue;
      const d = Math.abs(stepH - h);
      if (d <= bd) { bd = d; bh = stepH; }
    }
    if (!isNaN(bh)) { sum += bh * w; ws += w; }
  }
  return (_hs[node] = ws > 0 ? sum / ws : h);
}

export function navRampY(x, z, py) {
  const N = NAV.N, K = NAV.K, fx = (x - NAV.x0) / NAV.c - .5, fz = (z - NAV.z0) / NAV.c - .5, i0 = Math.floor(fx), j0 = Math.floor(fz), tx = fx - i0, tz = fz - j0;
  let sum = 0, ws = 0;
  for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
    const i = i0 + di, j = j0 + dj;
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const c = j * N + i;
    let bn = -1, bd = .85;
    for (let l = 0; l < NAV.nL[c]; l++) {
      const stepH = NAV.H[c * K + l];
      if (isBlockedStair(navCX(c), navCZ(c), stepH)) continue;
      if (!NAV.ok[c * K + l] && !navHard(c, stepH)) continue;
      const d = Math.abs(stepH - py);
      if (d <= bd) { bd = d; bn = c * K + l; }
    }
    if (bn < 0) continue;
    const w = (di ? tx : 1 - tx) * (dj ? tz : 1 - tz);
    sum += navHs(bn) * w; ws += w;
  }
  return ws > 1e-3 ? sum / ws : NaN;
}

export function navHas(i, j, h) {
  const N = NAV.N;
  if (i < 0 || j < 0 || i >= N || j >= N) return false;
  const c = j * N + i, K = NAV.K;
  for (let l = 0; l < NAV.nL[c]; l++) {
    const d = NAV.H[c * K + l] - h;
    if (d <= NAV.UP && d >= -NAV.DROP && NAV.ok[c * K + l]) return true;
  }
  return false;
}

export const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function navNeighbors(node, cb) {
  const K = NAV.K, N = NAV.N, c = (node / K) | 0, h = NAV.H[node], ci = c % N, cj = (c / N) | 0;
  for (let q = 0; q < 8; q++) {
    const di = NB8[q][0], dj = NB8[q][1], ni = ci + di, nj = cj + dj;
    if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
    const nc = nj * N + ni, n = NAV.nL[nc];
    for (let l2 = 0; l2 < n; l2++) {
      const nn = nc * K + l2, dh = NAV.H[nn] - h;
      if (NAV.blk && NAV.blk[nc]) continue;
      if (dh > NAV.UP || dh < -NAV.DROP) continue;
      if (dh >= -NAV.UP * .5 ? !(NAV.ok[nn] || (!NAV.ok[node] && navHard(nc, NAV.H[nn]))) : !navHeadFree(nc, h - .1)) continue;
      if (di && dj && (!navHas(ci + di, cj, h) || !navHas(ci, cj + dj, h))) continue;
      cb(nn, di && dj ? 1.4142 : 1, dh);
    }
  }
}

export function navNode(x, z, y) {
  const c0 = navIdx(x, z);
  if (c0 < 0) return -1;
  const N = NAV.N, K = NAV.K, ci = c0 % N, cj = (c0 / N) | 0;
  let best = -1, bs = 1e9;
  for (let r = 0; r <= 10; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nc = nj * N + ni;
        for (let l = 0; l < NAV.nL[nc]; l++) {
          if (!NAV.ok[nc * K + l]) continue;
          const s = Math.abs(NAV.H[nc * K + l] - y) + r * .35;
          if (s < bs) { bs = s; best = nc * K + l; }
        }
      }
    }
    if (best >= 0 && r >= 2) break;
  }
  return best;
}

let _clr = null, _clrFor = null;
const levelHas = (i, j, h) => {
  const N = NAV.N;
  if (i < 0 || j < 0 || i >= N || j >= N) return false;
  const c = j * N + i, K = NAV.K;
  for (let l = 0; l < NAV.nL[c]; l++) {
    const d = NAV.H[c * K + l] - h;
    if (d <= NAV.UP && d >= -.55 && NAV.ok[c * K + l]) return true;
  }
  return false;
};
export function navClr(node) {
  if (!_clr || _clrFor !== NAV.H) { _clr = new Int8Array(NAV.N * NAV.N * NAV.K).fill(-1); _clrFor = NAV.H; }
  let v = _clr[node];
  if (v >= 0) return v;
  const K = NAV.K, N = NAV.N, c = (node / K) | 0, h = NAV.H[node], ci = c % N, cj = (c / N) | 0;
  v = 4;
  outer: for (let r = 1; r <= 4; r++) {
    for (let q = 0; q < 8; q++) {
      if (!levelHas(ci + NB8[q][0] * r, cj + NB8[q][1] * r, h)) { v = r - 1; break outer; }
    }
  }
  _clr[node] = v;
  return v;
}

let _g = null, _came = null, _stamp = null, _cl = null, _ver = 0;

export function navPick(o, d, maxD = 70) {
  if (!NAV.ready || d.y >= -0.01) return null;
  const K = NAV.K, step = NAV.c * .8;
  let py = o.y;
  for (let s = step; s < maxD; s += step) {
    const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
    if (y < NAV.BASE - 1) return null;
    const c = navIdx(x, z);
    if (c >= 0) {
      let hit = NaN;
      for (let l = 0; l < NAV.nL[c]; l++) {
        if (!NAV.ok[c * K + l]) continue;
        const h = NAV.H[c * K + l];
        if (y <= h + .02 && py > h && (isNaN(hit) || h > hit)) hit = h;
      }
      if (!isNaN(hit)) {
        const t = (py - hit) / Math.max(1e-6, py - y), sp = s - step * (1 - t);
        return { x: o.x + d.x * sp, y: hit, z: o.z + d.z * sp };
      }
    }
    py = y;
  }
  return null;
}

export function navRoute(s, t) {
  const K = NAV.K, T = NAV.N * NAV.N * K;
  if (!_g || _g.length !== T) {
    _g = new Float32Array(T);
    _came = new Int32Array(T);
    _stamp = new Uint32Array(T);
    _cl = new Uint32Array(T);
  }
  _ver++;
  const ver = _ver, heap = [], tc = (t / K) | 0, tx = navCX(tc), tz = navCZ(tc);
  const hf = n => {
    const c = (n / K) | 0;
    return Math.hypot(navCX(c) - tx, navCZ(c) - tz) / NAV.c;
  };
  const push = (n, f) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  _stamp[s] = ver; _g[s] = 0; _came[s] = -1; push(s, hf(s));
  let found = false, guard = 0;
  while (heap.length && guard++ < 400000) {
    const [, n] = pop();
    if (_cl[n] === ver) continue;
    _cl[n] = ver;
    if (n === t) { found = true; break; }
    navNeighbors(n, (nn, d, dh) => {
      const g = _g[n] + d * (1 + (dh > 0 ? .5 * dh : 0) + (dh < -1 ? 1.5 : 0) + (4 - navClr(nn)) * .35);
      if (_stamp[nn] !== ver || g < _g[nn]) {
        _stamp[nn] = ver; _g[nn] = g; _came[nn] = n; push(nn, g + hf(nn));
      }
    });
  }
  if (!found) return null;
  const out = [];
  for (let n = t; n !== -1; n = _came[n]) out.push(n);
  return out.reverse();
}

export function navLos(a, b, m = 0) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / .15));
  const px = d > 1e-6 ? -(b.z - a.z) / d : 0, pz = d > 1e-6 ? (b.x - a.x) / d : 0;
  let py = a.y, soft = navSoft(a.x, a.z, a.y);
  for (let k = 1; k <= n; k++) {
    const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, h = navFloor(x, z, py, soft);
    if (isNaN(h)) return false;
    if (Math.abs(h - py) > .45) return false;
    if (m > 0) {
      for (const sd of [-1, 1]) {
        const hs = navFloor(x + px * m * sd, z + pz * m * sd, py, soft);
        if (isNaN(hs) || Math.abs(hs - h) > .45) return false;
      }
    }
    py = h;
    soft = navSoft(x, z, h);
  }
  return true;
}

export function navPath(from, to, raw = false) {
  if (!NAV.ready) return null;
  const s = navNode(from.x, from.z, from.y ?? NAV.yg), t = navNode(to.x, to.z, to.y ?? NAV.yg);
  if (s < 0 || t < 0) return null;
  const nodes = navRoute(s, t);
  if (!nodes) return null;
  const K = NAV.K;
  const pts = nodes.map(n => {
    const c = (n / K) | 0;
    return { x: navCX(c), z: navCZ(c), y: NAV.H[n] };
  });
  if (raw) return pts;
  const out = [];
  let a = pts[0], idx = 0;
  while (idx < pts.length - 1) {
    let far = idx + 1;
    for (let q = Math.min(pts.length - 1, idx + 28); q > idx + 1; q--) {
      if (navLos(a, pts[q], .3)) { far = q; break; }
    }
    out.push(pts[far]);
    a = pts[far];
    idx = far;
  }
  const tn = pts[pts.length - 1];
  if (Math.hypot(tn.x - to.x, tn.z - to.z) < .6 && out.length) {
    const h = navFloor(to.x, to.z, tn.y);
    if (!isNaN(h)) out[out.length - 1] = { x: to.x, z: to.z, y: h };
  }
  return out.length ? out : [pts[pts.length - 1]];
}

export const navYield = () => new Promise(r => setTimeout(r, 0));

export async function navBuild(root) {
  NAV.building = true;
  const t0 = performance.now();
  root.updateMatrixWorld(true);
  const R = 30, c = NAV.c, N = Math.ceil(2 * R / c), K = NAV.K, W = NAV.W, x0 = -R, z0 = -R;
  Object.assign(NAV, { N, x0, z0 });
  const H = new Float32Array(N * N * K), nL = new Uint8Array(N * N), occ = new Uint32Array(N * N * W), wall = new Uint32Array(N * N * W);
  const meshes = [];
  root.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position && o.visible) meshes.push(o); });
  let total = 0;
  meshes.forEach(m => { const g = m.geometry; total += (g.index ? g.index.count : g.attributes.position.count) / 3; });
  const TRI = new Float32Array(Math.min(total, 2500000) * 9);
  let nt = 0, upA = 0, dnA = 0, lap = performance.now();
  for (const m of meshes) {
    const e = m.matrixWorld.elements, g = m.geometry, pos = g.attributes.position, idx = g.index, cnt = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < cnt && nt < 2500000; t++) {
      for (let v = 0; v < 3; v++) {
        const i = idx ? idx.getX(t * 3 + v) : t * 3 + v,
          x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i),
          o = nt * 9 + v * 3;
        TRI[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        TRI[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        TRI[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      const o = nt * 9,
        ux = TRI[o + 3] - TRI[o], uy = TRI[o + 4] - TRI[o + 1], uz = TRI[o + 5] - TRI[o + 2],
        vx = TRI[o + 6] - TRI[o], vy = TRI[o + 7] - TRI[o + 1], vz = TRI[o + 8] - TRI[o + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, ny, nz);
      if (len > 1e-10) {
        const q = ny / len;
        if (q > .7) upA += len;
        else if (q < -.7) dnA += len;
      }
      nt++;
      if ((t & 1023) === 0 && performance.now() - lap > 10) { await navYield(); lap = performance.now(); }
    }
  }
  const flip = dnA > upA * 1.5 ? -1 : 1;
  if (flip < 0) console.warn('NAV: normales invertidas en el modelo; se corrige');
  const mark = (map, x, y, z) => {
    const i = Math.floor((x - x0) / c), j = Math.floor((z - z0) / c);
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const b = navBand(y);
    map[(j * N + i) * W + (b >> 5)] |= (1 << (b & 31));
  };
  const addLayer = (i, j, h) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const cc = j * N + i, base = cc * K, n = nL[cc];
    for (let l = 0; l < n; l++) {
      if (Math.abs(H[base + l] - h) < .12) {
        if (h > H[base + l]) H[base + l] = h;
        return;
      }
    }
    if (n < K) {
      H[base + n] = h; nL[cc] = n + 1;
    } else {
      let bi = 0, bd = 1e9;
      for (let l = 0; l < n; l++) {
        const d = Math.abs(H[base + l] - h);
        if (d < bd) { bd = d; bi = l; }
      }
      if (h > H[base + bi]) H[base + bi] = h;
    }
  };
  lap = performance.now();
  for (let t = 0; t < nt; t++) {
    const o = t * 9,
      ax = TRI[o], ay = TRI[o + 1], az = TRI[o + 2],
      bx = TRI[o + 3], by = TRI[o + 4], bz = TRI[o + 5],
      cx = TRI[o + 6], cy = TRI[o + 7], cz = TRI[o + 8];
    if (Math.max(ax, bx, cx) < x0 || Math.min(ax, bx, cx) > -x0 || Math.max(az, bz, cz) < z0 || Math.min(az, bz, cz) > -z0) continue;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, nyR = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, nyR, nz);
    if (len < 1e-10) continue;
    const upF = nyR / len * flip > .5, me = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(cx - bx, cy - by, cz - bz)), n = clamp(Math.ceil(me / .35), 1, 50);
    for (let a = 0; a <= n; a++) {
      for (let b = 0; b <= n - a; b++) {
        const s = a / n, q = b / n,
          px = ax + ux * s + vx * q, py = ay + uy * s + vy * q, pz = az + uz * s + vz * q;
        mark(occ, px, py, pz);
        if (!upF) mark(wall, px, py, pz);
      }
    }
    if (upF) {
      const minY = Math.min(ay, by, cy), maxY = Math.max(ay, by, cy), den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(den) >= 1e-12) {
        const inTri = (px, pz) => {
          const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den,
            l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
          return l1 >= -1e-6 && l2 >= -1e-6 && 1 - l1 - l2 >= -1e-6;
        };
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / c)),
          i1 = Math.min(N - 1, Math.floor((Math.max(ax, bx, cx) - x0) / c)),
          j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / c)),
          j1 = Math.min(N - 1, Math.floor((Math.max(az, bz, cz) - z0) / c)),
          hc = c / 2;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const px = x0 + (i + .5) * c, pz = z0 + (j + .5) * c;
            if (inTri(px, pz) || inTri(px - hc, pz - hc) || inTri(px + hc, pz - hc) || inTri(px - hc, pz + hc) || inTri(px + hc, pz + hc)) {
              addLayer(i, j, clamp(ay - (nx * (px - ax) + nz * (pz - az)) / nyR, minY, maxY));
            }
          }
        }
        for (const [p, q2] of [[0, 3], [3, 6], [6, 0]]) {
          const ex = TRI[o + q2] - TRI[o + p], ez = TRI[o + q2 + 2] - TRI[o + p + 2], ey = TRI[o + q2 + 1] - TRI[o + p + 1],
            k = Math.max(1, Math.ceil(Math.hypot(ex, ez) / .12));
          for (let s = 0; s <= k; s++) {
            const f = s / k;
            addLayer(Math.floor((TRI[o + p] + ex * f - x0) / c), Math.floor((TRI[o + p + 2] + ez * f - z0) / c), TRI[o + p + 1] + ey * f);
          }
        }
      }
    }
    if ((t & 63) === 0 && performance.now() - lap > 8) { await navYield(); lap = performance.now(); }
  }
  for (let cc = 0; cc < N * N; cc++) {
    const n = nL[cc];
    if (n > 1) {
      const a = [];
      for (let l = 0; l < n; l++) a.push(H[cc * K + l]);
      a.sort((p, q) => p - q);
      for (let l = 0; l < n; l++) H[cc * K + l] = a[l];
    }
  }
  const wallD = new Uint32Array(N * N * W);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      for (let w = 0; w < W; w++) {
        let v = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ni = i + di, nj = j + dj;
            if (ni >= 0 && nj >= 0 && ni < N && nj < N) v |= wall[(nj * N + ni) * W + w];
          }
        }
        wallD[(j * N + i) * W + w] = v;
      }
    }
  }
  Object.assign(NAV, { H, nL, occ, wallD });
  const ok = new Uint8Array(N * N * K);
  NAV.ok = ok;
  for (let cc = 0; cc < N * N; cc++) {
    for (let l = 0; l < nL[cc]; l++) ok[cc * K + l] = navHeadFree(cc, H[cc * K + l]) ? 1 : 0;
  }

  // Desactivar únicamente las capas elevadas de la escalera recta de RE (h >= 1.32m)
  for (let cc = 0; cc < N * N; cc++) {
    const px = navCX(cc), pz = navCZ(cc);
    const n = nL[cc];
    for (let l = 0; l < n; l++) {
      if (isBlockedStair(px, pz, H[cc * K + l])) {
        ok[cc * K + l] = 0;
      }
    }
  }

  NAV.ms = Math.round(performance.now() - t0);
  NAV.tris = nt;
  NAV.TRI = TRI.subarray(0, nt * 9);
  NAV.nTri = nt;
  NAV.ready = true;
  NAV.building = false;
}

function solve4(A, b) {
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(A[r * 4 + c]) > Math.abs(A[p * 4 + c])) p = r;
    if (Math.abs(A[p * 4 + c]) < 1e-12) return null;
    if (p !== c) { for (let k = 0; k < 4; k++) { const t = A[c * 4 + k]; A[c * 4 + k] = A[p * 4 + k]; A[p * 4 + k] = t; } const t = b[c]; b[c] = b[p]; b[p] = t; }
    const piv = A[c * 4 + c];
    for (let r = c + 1; r < 4; r++) {
      const f = A[r * 4 + c] / piv;
      if (!f) continue;
      for (let k = c; k < 4; k++) A[r * 4 + k] -= f * A[c * 4 + k];
      b[r] -= f * b[c];
    }
  }
  const w = [0, 0, 0, 0];
  for (let r = 3; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < 4; k++) s -= A[r * 4 + k] * w[k];
    w[r] = s / A[r * 4 + r];
  }
  return w;
}

function circleFit3(pts) {
  const n = pts.length / 3;
  if (n < 24) return null;
  const A = new Float64Array(16), b = new Float64Array(4);
  for (let i = 0; i < n; i++) {
    const x = pts[3 * i], y = pts[3 * i + 1], z = pts[3 * i + 2], s2 = x * x + y * y + z * z;
    A[0] += x * x; A[1] += x * y; A[2] += x * z; A[3] += x;
    A[5] += y * y; A[6] += y * z; A[7] += y;
    A[10] += z * z; A[11] += z;
    A[15] += 1;
    b[0] += s2 * x; b[1] += s2 * y; b[2] += s2 * z; b[3] += s2;
  }
  A[4] = A[1]; A[8] = A[2]; A[9] = A[6]; A[12] = A[3]; A[13] = A[7]; A[14] = A[11];
  const w = solve4(A, b);
  if (!w || !isFinite(w[0] + w[1] + w[2] + w[3])) return null;
  const cx = w[0] * .5, cy = w[1] * .5, cz = w[2] * .5,
    R = Math.sqrt(w[0] * w[0] * .25 + w[1] * w[1] * .25 + w[2] * w[2] * .25 + w[3]);
  if (!isFinite(R) || R <= 0) return null;
  return { cx, cy, cz, R };
}

function planeNormalMin(pts) {
  const n = pts.length / 3;
  if (n < 24) return null;
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < n; i++) { mx += pts[3 * i]; my += pts[3 * i + 1]; mz += pts[3 * i + 2]; }
  mx /= n; my /= n; mz /= n;
  let cxx = 0, cyy = 0, czz = 0, cxy = 0, cxz = 0, cyz = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[3 * i] - mx, y = pts[3 * i + 1] - my, z = pts[3 * i + 2] - mz;
    cxx += x * x; cyy += y * y; czz += z * z; cxy += x * y; cxz += x * z; cyz += y * z;
  }
  const tr = (cxx + cyy + czz) / Math.max(cxx + cyy + czz, 1e-12);
  let vx = .21, vy = .87, vz = .44;
  for (let it = 0; it < 30; it++) {
    let x = vx * (tr - cxx) - vy * cxy - vz * cxz,
      y = -vx * cxy + vy * (tr - cyy) - vz * cyz,
      z = -vx * cxz - vy * cyz + vz * (tr - czz);
    const l = Math.hypot(x, y, z);
    if (!l) return null;
    vx = x / l; vy = y / l; vz = z / l;
  }
  return { x: vx, y: vy, z: vz };
}

function ringFit(T, nT, est, y1) {
  const cx = est.x, cy = est.y, cz = est.z, R0 = est.R;
  const dLo2 = (R0 * .5) * (R0 * .5), dHi2 = (R0 * 1.5) * (R0 * 1.5),
    yLo = cy - .55 * R0, yHi = cy + .9 * R0, reach = R0 * 1.6;
  const pts = [];
  for (let t = 0; t < nT; t++) {
    const o = t * 9,
      gx = (T[o] + T[o + 3] + T[o + 6]) / 3,
      gy = (T[o + 1] + T[o + 4] + T[o + 7]) / 3,
      gz = (T[o + 2] + T[o + 5] + T[o + 8]) / 3;
    if (gy < yLo || gy > yHi) continue;
    if (Math.abs(gx - cx) > reach || Math.abs(gz - cz) > reach) continue;
    const dx = gx - cx, dy = gy - cy, dz = gz - cz, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < dLo2 || d2 > dHi2) continue;
    pts.push(gx, gy, gz);
  }
  if (pts.length < 90) return null;
  let f = circleFit3(pts);
  if (!f) return null;
  const lat = Math.max(.14, .1 * f.R), inl = [];
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i] - f.cx, dy = pts[i + 1] - f.cy, dz = pts[i + 2] - f.cz,
      d = Math.hypot(dx, dy, dz);
    if (Math.abs(d - f.R) <= lat) inl.push(pts[i], pts[i + 1], pts[i + 2]);
  }
  if (inl.length >= 90) { const f2 = circleFit3(inl); if (f2) f = f2; }
  if (Math.hypot(f.cx - cx, f.cz - cz) > .8 * R0) return null;
  if (Math.abs(f.R - R0) > .45 * R0 || f.R < .8 || f.R > 3.2) return null;
  if (f.cy < y1 + f.R * .5 || f.cy > y1 + f.R * 1.7) return null;
  const src = inl.length >= 90 ? inl : pts;
  let span = -1e9, yb = 1e9;
  for (let i = 1; i < src.length; i += 3) { span = Math.max(span, src[i]); yb = Math.min(yb, src[i]); }
  if (span - yb < .7 * f.R) return null;
  let n = planeNormalMin(src);
  const rr = Math.hypot(f.cx, f.cz) || 1, tox = -f.cx / rr, toz = -f.cz / rr;
  if (n) {
    if (dotxy(n, tox, toz) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
    if (Math.abs(n.y) > .5 || dotxy(n, tox, toz) < .3) n = null;
  }
  return { x: f.cx, z: f.cz, y: f.cy, R: f.R, found: true, n };
}
const dotxy = (n, tox, toz) => n.x * tox + n.z * toz;

export function stairStart(pts) {
  const n = pts.length;
  if (n < 2) return 0;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  for (let i = 0; i < n - 1; i++) {
    let j = i;
    while (j < n - 1 && cum[j] - cum[i] < 1.2) j++;
    if (pts[j].y - pts[i].y >= .36) {
      let m = i;
      while (m < n - 1 && pts[m + 1].y - pts[i].y < .08) m++;
      return m;
    }
  }
  let m = n - 1;
  while (m > 0 && pts[m - 1].y <= pts[m].y + .05) m--;
  const b = pts[m].y;
  while (m < n - 1 && pts[m + 1].y - b < .12) m++;
  return m;
}

export function endAxis(pts, reach = 2.5) {
  let acc = 0, j = pts.length - 1;
  while (j > 0 && acc < reach) {
    acc += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].z - pts[j - 1].z);
    j--;
  }
  const t = pts[pts.length - 1], dx = t.x - pts[j].x, dz = t.z - pts[j].z, l = Math.hypot(dx, dz);
  return l < .8 ? null : { x: dx / l, z: dz / l };
}

export function flightAxis(pts, m, reach = 1.8) {
  let acc = 0, j = m;
  while (j < pts.length - 1 && acc < reach) {
    acc += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].z - pts[j].z);
    j++;
  }
  const dx = pts[j].x - pts[m].x, dz = pts[j].z - pts[m].z, l = Math.hypot(dx, dz);
  return l < .8 ? null : { x: dx / l, z: dz / l };
}

export function navAnalyze() {
  const K = NAV.K, N = NAV.N, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const sc = navIdx(0, 0);
  let sn = -1, sh = -1e9;
  for (let l = 0; l < NAV.nL[sc]; l++) {
    if (NAV.ok[sc * K + l] && NAV.H[sc * K + l] > sh) {
      sh = NAV.H[sc * K + l]; sn = sc * K + l;
    }
  }
  if (sn < 0) sn = navNode(0, 0, 1.4);
  if (sn < 0) return { ok: false, why: 'sin suelo transitable en el centro' };
  const daisY = NAV.H[sn], seen = new Uint8Array(N * N * K), q = new Int32Array(N * N * K);
  let qh = 0, qt = 0;
  q[qt++] = sn; seen[sn] = 1;
  while (qh < qt) {
    const nd = q[qh++];
    navNeighbors(nd, nn => {
      if (!seen[nn]) { seen[nn] = 1; q[qt++] = nn; }
    });
  }
  const hist = new Map();
  for (let i = 0; i < qt; i++) {
    const b = Math.round(NAV.H[q[i]] * 10);
    hist.set(b, (hist.get(b) || 0) + 1);
  }
  let yg = 0, bm = 0;
  hist.forEach((v, b) => { if (v > bm) { bm = v; yg = b / 10; } });
  NAV.yg = yg;

  let daisR = 0;
  if (daisY - yg > .5) {
    const rs = [];
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * 6.2832;
      let r = 0;
      for (; r < 20; r += .25) {
        const h = navFloor(Math.cos(a) * r, Math.sin(a) * r, daisY);
        if (isNaN(h) || Math.abs(h - daisY) > .35) break;
      }
      rs.push(r);
    }
    rs.sort((p, q2) => p - q2);
    daisR = rs[rs.length >> 1];
  }

  let comps = [];
  for (const dy of [2.0, 2.8, 1.4, 1.0]) {
    const thr = yg + dy, mark = new Int16Array(N * N * K).fill(-1);
    comps = [];
    for (let i = 0; i < qt; i++) {
      const s0 = q[i];
      if (NAV.H[s0] <= thr || mark[s0] >= 0) continue;
      const id = comps.length, list = [], st = [s0];
      mark[s0] = id;
      while (st.length) {
        const nd = st.pop();
        list.push(nd);
        navNeighbors(nd, nn => {
          if (mark[nn] < 0 && seen[nn] && NAV.H[nn] > thr) {
            mark[nn] = id; st.push(nn);
          }
        });
      }
      if (list.length >= 8) comps.push(list);
    }
    comps = comps.filter(list => {
      let cx = 0, cz = 0;
      list.forEach(n => {
        const c = (n / K) | 0;
        cx += navCX(c); cz += navCZ(c);
      });
      return Math.hypot(cx / list.length, cz / list.length) > 4.5;
    });
    if (comps.length === 6) break;
  }
  if (comps.length !== 6) return { ok: false, why: 'se detectaron ' + comps.length + ' cimas de escalera (se esperaban 6)', yg, daisY, daisR };
  const stairs = comps.map(list => {
    const hs = list.map(n => NAV.H[n]).sort((a, b) => a - b),
      y1 = hs[Math.floor(hs.length * .9)],
      land = list.filter(n => NAV.H[n] >= y1 - .2);
    let lx = 0, lz = 0;
    land.forEach(n => {
      const c = (n / K) | 0;
      lx += navCX(c); lz += navCZ(c);
    });
    lx /= land.length; lz /= land.length;
    const tn = navNode(lx, lz, y1), route = navRoute(sn, tn);
    if (!route) return null;
    const pts = route.map(n => {
      const c = (n / K) | 0;
      return { x: navCX(c), z: navCZ(c), y: NAV.H[n] };
    });
    const m = stairStart(pts), base = pts[m].y;
    const mouth = pts[m], top = pts[pts.length - 1];
    const ax = flightAxis(pts, m);
    let dx = ax ? ax.x : lx - mouth.x, dz = ax ? ax.z : lz - mouth.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    let len = 0;
    for (let q = m; q < pts.length - 1; q++) len += Math.hypot(pts[q + 1].x - pts[q].x, pts[q + 1].z - pts[q].z);
    len = len || 1;

    let sx = 0, sz = 0, cnt = 0, ymax = -1e9;
    const c0 = navIdx(lx, lz), ci = c0 % N, cj = (c0 / N) | 0, rr = Math.ceil(4 / NAV.c);
    for (let dj = -rr; dj <= rr; dj++) {
      for (let di = -rr; di <= rr; di++) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N || Math.hypot(di, dj) * NAV.c > 4) continue;
        const nc = nj * N + ni;
        if (!navFree(NAV.occ, nc, y1 + 1.0, y1 + 9)) {
          sx += navCX(nc); sz += navCZ(nc); cnt++;
          for (let h = y1 + 9; h > y1 + 1.0; h -= NAV.BH) {
            if (!navFree(NAV.occ, nc, h - NAV.BH * .5, h)) {
              ymax = Math.max(ymax, h); break;
            }
          }
        }
      }
    }
    let ring;
    if (cnt >= 3 && ymax > y1 + 1.6) {
      const R = _clamp((ymax - y1) / 2, .8, 3.4);
      ring = { x: sx / cnt, z: sz / cnt, y: y1 + R, R, found: true };
    } else {
      ring = { x: lx, z: lz, y: y1 + 1.3, R: 1.3, found: false };
    }
    if (ring.found && NAV.TRI && NAV.nTri) {
      const rf = ringFit(NAV.TRI, NAV.nTri, ring, y1);
      if (rf) ring = rf;
    }
    return { mouth, base, top: { x: lx, z: lz, y: y1 }, dir: { x: dx, z: dz }, endDir: endAxis(pts), len, ring, ang: Math.atan2(lz, lx) };
  });
  if (stairs.some(s => !s)) return { ok: false, why: 'una escalera no es alcanzable desde el centro', yg, daisY, daisR };
  stairs.sort((a, b) => a.ang - b.ang);
  let s0 = 0, bd = 9;
  stairs.forEach((s, i) => {
    const d = Math.abs(wrap(s.ang + Math.PI / 2));
    if (d < bd) { bd = d; s0 = i; }
  });
  const ordered = [];
  for (let i = 0; i < 6; i++) ordered.push(stairs[(s0 + i) % 6]);
  const sz = daisR > 1.5 ? Math.min(2.5, daisR * .5) : 0;
  return { ok: true, yg, daisY, daisR, stairs: ordered, spawn: { x: 0, y: daisY, z: sz }, reach: qt };
}

/* ======================================================================
   CALIBRACIÓN POR SALA
   Las tablas CUE/PORTAL y la excepción de la escalera de RE viven en
   `meta.nav` de rooms/*.js y se inyectan vía navInit(). Aquí solo queda
   la lógica genérica del atrio.
   ====================================================================== */

function navBuildBlock() {
  const N = NAV.N, g = _stairGroups?.[_blockedStair?.index];
  if (!_blockedStair || !N || !g?.userData?.measured) { NAV.blk = null; return; }
  const blk = new Uint8Array(N * N);
  for (let c = 0; c < N * N; c++) {
    const px = navCX(c), pz = navCZ(c);
    let allBlocked = false;
    for (let l = 0; l < NAV.nL[c]; l++) {
      if (isBlockedStair(px, pz, NAV.H[c * NAV.K + l])) allBlocked = true;
    }
    if (allBlocked) blk[c] = 1;
  }
  NAV.blk = blk;
}

export function navApply(info) {
  info.stairs.forEach((s, i) => {
    const g = _stairGroups[i];
    if (!g) return;
    const u = g.userData, th = Math.atan2(-s.dir.x, -s.dir.z);
    const roomId = u.roomId || (i + 1);
    const adj = _navCal?.[roomId]?.portal || { x: 0, y: 0, z: 0, scale: 1.0 };

    g.position.set(s.mouth.x, 0, s.mouth.z);
    g.rotation.y = th;
    g.updateMatrixWorld(true);
    u.cs = Math.cos(th); u.sn = Math.sin(th);
    u.len = s.len; u.top = s.top; u.R = s.ring.R; u.mouthY = s.mouth.y; u.mouth = s.mouth; u.measured = true;

    const Rr = s.ring.R, k = (Rr / 1.35) * (adj.scale ?? 1.0);

    let nx = 0, ny = 0, nz = 0;
    if (s.ring.n) { nx = s.ring.n.x; ny = s.ring.n.y; nz = s.ring.n.z; }
    if (!Math.hypot(nx, nz)) {
      const m = Math.hypot(s.ring.x, s.ring.z) || 1;
      nx = -s.ring.x / m; nz = -s.ring.z / m; ny = 0;
    }
    const off = s.ring.inner ? .03 : _clamp(.18 * Rr, .28, .6),
      fw = _stairLocal(g, s.ring.x + nx * off, s.ring.z + nz * off);

    const ringPos = {
      x: fw.x + (adj.x || 0),
      y: s.ring.y + ny * off + (adj.y || 0),
      z: fw.z + (adj.z || 0)
    };
    u.gateDY = ringPos.y - s.top.y;

    if (u.gateGroup) {
      u.gateGroup.position.set(ringPos.x, ringPos.y, ringPos.z);
      try {
        const qw = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, ny, nz).normalize());
        qw.premultiply(g.quaternion.clone().invert());

        if (adj.rotY) {
          const qRotY = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            THREE.MathUtils.degToRad(adj.rotY)
          );
          qw.multiply(qRotY);
        }

        u.gateGroup.quaternion.copy(qw);
      } catch (e) { }
      u.gateGroup.scale.setScalar(k);
    } else if (u.gate) {
      u.gate.position.set(ringPos.x, ringPos.y, ringPos.z);
      u.gate.scale.setScalar(k);
    }

    if (u.beam) {
      u.beam.position.set(ringPos.x, ringPos.y + 7, ringPos.z);
    }
    const lab = u.labels;
    if (lab) {
      lab.note.position.set(ringPos.x, ringPos.y + Rr + .95, ringPos.z);
      lab.sub.position.set(ringPos.x, ringPos.y + Rr + .35, ringPos.z);
      u.check.position.set(ringPos.x, ringPos.y + Rr + 1.75, ringPos.z);
    }

    // Posicionamiento independiente del círculo cue
    const cueAdj = _navCal?.[roomId]?.cue || { x: 0.0, z: 0.9, y: 0.0 };
    const localCue = new THREE.Vector3(cueAdj.x, 0, cueAdj.z);
    const worldCue = g.localToWorld(localCue.clone());
    const fy = navFloor(worldCue.x, worldCue.z, (s.base ?? s.mouth.y - .15) + .02);
    const cueGroundY = !isNaN(fy) ? fy : (s.base ?? s.mouth.y - .15);

    u.cue.position.set(cueAdj.x, cueGroundY + 0.05 + (cueAdj.y || 0), cueAdj.z);
    u.steps.forEach(st => st.visible = false);
  });

  navBuildBlock();
  Object.assign(SPAWN, info.spawn);
  navY = info.spawn.y;

  if (_S.phase === 'atrium' || _S.phase === 'intro') {
    placeAtSpawn();
    _vel.set(0, 0, 0);
  }
}

export async function onAtriumLoaded(obj) {
  _setAtriumFBXObj(obj);
  window.atriumFBX = obj;
  try {
    await navBuild(obj);
    const info = navAnalyze();
    NAV.info = info;
    if (info.ok) {
      navApply(info);
    }
    else console.warn('NAV: análisis incompleto →', info.why, '· se usan portales nativos con la colisión del modelo');
    console.info('NAV listo en ' + NAV.ms + ' ms · ' + NAV.tris + ' tris', info.ok ? { suelo: info.yg, dais: [info.daisY, info.daisR] } : info);
  } catch (e) {
    console.warn('NAV falló, se usa la lógica nativa', e);
    NAV.ready = false;
  }
}

let navViz = null, navVizT = 0;
let navAxes = null;
export function navVizUpdate(dt) {
  if (!_qs?.has?.('colliders') || !NAV.ready) return;
  if (!navAxes && NAV.info?.stairs) {
    const P = [];
    NAV.info.stairs.forEach(s => { const y = (s.base ?? s.mouth.y) + .35; P.push(s.mouth.x - s.dir.x * .9, y, s.mouth.z - s.dir.z * .9, s.mouth.x + s.dir.x * 3, y, s.mouth.z + s.dir.z * 3); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    navAxes = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffe000, depthTest: false }));
    navAxes.renderOrder = 21; navAxes.frustumCulled = false; _scene.add(navAxes);
  }
  navVizT -= dt;
  if (navVizT > 0) return;
  navVizT = .35;
  if (!navViz) {
    navViz = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(NAV.c * .9, NAV.c * .9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: .5, depthWrite: false, depthTest: false }),
      6000
    );
    navViz.renderOrder = 20;
    navViz.frustumCulled = false;
    _scene.add(navViz);
  }
  const K = NAV.K, d = new THREE.Object3D(), col = new THREE.Color(), r = Math.ceil(10 / NAV.c), c0 = navIdx(_player.x, _player.z);
  if (c0 < 0) return;
  const ci = c0 % NAV.N, cj = (c0 / NAV.N) | 0;
  let k = 0;
  for (let dj = -r; dj <= r && k < 6000; dj++) {
    for (let di = -r; di <= r && k < 6000; di++) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= NAV.N || nj >= NAV.N) continue;
      const nc = nj * NAV.N + ni;
      for (let l = 0; l < NAV.nL[nc] && k < 6000; l++) {
        const h = NAV.H[nc * K + l];
        if (h > _player.y + 3.2 || h < _player.y - 3.2) continue;
        d.position.set(navCX(nc), h + .04, navCZ(nc));
        d.updateMatrix();
        navViz.setMatrixAt(k, d.matrix);
        navViz.setColorAt(k, col.setHex(NAV.ok[nc * K + l] ? 0x39d98a : 0xff4d4d));
        k++;
      }
    }
  }
  navViz.count = k;
  navViz.instanceMatrix.needsUpdate = true;
  if (navViz.instanceColor) navViz.instanceColor.needsUpdate = true;
}

