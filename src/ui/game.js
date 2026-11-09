// El videojuego dentro de la landing: una capa a pantalla completa con el juego en un <iframe> del mismo origen.
// - El iframe aísla al juego (su CSS, sus eventos globales de teclado/puntero y su propia versión de Three.js).
// - Se crea al abrir y se destruye al cerrar: si nadie juega no se descarga nada, y al salir se liberan
//   la memoria de la GPU y el audio del juego.
// - La landing queda congelada debajo, en el mismo punto del scroll; al cerrar, el recorrido sigue desde el portal.
export function createGame({ onChange = () => {} } = {}) {
  const root = document.getElementById('game');
  const holder = root.querySelector('.game-frame');
  const close = root.querySelector('.game-close');
  let frame = null;
  let returnFocus = null;

  function open(url) {
    if (frame) return;
    returnFocus = document.activeElement;
    frame = document.createElement('iframe');
    frame.title = 'FLAUXUS · el videojuego';
    frame.allow = 'autoplay; fullscreen; gamepad';
    frame.src = url;
    // El teclado del juego (WASD, E…) necesita el foco dentro del iframe.
    frame.addEventListener('load', () => frame?.focus(), { once: true });
    holder.replaceChildren(frame);
    root.hidden = false;
    root.classList.remove('game-ready');
    document.documentElement.classList.add('game-open');
    onChange(true);
  }

  // El juego trae su propio botón «Salir» dentro de su barra superior (misma rejilla que «Volver al atrio»):
  // así los dos botones nunca compiten por la esquina. Cuando el juego avisa que está listo, se oculta el ◀◀
  // de la landing (queda solo como respaldo mientras el juego carga o si no llegara a arrancar).
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    if (e.data?.type === 'flauxus:ready') root.classList.add('game-ready');
    else if (e.data?.type === 'flauxus:exit') hide();
  });

  function hide() {
    if (!frame) return;
    frame.src = 'about:blank'; // corta audio y WebGL antes de soltar el nodo
    holder.replaceChildren();
    frame = null;
    root.hidden = true;
    root.classList.remove('game-ready');
    document.documentElement.classList.remove('game-open');
    onChange(false);
    returnFocus?.focus?.({ preventScroll: true });
  }

  close.addEventListener('click', hide);
  // Escape solo llega aquí cuando el foco está en la landing (dentro del iframe lo recibe el juego).
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { open, close: hide, get isOpen() { return !!frame; } };
}
