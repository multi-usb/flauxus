// 0 · Inicio: isotipo, cinta que se rebobina con progreso real y PRESS START (manual §07).
const SEGMENTS = 24; // la barra avanza en saltos, no en continuo

export function createBoot() {
  const root = document.getElementById('boot');
  const tape = root.querySelector('.boot-tape');
  const fill = root.querySelector('.tape-bar i');
  const pct = root.querySelector('.tape-pct');
  const button = root.querySelector('.press-start');
  let shown = 0;

  function setProgress(p) {
    const stepped = Math.floor(Math.min(1, Math.max(0, p)) * SEGMENTS) / SEGMENTS;
    if (stepped <= shown) return;
    shown = stepped;
    fill.style.width = `${stepped * 100}%`;
    pct.textContent = String(Math.round(stepped * 100));
  }

  // Espera el primer gesto (clic, toque, Enter o Espacio). El navegador solo deja sonar audio después de él.
  function waitForStart() {
    setProgress(1);
    tape.classList.add('done');
    button.disabled = false;
    button.classList.remove('waiting');
    button.focus({ preventScroll: true });
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

  function fail(message) {
    pct.parentElement.textContent = message;
  }

  return { setProgress, waitForStart, hide, fail };
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
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, received);
    received += value.length;
    onProgress(received / total);
  }
  return out.buffer;
}
