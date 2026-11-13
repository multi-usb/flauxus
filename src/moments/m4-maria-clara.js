import { SCROLL_SCREENS } from '../config.js';
import { track } from '../lib/track.js';
import { createTyper } from '../ui/type.js';
import { clamp01 } from '../lib/math.js';
import { buildMasks, MASK_STEPS } from '../ui/photomask.js';
import { sharpHTML } from '../ui/sharp.js';

// Dónde está su rostro en cada foto (centro nítido de la máscara)
const FACE = { 'ph-a': [0.54, 0.3], 'ph-b': [0.54, 0.4], 'ph-c': [0.48, 0.38], 'ph-d': [0.34, 0.52], 'ph-e': [0.46, 0.3] };

// Momento 4 · María Clara — composición editorial.
// Un "escenario" más alto que la pantalla se desplaza dentro de la sección fijada; cada capa (nombre gigante,
// fotografías, citas) tiene su propia profundidad (parallax). Cada fotografía se condensa desde su centro (máscara
// orgánica de nebulosa y partículas, ver main.css .ph) ligada al scroll; al subir, se vuelve a deshacer.
// Microcontenidos (.m4-tip): cada fotografía lleva un marcador con una etiqueta; al abrirlo despliega una frase.
// Hover o foco de teclado en escritorio; un toque en táctil (uno abierto a la vez; se cierra al tocar fuera, con
// Escape o al seguir el scroll). El marcador viaja con su foto (misma profundidad) y el texto elige, con medidas
// reales, el lado donde cabe sin tapar rostros, citas, otros marcadores ni los botones fijos.
export function createM4({ profile }) {
  const section = document.getElementById('m4');
  const stage = section.querySelector('.m4-stage');
  const layers = [...stage.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: +el.dataset.depth, y: 0 }));
  const photos = [...stage.querySelectorAll('.ph')].map((el, i) => {
    const key = [...el.classList].find((c) => FACE[c]);
    const img = el.querySelector('img');
    return { el, last: -1, step: -1, urls: null, face: FACE[key] || [0.5, 0.45], aspect: img.height / img.width, seed: 11 + i * 97 };
  });
  const quotes = [...stage.querySelectorAll('.m4-quote')].map((el) => ({ el, type: createTyper(el.querySelector('.type'), profile) }));
  const name = stage.querySelector('.m4-name');
  // Las dos líneas del nombre gigante, medidas por su texto (los <span> son bloques a todo el ancho)
  const nameLines = [...name.children].map((s) => { const r = document.createRange(); r.selectNodeContents(s); return r; });
  const facts = stage.querySelector('.m4-facts');
  const tips = [...stage.querySelectorAll('.m4-tip')].map((el) => {
    const ph = photos.find((p) => p.el.classList.contains(el.dataset.for));
    const [ax, ay] = el.dataset.at.split(' ').map(Number);
    const text = el.querySelector('.m4-tip-text');
    // «FA♯» no se parte entre renglones; la etiqueta se repite (solo visualmente) como cabecera de la frase, para
    // que se lea a qué marcador pertenece cuando el texto tiene que abrirse a cierta distancia de él.
    const chip = el.querySelector('.m4-tip-chip');
    text.innerHTML = `<b class="m4-tip-k" aria-hidden="true">${chip.innerHTML.replace(/<i[^>]*><\/i>/, '')}</b>${sharpHTML(text.textContent.replace(/(\S+♯)/g, '<span class="nw">$1</span>'))}`;
    const layer = { el, depth: 1, y: 0 };
    layers.push(layer);
    return { el, btn: el.querySelector('.m4-tip-btn'), chip, text, ph, ax, ay, layer, on: false };
  });
  const fixedUI = ['#hud .hud-iso', '#sound', '#hud-cta'].map((q) => document.querySelector(q)).filter(Boolean);
  const shown = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
  let stageH = 0;
  // Profundidad de cada capa: la del marcado (data-depth), salvo que la composición la ajuste por CSS (--depth;
  // en celular las fotos que flanquean la cita viajan con ella). Se lee al medir, nunca por cuadro.
  const depthOf = (el) => { const v = parseFloat(getComputedStyle(el).getPropertyValue('--depth')); return Number.isFinite(v) ? v : +el.dataset.depth; };
  const measure = () => {
    stageH = stage.offsetHeight;
    for (const l of layers) if (l.el.dataset.depth) l.depth = depthOf(l.el);
    // Cada marcador se ancla a un punto de su foto y viaja a su misma profundidad. Su carril horizontal deja
    // libres los de la X y el botón de sonido (fijos): el escenario se desplaza por debajo de ellos.
    const [iso, snd] = fixedUI.map((el) => el.getBoundingClientRect());
    const minX = iso ? iso.right + 12 : 16, maxX = (snd && snd.width ? snd.left : innerWidth) - 12;
    for (const t of tips) {
      const p = t.ph.el;
      t.layer.depth = depthOf(p);
      // el punto de anclaje es el del marcado (data-at), salvo que la composición lo mueva por CSS (--ax / --ay)
      const cs = getComputedStyle(t.el), ax = parseFloat(cs.getPropertyValue('--ax')), ay = parseFloat(cs.getPropertyValue('--ay'));
      if (Number.isFinite(ax)) t.ax = ax;
      if (Number.isFinite(ay)) t.ay = ay;
      const x =Math.max(minX, Math.min(p.offsetLeft + t.ax * p.offsetWidth, maxX - t.el.offsetWidth));
      t.el.style.left = `${x.toFixed(1)}px`;
      t.el.style.top = `${(p.offsetTop + t.ay * p.offsetHeight).toFixed(1)}px`;
    }
  };

  // ---- Microcontenidos: abrir / cerrar ----
  let open = null, how = '', openedAt = 0, openY = 0;
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const faceBox = (ph) => {
    const r = ph.el.getBoundingClientRect(), h = 0.16 * Math.sqrt(r.width * r.height);
    const cx = r.left + ph.face[0] * r.width, cy = r.top + ph.face[1] * r.height;
    return { left: cx - h, right: cx + h, top: cy - h, bottom: cy + h };
  };
  // Dónde se despliega la frase: se recorre la franja visible de la ventana en una retícula (anchos de 280 a 160 px)
  // y gana el sitio libre más cercano al marcador. Pisar un rostro, una cita, los datos, otro marcador o un botón
  // fijo cuesta muchísimo más que alejarse; quedar sobre el cuerpo de una foto, apenas. Solo se calcula al abrir.
  // Si ni así queda un sitio limpio (celulares bajos, con la cita ocupando media pantalla), la frase se abre sin
  // su cabecera (.compact: la etiqueta ya se lee en el marcador) y se vuelve a buscar con ese alto menor.
  const placeText = (t) => {
    const W = innerWidth, vh = innerHeight, m = W < 400 ? 8 : 12;
    const o = t.el.getBoundingClientRect(), c = t.chip.getBoundingClientRect();
    const yMin = Math.max(72, vh * 0.16), yMax = vh * 0.94;
    const grow = (r, g) => ({ left: r.left - g, top: r.top - g, right: r.right + g, bottom: r.bottom + g });
    const seen = photos.filter((p) => p.last > 0.3);
    const obstacles = [
      ...seen.map((p) => [faceBox(p), 8]), ...seen.map((p) => [p.el.getBoundingClientRect(), 0.05]),
      ...quotes.map((q) => [grow(q.el.getBoundingClientRect(), 6), 5]), [grow(facts.getBoundingClientRect(), 6), 5],
      ...nameLines.map((r) => [r.getBoundingClientRect(), 1.5]),
      ...fixedUI.filter(shown).map((el) => [grow(el.getBoundingClientRect(), 8), 8]),
      ...tips.filter((x) => x.on).map((x) => [grow(x.chip.getBoundingClientRect(), 5), 6]),
    ];
    const HARD = 4; // desde este peso, pisar el obstáculo es un defecto y no una preferencia
    const search = () => {
      let best = null;
      for (let w = 280; w >= 160; w -= 12) {
        const pw = Math.min(w, W - 2 * m);
        t.text.style.width = `${pw}px`;
        const ph = t.text.offsetHeight;
        const nx = Math.max(1, Math.ceil((W - 2 * m - pw) / 14)), ny = Math.max(1, Math.ceil((yMax - yMin - ph) / 14));
        const tryAt = (x, y) => {
          const r = { left: x, top: y, right: x + pw, bottom: y + ph };
          // distancia al marcador (hueco entre rectángulos) + un pequeño premio por quedar alineado con él
          const dx = Math.max(0, c.left - r.right, r.left - c.right), dy = Math.max(0, c.top - r.bottom, r.top - c.bottom);
          let cost = Math.hypot(dx, dy) * 60 + Math.abs(x - c.left) * 2 + (280 - pw) * 3, hard = 0;
          for (const [ob, k] of obstacles) { const a = area(r, ob); if (k >= HARD) hard += a; cost += a * (k >= HARD ? 400 : k); }
          if (!best || cost < best.cost - 1) best = { x, y, pw, cost, hard };
        };
        for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) tryAt(m + (W - 2 * m - pw) * i / nx, yMin + Math.max(0, yMax - yMin - ph) * j / ny);
        // La retícula avanza de 14 en 14 px y se saltaba los huecos justos: se prueban además los sitios pegados
        // al marcador (encima y debajo, alineados con cada uno de sus lados y con los márgenes de la ventana).
        for (const x of [c.left, c.right - pw, m, W - m - pw]) for (const y of [c.top - 6 - ph, c.bottom + 6]) {
          if (y >= yMin && y + ph <= yMax) tryAt(Math.max(m, Math.min(x, W - m - pw)), y);
        }
      }
      return best;
    };
    t.el.classList.remove('compact');
    let best = search();
    if (best.hard > 0) {
      t.el.classList.add('compact');
      const b = search();
      if (b.hard < best.hard) best = b; else t.el.classList.remove('compact');
    }
    t.text.style.width = `${best.pw}px`;
    t.text.style.left = `${(best.x - o.left).toFixed(1)}px`;
    t.text.style.top = `${(best.y - o.top).toFixed(1)}px`;
  };
  const setOpen = (t, why = '') => {
    if (open && open !== t) { open.el.classList.remove('open'); open.btn.setAttribute('aria-expanded', 'false'); }
    how = why;
    if (t && t !== open) { placeText(t); t.el.classList.add('open'); t.btn.setAttribute('aria-expanded', 'true'); openedAt = performance.now(); openY = scrollY; }
    open = t;
  };
  // El hover solo cuenta si viene de un ratón de verdad. Tras un toque, el navegador deja un «cursor» fantasma en
  // el punto tocado y, al moverse la página bajo él, emite un pointerenter de tipo ratón: reabría el marcador que
  // se acababa de cerrar tocando fuera. Se ignora en dispositivos sin hover y durante 1,2 s después de cada toque.
  const canHover = matchMedia('(hover: hover)');
  let lastTouch = -1e4;
  addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'mouse') lastTouch = performance.now(); }, { capture: true, passive: true });
  const hovers = (ev) => ev.pointerType === 'mouse' && canHover.matches && performance.now() - lastTouch > 1200;
  for (const t of tips) {
    // Clic o toque: abre y deja fijo; otro toque cierra. Con el cursor encima (hover) el clic solo lo fija.
    t.btn.addEventListener('click', () => {
      if (open !== t || how === 'hover' || (how === 'focus' && performance.now() - openedAt < 400)) setOpen(t, 'pin');
      else setOpen(null);
    });
    t.el.addEventListener('pointerenter', (ev) => { if (hovers(ev) && open !== t) setOpen(t, 'hover'); });
    t.el.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && open === t && how === 'hover') setOpen(null); });
    t.btn.addEventListener('focus', () => { if (open !== t && t.btn.matches(':focus-visible')) setOpen(t, 'focus'); });
    t.btn.addEventListener('blur', () => { if (open === t && how === 'focus') setOpen(null); });
    t.btn.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && open === t) { ev.stopPropagation(); setOpen(null); } });
  }
  addEventListener('pointerdown', (ev) => { if (open && !open.el.contains(ev.target)) setOpen(null); }, { passive: true });
  // Teclado: los marcadores están en mitad del documento y antes de ellos hay botones de otros momentos. Estando
  // en M4, el primer Tab (sin nada enfocado, o desde el botón de sonido) entra al primer marcador visible.
  addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab' || ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey || document.documentElement.dataset.moment !== 'm4') return;
    const a = document.activeElement;
    if (a && a !== document.body && a.id !== 'sound') return;
    const first = tips.find((t) => t.on);
    if (first) { ev.preventDefault(); first.btn.focus(); }
  });
  // La sección recorta su contenido (overflow: hidden): al enfocar un marcador el navegador no debe desplazarla por dentro.
  section.addEventListener('scroll', () => { if (section.scrollTop || section.scrollLeft) section.scrollTo(0, 0); });
  addEventListener('resize', measure);
  measure();
  document.fonts?.ready.then(measure); // el ancho de los marcadores depende de la fuente ya cargada

  return {
    id: 'm4',
    track: track(section, SCROLL_SCREENS.m4),
    dom(e, q, { active }) {
      if (!stageH) measure();
      const vh = innerHeight;
      // El escenario sube con el scroll (empieza a moverse ya durante la entrada).
      const travel = Math.max(0, stageH - vh);
      const p = clamp01((e - 0.5) * 0.25 + q);
      stage.style.transform = `translate3d(0,${(-p * travel).toFixed(1)}px,0)`;
      // Parallax por profundidad (<1 se queda atrás, 1 = con el escenario, >1 más rápido). En p = 0, todo en su sitio.
      if (!profile.reducedMotion) {
        for (const l of layers) {
          const y = -(l.depth - 1) * p * vh * 0.9;
          if (Math.abs(y - l.y) > 0.5) { l.y = y; l.el.style.translate = `0 ${y.toFixed(1)}px`; }
        }
      }
      if (open && Math.abs(scrollY - openY) > 48) setOpen(null); // seguir el scroll cierra el texto abierto
      if (!active && e < 0.2) {
        // fuera del momento no queda ningún marcador encendido (ni enfocable con el teclado)
        for (const t of tips) if (t.on) { t.on = false; t.el.classList.remove('on'); }
        return;
      }

      // Condensación de cada foto según su posición en pantalla
      for (const ph of photos) {
        const r = ph.el.getBoundingClientRect();
        ph.top = r.top; ph.h = r.height;
        // En táctil no hay hover: la foto que cruza el centro de la pantalla recupera su color real.
        if (profile.touch) ph.el.classList.toggle('color', Math.abs(r.top + r.height / 2 - vh / 2) < vh * 0.2);
        let v = clamp01((vh * 1.02 - r.top) / (r.height * 0.9 + vh * 0.25));
        v = 1 - Math.pow(1 - v, 2);
        if (profile.reducedMotion) v = v > 0.3 ? 1 : 0;
        if (Math.abs(v - ph.last) < 0.004) continue;
        ph.last = v;
        // máscara fragmentada: se genera la primera vez que la foto se acerca (≈ 30 ms por foto)
        if (!ph.urls && v > 0) ph.urls = buildMasks(ph.el.offsetHeight / ph.el.offsetWidth || ph.aspect, ph.face[0], ph.face[1], ph.seed);
        const step = v <= 0 ? -1 : Math.min(MASK_STEPS - 1, Math.floor(v * MASK_STEPS));
        if (step !== ph.step) {
          ph.step = step;
          ph.el.style.visibility = step < 0 ? 'hidden' : 'visible';
          if (step >= 0) { const u = `url(${ph.urls[step]})`; ph.el.style.maskImage = u; ph.el.style.webkitMaskImage = u; }
        }
      }
      // Marcadores: aparecen cuando su foto ya se condensó y mientras están en la franja visible de la pantalla…
      let nameBoxes = null;
      for (const t of tips) {
        const y = t.ph.top + t.ay * t.ph.h;
        let on = t.ph.last > 0.8 && y > vh * 0.13 && y + 44 < vh * 0.95;
        if (on) {
          // …y no caen sobre las letras del nombre gigante (texto sobre texto). Se mide como mucho una vez por cuadro.
          nameBoxes ||= nameLines.map((r) => r.getBoundingClientRect());
          const c = t.el.getBoundingClientRect();
          on = !nameBoxes.some((b) => area({ left: c.left - 6, right: c.left + t.el.offsetWidth + 6, top: y, bottom: y + 44 }, b) > 0);
        }
        if (on === t.on) continue;
        t.on = on;
        t.el.classList.toggle('on', on);
        if (!on && open === t) setOpen(null);
      }
      // Citas: se escriben al cruzar la pantalla
      for (const qt of quotes) {
        const r = qt.el.getBoundingClientRect();
        qt.type(clamp01((vh * 0.85 - r.top) / (vh * 0.4)));
      }
      // El nombre se condensa al pasar (eje de ancho de la display)
      const nr = name.getBoundingClientRect();
      const w = 100 - clamp01((vh * 0.5 - nr.top) / vh) * 30;
      name.style.setProperty('--wdth', w.toFixed(1));
    },
  };
}
