// Backend sin WebGL (o con prefers-reduced-motion): la misma narrativa con imágenes.
// Momento 1: las vistas reales del personaje (espalda → perfil → tres cuartos → frente) como hoja de modelo.
// Momento 3: el monitor es un marco HTML con el póster/video. Transiciones por corte.
export function createFlatBackend({ profile, channels }) {
  const html = document.documentElement;
  html.classList.add('flat');
  const layer = document.getElementById('flat');
  const sheet = layer.querySelector('.flat-sheet');
  const views = [...sheet.querySelectorAll('img')];
  const lazy = [...document.querySelectorAll('img[data-src]')];
  lazy.forEach((img) => { img.src = img.dataset.src; img.decoding = 'async'; });

  const osdScreen = document.querySelector('#osd .osd-screen');
  const poster = osdScreen.querySelector('.osd-poster');
  let crtState = { on: false, ready: false };
  let lastView = -1;
  let lastPoster = -1;

  function update(id, e, q) {
    layer.dataset.moment = id;
    if (id === 'm1') {
      const v = Math.min(views.length - 1, Math.floor(q * views.length));
      if (v !== lastView) {
        views.forEach((img, i) => img.classList.toggle('on', i === v));
        lastView = v;
      }
    }
    if (id === 'm2') {
      const t = (e + q * 2) / 3;
      crtState = { on: t >= 0.3, ready: t >= 0.55 };
      const i = channels.index;
      if (i !== lastPoster) { poster.src = channels.poster(i); lastPoster = i; }
      // Con video autorizado (sin reduced-motion) la pantalla muestra el video del canal.
      const v = channels.current;
      if (v && !profile.reducedMotion && v.parentElement !== osdScreen && !document.getElementById('player').contains(v)) {
        osdScreen.querySelector('video')?.remove();
        osdScreen.append(v);
      }
    } else {
      crtState = { on: false, ready: false };
    }
  }

  // Monitor centrado: proporción 3:4 vertical, alto 70 % de la pantalla (móvil: ancho 78 %).
  function osdRect() {
    let h = innerHeight * 0.7;
    let w = h * 0.75;
    if (w > innerWidth * 0.78) { w = innerWidth * 0.78; h = w / 0.75; }
    return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, w, h };
  }

  return {
    mode: 'flat',
    update,
    render() {},
    resize() {},
    setRewind(v) { html.classList.toggle('flat-rewind', !profile.reducedMotion && v > 0.3); },
    powerOn() {},
    powerOff(onDone) { onDone?.(); },
    osdRect,
    get crtState() { return crtState; },
    kick() {},
    glitch() {},
    setBoot() {},
    setBeat() {},
    impact() {},
    camInfo: () => null,
    get xrayState() { return { amount: 0 }; },
    xrayNote() {},
    get flood() { return document.documentElement.dataset.moment === 'm3' ? 1 : 0; },
    setLevel() {},
    setQuality() {},
  };
}
