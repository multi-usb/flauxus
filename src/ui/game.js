// El videojuego dentro de la landing: una capa a pantalla completa con el juego en un <iframe> del mismo origen.
// - El iframe aísla al juego (su CSS, sus eventos globales de teclado/puntero y su propia versión de Three.js).
// - Se crea al abrir y se DESTRUYE al cerrar: si nadie juega no se descarga nada, y al salir se liberan
//   la memoria de la GPU y el audio del juego. Cada apertura es un documento nuevo: el juego arranca de cero.
// - La landing queda congelada debajo, en el mismo punto del scroll; al cerrar, el recorrido sigue desde el portal.
// - Salidas: «Salir» del juego (mensaje flauxus:exit), el ◀◀ de respaldo, Escape y el botón atrás del navegador
//   (al abrir se apila una entrada en el historial; «atrás» la consume y cierra el juego sin abandonar la página).

// Progreso que versiones anteriores del juego guardaban en el navegador: se descarta antes de cada apertura
// para que ninguna partida vieja se cuele en una apertura nueva.
const LEGACY_PROGRESS = 'flauxus.progress.v1';
const HISTORY_FLAG = 'flauxusGame';

export function createGame({ onChange = () => {} } = {}) {
  const root = document.getElementById('game');
  const holder = root.querySelector('.game-frame');
  const close = root.querySelector('.game-close');
  let frame = null;
  let returnFocus = null;
  let pendingBack = 0; // «atrás» pedidos por hide() que el navegador aún no ha procesado
  let backTimer = 0;

  const inHistory = () => !!history.state?.[HISTORY_FLAG];

  function open(url) {
    if (frame) return;
    try { localStorage.removeItem(LEGACY_PROGRESS); } catch { /* almacenamiento bloqueado: no hay nada que heredar */ }
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
    // Entrada propia en el historial: el botón atrás (o el gesto de volver en el celular) cierra el juego.
    if (!inHistory()) history.pushState({ ...history.state, [HISTORY_FLAG]: true }, '');
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

  // Destrucción completa del juego: se pierde a propósito cada contexto WebGL (la GPU lo suelta ya, sin esperar
  // al recolector), el documento se reemplaza por uno vacío (corta audio, temporizadores y bucles) y el nodo se
  // elimina. No queda nada que el navegador pueda reanudar o restaurar.
  function destroy() {
    const f = frame;
    frame = null;
    if (!f) return;
    try {
      for (const c of f.contentDocument?.querySelectorAll('canvas') || []) {
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch { /* documento a medio cargar: basta con vaciarlo */ }
    try { f.contentWindow?.location.replace('about:blank'); } catch { f.removeAttribute('src'); }
    f.remove();
    holder.replaceChildren();
  }

  // fromHistory: el navegador ya consumió la entrada del juego (botón atrás); si no, se retira aquí.
  function hide({ fromHistory = false } = {}) {
    if (!frame) return;
    destroy();
    root.hidden = true;
    root.classList.remove('game-ready');
    document.documentElement.classList.remove('game-open');
    onChange(false);
    returnFocus?.focus?.({ preventScroll: true });
    returnFocus = null;
    if (!fromHistory && inHistory()) {
      pendingBack++;
      history.back();
      // Si ese «atrás» no llegara (navegación cruzada), la cuenta no debe tragarse un «atrás» real del usuario.
      clearTimeout(backTimer);
      backTimer = setTimeout(() => { pendingBack = 0; }, 1500);
    }
  }

  close.addEventListener('click', () => hide());
  // Escape solo llega aquí cuando el foco está en la landing (dentro del iframe lo recibe el juego).
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  // Botón atrás con el juego abierto: se cierra el juego. «Adelante» no reabre una partida: la entrada se retira.
  addEventListener('popstate', () => {
    // Llega el «atrás» que pidió hide(): no es el usuario. Si entre tanto se abrió otro juego (cerrar y reabrir
    // seguidos), ese juego recupera su entrada en el historial en vez de cerrarse.
    if (pendingBack > 0) {
      pendingBack--;
      if (frame && !inHistory()) history.pushState({ ...history.state, [HISTORY_FLAG]: true }, '');
      return;
    }
    if (frame && !inHistory()) hide({ fromHistory: true });
    else if (!frame && inHistory()) history.back();
  });
  // La página se va (otra URL, cierre): el juego se destruye para que el navegador no guarde una partida viva.
  addEventListener('pagehide', () => hide({ fromHistory: true }));
  // La página vuelve desde la caché de ida y vuelta (bfcache): nunca se restaura un juego; estado limpio.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    hide({ fromHistory: true });
    root.hidden = true;
    document.documentElement.classList.remove('game-open');
    if (inHistory()) history.back();
  });
  // Recarga con el juego abierto: la entrada del historial sobrevive a la recarga, el juego no. Se retira.
  if (inHistory()) history.back();

  return { open, close: () => hide(), get isOpen() { return !!frame; } };
}
