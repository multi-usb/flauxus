// Los dos videos de concept art como "canales" del monitor de JUEGA YA.
// Nada se descarga hasta que el Momento 3 está cerca (prepare); el segundo canal, solo si se pide.
const CHANNELS = [
  { video: '/video/concept-art_antimuseum.mp4', poster: '/video/concept-art_antimuseum_poster.jpg' },
  { video: '/video/concept-art_glitches.mp4', poster: '/video/concept-art_glitches_poster.jpg' },
];

export function createChannels({ autoplay = true } = {}) {
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
