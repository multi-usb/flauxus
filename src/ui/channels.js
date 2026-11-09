// "Canales" del monitor de JUEGA YA. El primero es el juego de verdad: una toma general del Atrio con María Clara
// vestida de «Matar al padre», renderizada desde el propio juego (7 s en bucle sin corte, 24 fps, ~0,3–0,45 MB).
// Hay dos encuadres: 16:9 para el portal panorámico de escritorio y 9:16 para el portal vertical del celular.
// Los concept art siguen como canales 2 y 3 (tocar la pantalla del portal cambia de canal).
// Nada se descarga hasta que el Momento 3 está cerca (prepare); los demás canales, solo si se piden.
// Sin autoplay (movimiento reducido) o si el navegador no reproduce el video, se ve el póster fijo de cada canal.
const CONCEPT = [
  { video: '/video/concept-art_antimuseum.mp4', poster: '/video/concept-art_antimuseum_poster.jpg' },
  { video: '/video/concept-art_glitches.mp4', poster: '/video/concept-art_glitches_poster.jpg' },
];
const ATRIO = {
  desktop: { video: '/video/atrio-preview_16x9.mp4', poster: '/video/atrio-preview_16x9_poster.jpg' },
  mobile: { video: '/video/atrio-preview_9x16.mp4', poster: '/video/atrio-preview_9x16_poster.jpg' },
};

export function createChannels({ autoplay = true, mobile = false } = {}) {
  const CHANNELS = [mobile ? ATRIO.mobile : ATRIO.desktop, ...CONCEPT];
  const videos = CHANNELS.map(() => null);
  let index = 0;
  let wantPlay = false;
  const listeners = new Set();

  function ensure(i) {
    if (videos[i]) return videos[i];
    const v = document.createElement('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.preload = 'auto';
    v.poster = CHANNELS[i].poster;
    v.src = CHANNELS[i].video;
    videos[i] = v;
    return v;
  }

  return {
    count: CHANNELS.length,
    poster: (i = index) => CHANNELS[i].poster,
    get index() { return index; },
    get current() { return videos[index]; },
    prepare() { ensure(index); },
    // play/pause según el Momento 3 esté activo (el video no corre fuera de pantalla)
    setActive(on) {
      if (on === wantPlay) return;
      wantPlay = on;
      const v = ensure(index);
      if (on && autoplay) v.play().catch(() => {});
      else v.pause();
    },
    next() {
      videos[index]?.pause();
      index = (index + 1) % CHANNELS.length;
      const v = ensure(index);
      if (wantPlay && autoplay) v.play().catch(() => {});
      listeners.forEach((fn) => fn(index));
      return index;
    },
    onChange(fn) { listeners.add(fn); },
    video: (i = index) => ensure(i),
  };
}
