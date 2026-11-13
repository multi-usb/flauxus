import gsap from 'gsap';
import { track } from '../lib/track.js';
import { GAME_URL, SCROLL_SCREENS } from '../config.js';

// Momento 2 · PORTAL — JUEGA YA. El portal vive en el lienzo 3D (scenes/portal.js); aquí se alinea su HUD
// en HTML (esquinas, prompts del juego que rotan y el CTA). Se llega en ~2,7 pantallas de scroll.
const PROMPTS = [
  '[E] ENCONTRAR EL SONIDO',
  '[E] JUGAR CON EL PULSO',
  '[E] DECIDIR LA FRASE',
  '[E] HABITAR EL ESPACIO',
  '[E] CONECTAR EL CUERPO',
  '[E] INTERVENIR LA PARTITURA',
];

export function createM2({ profile, backend, channels, player, game, sfx, audioRunning = () => false }) {
  const section = document.getElementById('m2');
  const osd = document.getElementById('osd');
  const prompt = osd.querySelector('.osd-prompt');
  const cta = osd.querySelector('.cta');
  const screen = osd.querySelector('.osd-screen');
  const shortcut = document.getElementById('hud-cta');
  let promptIndex = -1;
  let visible = false;
  let ctaOn = false;
  let ignited = false;
  const t = track(section, SCROLL_SCREENS.m2);

  cta.addEventListener('pointerenter', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    sfx('pulse', { freq: 523.25 });
  });
  screen.addEventListener('click', () => { channels.next(); sfx('glitch'); });
  cta.addEventListener('click', enter);
  // El portal anuncia [E]: con el portal encendido, la tecla E entra igual que [ JUEGA YA ].
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!visible || !ctaOn || game.isOpen || entering) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    enter();
  });

  // Entrar: el portal se traga la pantalla (máscara que se expande desde su rectángulo) y abre el juego
  // (o, mientras GAME_URL esté vacía, el concept art a pantalla completa).
  let entering = false;
  function enter() {
    if (entering || game.isOpen) return;
    entering = true;
    setTimeout(() => { entering = false; }, 1200);
    sfx('enter');
    backend.glitch(1);
    const r = backend.osdRect();
    const mask = document.getElementById('crtoff');
    mask.style.setProperty('--x', `${r.x}px`);
    mask.style.setProperty('--y', `${r.y}px`);
    mask.style.setProperty('--w', `${r.w}px`);
    mask.style.setProperty('--h', `${r.h}px`);
    mask.classList.remove('play', 'enter');
    void mask.offsetWidth;
    if (!profile.reducedMotion) mask.classList.add('enter');
    setTimeout(() => {
      if (GAME_URL) game.open(GAME_URL);
      else player.open();
      mask.classList.remove('enter');
    }, profile.reducedMotion ? 0 : 520);
  }

  // Atajo del HUD: lleva al portal encendido desde cualquier punto de la página.
  shortcut.addEventListener('click', () => {
    const y = t.end - (t.end - t.start) * 0.25; // portal ya encendido y CTA visible
    sfx('whoosh');
    backend.glitch(0.8);
    if (profile.reducedMotion) { scrollTo(0, y); return; }
    const proxy = { y: scrollY };
    gsap.to(proxy, { y, duration: 1.1, ease: 'power3.inOut', onUpdate: () => scrollTo(0, proxy.y) });
  });

  function setVisible(on) {
    if (on === visible) return;
    visible = on;
    osd.classList.toggle('on', on);
    osd.setAttribute('aria-hidden', String(!on));
  }

  return {
    id: 'm2',
    track: t,
    dom(e, q, { active, time }) {
      const progress = (e + q * 2) / 3;
      channels.setActive(active && progress > 0.08);
      shortcut.classList.toggle('hidden', active || !document.documentElement.classList.contains('started'));

      const state = backend.crtState;
      if (active && state.on && !ignited) { ignited = true; if (!audioRunning()) backend.impact(); }
      if (!state.on) ignited = false;
      setVisible(active && state.on);
      if (!visible) return;

      const r = backend.osdRect();
      osd.style.transform = `translate3d(${r.x.toFixed(1)}px,${r.y.toFixed(1)}px,0)`;
      osd.style.width = `${r.w.toFixed(1)}px`;
      osd.style.height = `${r.h.toFixed(1)}px`;
      osd.style.fontSize = `${Math.max(12, Math.min(15, r.w / 22)).toFixed(1)}px`;

      const i = Math.floor(time / 1.6) % PROMPTS.length;
      if (i !== promptIndex) { prompt.textContent = PROMPTS[i]; promptIndex = i; }

      const on = state.ready;
      if (on !== ctaOn) {
        ctaOn = on;
        cta.classList.toggle('on', on);
        cta.tabIndex = on ? 0 : -1;
        if (on) sfx('pulse', { freq: 261.63 });
      }
    },
    prepare() { channels.prepare(); },
  };
}
