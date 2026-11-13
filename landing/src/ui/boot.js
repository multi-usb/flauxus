// 0 · Inicio: isotipo, cinta que se rebobina con progreso real y PRESS START (manual §07).
const SEGMENTS = 24; // la barra avanza en saltos, no en continuo
const MIN_PROGRESS_MS = 3000;

export function createBoot() {
  const startedAt = performance.now();
  const root = document.getElementById('boot');
  const tape = root.querySelector('.boot-tape');
  const fluteClip = root.querySelector('.flute-progress-rect');
  const progressBar = root.querySelector('.tape-bar');
  const pct = root.querySelector('.tape-pct');
  const button = root.querySelector('.press-start');
  let shown = 0;
  let reported = 0;
  let progressFrame = 0;

  function paintProgress() {
    progressFrame = 0;
    const elapsed = performance.now() - startedAt;
    const timeProgress = Math.min(1, elapsed / MIN_PROGRESS_MS);
    const target = Math.min(reported, timeProgress);
    const stepped = Math.floor(target * SEGMENTS) / SEGMENTS;
    if (stepped > shown) {
      shown = stepped;
      const value = Math.round(stepped * 100);
      fluteClip.setAttribute('width', String(408 * stepped));
      progressBar.setAttribute('aria-valuenow', String(value));
      pct.textContent = String(value);
    }

    // Keep animating while either the three-second reveal or real loading is advancing.
    if (shown < Math.floor(reported * SEGMENTS) / SEGMENTS) {
      progressFrame = requestAnimationFrame(paintProgress);
    }
  }

  function setProgress(p) {
    reported = Math.max(reported, Math.min(1, Math.max(0, p)));
    if (!progressFrame && shown < Math.floor(reported * SEGMENTS) / SEGMENTS) {
      progressFrame = requestAnimationFrame(paintProgress);
    }
  }

  function waitForMinimumDuration(minimumMs = 3000) {
    const remaining = minimumMs - (performance.now() - startedAt);
    return remaining > 0 ? new Promise((resolve) => setTimeout(resolve, remaining)) : Promise.resolve();
  }

  // Espera el primer gesto (clic, toque, Enter o Espacio). El navegador solo deja sonar audio después de él.
  function waitForStart() {
    setProgress(1);
    paintProgress(); // La carga acabó; el mínimo de tres segundos ya se cumplió.
    tape.classList.add('done');
    button.disabled = false;
    button.classList.remove('waiting');
    root.classList.add('ready');
    return new Promise((resolve) => {
      const go = () => {
        button.removeEventListener('click', go);
        resolve();
      };
      button.addEventListener('click', go);
    });
  }

  function hide() {
    root.classList.add('off');
  }

  function transitionToHero(reducedMotion = false) {
    if (reducedMotion) return Promise.resolve();
    root.classList.add('entering');
    root.querySelectorAll('.boot-glass').forEach((panel, i) => {
      panel.style.transition = 'transform 1.25s cubic-bezier(.18,.72,.18,1), opacity .9s ease';
      panel.style.transform = `translate3d(0,0,0) scale(${i ? 3.2 : 3.8}) rotate(${i ? -8 : 7}deg)`;
      panel.style.opacity = '0';
    });
    return new Promise((resolve) => setTimeout(resolve, 1320));
  }

  function fail(message) {
    pct.parentElement.textContent = message;
  }

  return { setProgress, waitForMinimumDuration, waitForStart, transitionToHero, hide, fail };
}

// Descarga con progreso real (bytes recibidos / Content-Length).
export async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    const buf = await res.arrayBuffer();
    onProgress(1);
    return buf;
  }
  const reader = res.body.getReader();
  const out = new Uint8Array(total);
  let received = 0;
  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, received);
    received += value.length;
    onProgress(received / total);
  }
  return out.buffer;
}
